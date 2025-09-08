/**
 * WebRTC Screen Sharing with Exponential Backoff Reconnection
 * Handles screen capture, peer connection management, and signaling
 */

class ScreenSender {
  constructor(options = {}) {
    this.signalingUrl = options.signalingUrl || 'ws://localhost:8080'
    this.room = options.room || 'default-room'
    this.iceServers = options.iceServers || [
      // Google's free STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
      // Add TURN servers for production (replace with your own)
      // { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' },
      // { urls: 'turns:your-turn-server.com:5349', username: 'user', credential: 'pass' }
    ]

    // State
    this.pc = null
    this.localStream = null
    this.signalingClient = null
    this.isConnected = false
    this.connectionState = 'disconnected'

    // Callbacks
    this.onStatusChange = options.onStatusChange || (() => {})
    this.onStreamStarted = options.onStreamStarted || (() => {})
    this.onStreamEnded = options.onStreamEnded || (() => {})
    this.onError = options.onError || (() => {})

    // Bind methods
    this.handleSignal = this.handleSignal.bind(this)
    this.handleStatusChange = this.handleStatusChange.bind(this)
  }

  async start() {
    try {
      this.updateStatus('starting')

      // Create signaling client
      this.signalingClient = this.createWebRTCSignaling(this.signalingUrl, {
        role: 'Sender',
        room: this.room,
        onSignal: this.handleSignal,
        onStatusChange: this.handleStatusChange
      })

      // Connect to signaling server
      this.signalingClient.connect()
    } catch (error) {
      console.error('Failed to start sender:', error)
      this.onError(error)
      this.updateStatus('error')
    }
  }

  // Simplified signaling client for WebRTC
  createWebRTCSignaling(url, options) {
    let ws = null
    let reconnectAttempts = 0
    let maxReconnectAttempts = 10
    let reconnectDelay = 1000

    const client = {
      connect() {
        try {
          ws = new WebSocket(url)

          ws.onopen = () => {
            console.log('Signaling connected')
            reconnectAttempts = 0
            reconnectDelay = 1000
            options.onStatusChange('connected')
          }

          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data)
              console.log('Signaling message:', message)

              if (message.type === 'signal' && message.data) {
                options.onSignal(message.data)
              }
            } catch (error) {
              console.error('Failed to parse signaling message:', error)
            }
          }

          ws.onclose = (event) => {
            console.log('Signaling disconnected:', event.code, event.reason)

            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++
              options.onStatusChange('reconnecting', { attempt: reconnectAttempts })

              setTimeout(() => {
                this.connect()
              }, reconnectDelay)

              reconnectDelay = Math.min(reconnectDelay * 2, 30000)
            } else {
              options.onStatusChange('failed')
            }
          }

