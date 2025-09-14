/**
 * WebRTC Screen Sharing with Exponential Backoff Reconnection
 * Handles screen capture, peer connection management, and signaling
 */

class ScreenSender {
  constructor(options = {}) {
    // Auto-detect local network IP for signaling server
    const LOCAL_IP = '192.168.0.25'; // Your Mac's IP address
    this.signalingUrl = options.signalingUrl || `ws://${LOCAL_IP}:8080`
    this.room = options.room || 'living-room' // Match receiver default room
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
      console.log('🚀 SENDER START - Initializing with config:', {
        signalingUrl: this.signalingUrl,
        room: this.room,
        timestamp: new Date().toISOString()
      })
      
      this.updateStatus('starting')

      // Create signaling client
      console.log('📡 SENDER - Creating signaling client')
      this.signalingClient = this.createWebRTCSignaling(this.signalingUrl, {
        role: 'Sender',
        room: this.room,
        onSignal: this.handleSignal,
        onStatusChange: this.handleStatusChange
      })

      // Connect to signaling server
      console.log('🔗 SENDER - Attempting signaling server connection to:', this.signalingUrl)
      this.signalingClient.connect()
      
      console.log('✅ SENDER - Start method completed, waiting for connection...')
    } catch (error) {
      console.error('❌ SENDER START FAILED:', error)
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
    let connectionId = Math.random().toString(36).substr(2, 9)
    
    console.log('🏭 SIGNALING CLIENT CREATED - ID:', connectionId, 'URL:', url)

    const client = {
      connect() {
        try {
          console.log('🔗 SENDER WS CONNECT START - ID:', connectionId, 'URL:', url)
          console.log('🔗 WebSocket.CONNECTING =', WebSocket.CONNECTING, 'WebSocket.OPEN =', WebSocket.OPEN)
          ws = new WebSocket(url)
          console.log('🔗 WebSocket created - ReadyState:', ws.readyState, '(should be', WebSocket.CONNECTING, ')')

          ws.onopen = () => {
            console.log('✅ SENDER WS CONNECTED - ID:', connectionId, 'URL:', url)
            console.log('✅ WebSocket state: ReadyState =', ws.readyState, '(should be', WebSocket.OPEN, ')')
            reconnectAttempts = 0
            reconnectDelay = 1000
            console.log('📡 SENDER - Calling onStatusChange("connected")')
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
            console.log('📴 Sender signaling disconnected - Code:', event.code, 'Reason:', event.reason)
            console.log('Close event details:', {
              wasClean: event.wasClean,
              code: event.code,
              reason: event.reason,
              url: url
            })

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
            console.error('❌ Sender signaling error:', error)
            console.error('WebSocket error details:', {
              url: url,
              readyState: ws.readyState,
              error: error
            })
            options.onStatusChange('error', error)
          }
        } catch (error) {
          console.error('Failed to create WebSocket:', error)
          options.onStatusChange('error', error)
        }
      },

      send(message) {
        console.log('📨 SENDER WS SEND - Message:', message)
        console.log('📨 WebSocket state: exists =', !!ws, 'readyState =', ws?.readyState, 'OPEN =', WebSocket.OPEN)
        
        if (ws && ws.readyState === WebSocket.OPEN) {
          const payload = JSON.stringify(message)
          console.log('📨 SENDER - Sending payload:', payload)
          ws.send(payload)
          console.log('✅ SENDER - Message sent successfully')
        } else {
          console.error('❌ SENDER - Cannot send message, WebSocket not connected. State:', {
            wsExists: !!ws,
            readyState: ws?.readyState,
            expectedState: WebSocket.OPEN
          })
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
    console.log('📊 SENDER STATUS CHANGE:', status, data)
    console.log('📊 Current sender state:', {
      connectionState: this.connectionState,
      isConnected: this.isConnected,
      signalingClientExists: !!this.signalingClient,
      signalingClientConnected: this.signalingClient?.isConnected(),
      timestamp: new Date().toISOString()
    })

    switch (status) {
      case 'connected':
        console.log('✅ SENDER SIGNALING CONNECTED - About to join room')
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
    console.log('📱 Sender attempting to join room:', this.room)
    if (!this.signalingClient?.isConnected()) {
      console.warn('⚠️ Signaling client not connected, cannot join room')
      return
    }

    try {
      const joinMessage = {
        type: 'join',
        role: 'offerer',
        room: this.room
      }
      console.log('📱 SENDER JOIN ROOM - Sending message:', joinMessage)
      console.log('📱 Signaling client state:', {
        exists: !!this.signalingClient,
        isConnected: this.signalingClient?.isConnected(),
        readyState: this.signalingClient?.ws?.readyState
      })
      
      // Send join message
      this.signalingClient.send(joinMessage)
      console.log('✅ SENDER - Join message sent successfully')

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
      console.log('Attempting Electron desktop capture...')
      
      // Get available desktop sources using Electron's desktopCapturer
      const sources = await window.api.getDesktopSources()
      console.log('Available sources:', sources.length)
      
      if (sources.length === 0) {
        throw new Error('No screen sources available')
      }
      
      // Find the primary display (usually the first screen source)
      const primaryScreen = sources.find(source => 
        source.name.includes('Screen') || source.name.includes('Entire screen')
      ) || sources[0]
      
      console.log('Using source:', primaryScreen.name)
      
      // Create constraints for getUserMedia with the desktop source
      const constraints = {
        audio: false, // Desktop audio capture is complex in Electron
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: primaryScreen.id,
            maxFrameRate: 30,
            maxWidth: 1920,
            maxHeight: 1080
          }
        }
      }
      
      // Use getUserMedia with the desktop source
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('Electron desktop capture successful')

      // Handle stream ended (user clicked stop sharing)
      const videoTrack = this.localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          console.log('Screen sharing ended by user')
          this.stop()
        })
      }

      // Add tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        console.log(`Adding ${track.kind} track to peer connection`)
        this.pc.addTrack(track, this.localStream)
      })

      console.log(`Screen capture started - Video: ${this.localStream.getVideoTracks().length}, Audio: ${this.localStream.getAudioTracks().length}`)
      
    } catch (error) {
      console.error('Failed to capture screen:', error)
      
      // Provide more specific error information
      if (error.name === 'NotAllowedError') {
        throw new Error('Screen recording permission denied. Please grant permission in System Settings > Privacy & Security > Screen Recording')
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Screen capture not supported in this browser environment')
      } else if (error.name === 'NotFoundError') {
        throw new Error('No screen available for capture')
      } else if (error.message && error.message.includes('No screen sources')) {
        throw new Error('No screen sources found. Make sure screen recording is enabled.')
      } else {
        throw new Error(`Desktop capture failed: ${error.message}`)
      }
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
    console.log('📊 SENDER UPDATE STATUS:', status, 'Data:', data)
    this.connectionState = status
    this.onStatusChange(status, data)
  }

  // Debug method to check current connection status
  getConnectionStatus() {
    const status = {
      connectionState: this.connectionState,
      isConnected: this.isConnected,
      signalingUrl: this.signalingUrl,
      room: this.room,
      signalingClient: {
        exists: !!this.signalingClient,
        isConnected: this.signalingClient?.isConnected(),
        readyState: this.signalingClient?.ws?.readyState
      },
      peerConnection: {
        exists: !!this.pc,
        connectionState: this.pc?.connectionState,
        iceConnectionState: this.pc?.iceConnectionState,
        signalingState: this.pc?.signalingState
      },
      localStream: {
        exists: !!this.localStream,
        tracks: this.localStream?.getTracks().length || 0
      },
      timestamp: new Date().toISOString()
    }
    console.log('🔍 SENDER CONNECTION STATUS:', status)
    return status
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

// Export for both ES6 modules and CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ScreenSender };
}

export default ScreenSender;
export { ScreenSender };