          ws.onerror = (error) => {
            console.error('Signaling error:', error)
            options.onStatusChange('error', error)
          }
        } catch (error) {
          console.error('Failed to create WebSocket:', error)
          options.onStatusChange('error', error)
        }
      },

      send(message) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message))
        } else {
          console.warn('Cannot send message, WebSocket not connected')
        }
      },

      close() {
        if (ws) {
          ws.close()
          ws = null
        }
      },

      isConnected() {
        return ws && ws.readyState === WebSocket.OPEN
      }
    }

    return client
  }

  async handleStatusChange(status, data = {}) {
    console.log('Signaling status:', status, data)

    switch (status) {
      case 'connected':
        await this.joinRoom()
        break

      case 'reconnected':
        await this.rejoinAfterReconnect()
        break

      case 'disconnected':
        this.updateStatus('disconnected')
        break

      case 'reconnecting':
        this.updateStatus('reconnecting', data)
        break

      case 'error':
      case 'failed':
        this.updateStatus('error', data)
        break
    }
  }

  async joinRoom() {
    if (!this.signalingClient?.isConnected()) return

    try {
      // Send join message
      this.signalingClient.send({
        type: 'join',
        role: 'offerer',
        room: this.room
      })

      // Initialize WebRTC
      await this.initializeWebRTC()
    } catch (error) {
      console.error('Failed to join room:', error)
      this.onError(error)
    }
  }

  async rejoinAfterReconnect() {
    console.log('Rejoining after reconnect...')

    // Clean up old peer connection
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    // Rejoin room and reinitialize WebRTC
    await this.joinRoom()
  }

  async initializeWebRTC() {
    try {
      // Create peer connection
      this.pc = new RTCPeerConnection({
        iceServers: this.iceServers
      })

      // Set up event handlers
      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.signalingClient?.isConnected()) {
          this.signalingClient.send({
            type: 'signal',
            room: this.room,
            to: 'answerer',
            data: { ice: event.candidate }
          })
        }
      }

      this.pc.onconnectionstatechange = () => {
        console.log('WebRTC connection state:', this.pc.connectionState)
        this.updateStatus('webrtc-' + this.pc.connectionState)

        if (this.pc.connectionState === 'connected') {
          this.isConnected = true
          this.onStreamStarted()
        } else if (
          this.pc.connectionState === 'disconnected' ||
          this.pc.connectionState === 'failed'
        ) {
          this.isConnected = false
          this.onStreamEnded()
        }
      }

      // Capture screen
      await this.captureScreen()

      // Create and send offer
      await this.createOffer()
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error)
      this.onError(error)
      throw error
    }
  }

  async captureScreen() {
    try {
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
          displaySurface: 'monitor'
        },
        audio: true
      })

      // Handle stream ended (user clicked stop sharing)
      this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen sharing ended by user')
        this.stop()
      })

      // Add tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        this.pc.addTrack(track, this.localStream)
      })

      console.log('Screen capture started')
    } catch (error) {
      console.error('Failed to capture screen:', error)
      throw error
    }
  }

  async createOffer() {
    try {
      const offer = await this.pc.createOffer()

      // Prefer H.264 for better Android TV compatibility
      offer.sdp = this.preferH264(offer.sdp)

      await this.pc.setLocalDescription(offer)

      // Send offer to receiver
      this.signalingClient.send({
        type: 'signal',
        room: this.room,
        to: 'answerer',
        data: { sdp: this.pc.localDescription }
      })

      console.log('Offer created and sent')
    } catch (error) {
      console.error('Failed to create offer:', error)
      throw error
    }
  }

  async handleSignal(data) {
    if (!this.pc) return

    try {
      if (data.sdp && data.sdp.type === 'answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        console.log('Answer received and set')
        this.updateStatus('connected')
      }

      if (data.ice) {
        await this.pc.addIceCandidate(new RTCIceCandidate(data.ice))
        console.log('ICE candidate added')
      }
    } catch (error) {
      console.error('Error handling signal:', error)
      this.onError(error)
    }
  }

  // Prefer H.264 codec for better Android TV compatibility
  preferH264(sdp) {
    const lines = sdp.split('\n')
    const videoMLineIndex = lines.findIndex((line) => line.startsWith('m=video'))

    if (videoMLineIndex === -1) return sdp

    const videoMLine = lines[videoMLineIndex]
    const h264PayloadTypes = []

    // Find H.264 payload types
    lines.forEach((line) => {
      if (line.includes('H264') || line.includes('h264')) {
        const match = line.match(/a=rtpmap:(\d+)/)
        if (match) {
          h264PayloadTypes.push(match[1])
        }
      }
    })

    if (h264PayloadTypes.length > 0) {
      // Reorder payload types to prefer H.264
      const parts = videoMLine.split(' ')
      const otherPayloads = parts.slice(3).filter((pt) => !h264PayloadTypes.includes(pt))
      const newMLine = parts.slice(0, 3).concat(h264PayloadTypes, otherPayloads).join(' ')
      lines[videoMLineIndex] = newMLine
    }

    return lines.join('\n')
  }

  // Set encoding parameters for better quality/performance
  async setEncodingParameters(params = {}) {
    if (!this.pc) return

    const senders = this.pc.getSenders()
    const videoSender = senders.find((sender) => sender.track && sender.track.kind === 'video')

    if (videoSender) {
      const currentParams = videoSender.getParameters()

      // Update encoding parameters
      if (currentParams.encodings && currentParams.encodings.length > 0) {
        const encoding = currentParams.encodings[0]

        if (params.maxBitrate) encoding.maxBitrate = params.maxBitrate
        if (params.maxFramerate) encoding.maxFramerate = params.maxFramerate
        if (params.scaleResolutionDownBy) {
          encoding.scaleResolutionDownBy = params.scaleResolutionDownBy
        }

        await videoSender.setParameters(currentParams)
        console.log('Encoding parameters updated:', encoding)
      }
    }
  }

  updateStatus(status, data = {}) {
    this.connectionState = status
    this.onStatusChange(status, data)
    console.log('Status updated:', status, data)
  }

  getStats() {
    if (!this.pc) return null
    return this.pc.getStats()
  }

  stop() {
    console.log('Stopping screen sender...')

    // Close signaling
    if (this.signalingClient) {
      this.signalingClient.close()
      this.signalingClient = null
    }

    // Close peer connection
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    this.isConnected = false
    this.updateStatus('stopped')
    this.onStreamEnded()
  }

  // Getters
  isActive() {
    return this.isConnected && this.pc && this.pc.connectionState === 'connected'
  }

  getConnectionState() {
    return this.connectionState
  }

  getRoom() {
    return this.room
  }

  setRoom(newRoom) {
    this.room = newRoom
  }
}

export default ScreenSender
