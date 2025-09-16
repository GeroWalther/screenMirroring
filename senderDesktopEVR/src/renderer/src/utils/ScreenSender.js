/**
 * WebRTC Screen Sharing with Exponential Backoff Reconnection
 * Handles screen capture, peer connection management, and signaling
 */

class ScreenSender {
  constructor(options = {}) {
    // Auto-detect local network IP for signaling server
    const LOCAL_IP = '192.168.0.26'; // Your Mac's IP address
    this.signalingUrl = options.signalingUrl || `ws://${LOCAL_IP}:8080`
    this.room = options.room || 'living-room' // Match receiver default room
    this.iceServers = options.iceServers || [
      // Enhanced STUN servers for better Android TV connectivity
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
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

  // Check if receiver is available by testing the signaling server
  async checkReceiverAvailability() {
    return new Promise((resolve, reject) => {
      console.log('🔍 Checking receiver availability at:', this.signalingUrl)
      this.updateStatus('checking-receiver')
      
      const ws = new WebSocket(this.signalingUrl)
      let resolved = false
      
      // Set timeout for availability check
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          console.log('⏰ Receiver check timed out')
          ws.close()
          reject(new Error('No receiver found. Please open the stream URL in a web browser first.'))
        }
      }, 5000) // 5 second timeout for availability check
      
      ws.onopen = () => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          console.log('✅ Receiver is available!')
          ws.close() // Close test connection
          resolve(true)
        }
      }
      
      ws.onclose = (event) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          console.log('❌ Receiver not available - connection closed:', event.code)
          reject(new Error('No receiver found. Please open the stream URL in a web browser first.'))
        }
      }
      
      ws.onerror = (error) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          console.log('❌ Receiver not available - connection error:', error)
          reject(new Error('No receiver found. Please open the stream URL in a web browser first.'))
        }
      }
    })
  }

  async start() {
    try {
      console.log('🚀 SENDER START - Initializing with config:', {
        signalingUrl: this.signalingUrl,
        room: this.room,
        timestamp: new Date().toISOString()
      })
      
      this.updateStatus('starting')

      // First check if receiver is available
      try {
        await this.checkReceiverAvailability()
      } catch (error) {
        console.log('❌ Receiver availability check failed:', error.message)
        this.updateStatus('no-receiver')
        this.onError(error)
        return
      }

      // Create signaling client
      console.log('📡 SENDER - Creating signaling client')
      this.signalingClient = this.createWebRTCSignaling(this.signalingUrl, {
        role: 'Sender',
        room: this.room,
        onSignal: this.handleSignal,
        onStatusChange: this.handleStatusChange,
        isStopping: () => this.isStopping
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
    let maxReconnectAttempts = 5 // Reduced from 10 for faster timeout
    let reconnectDelay = 1000
    let connectionId = Math.random().toString(36).substr(2, 9)
    let connectionTimeout = null
    let initialConnectionTimeout = null
    
    console.log('🏭 SIGNALING CLIENT CREATED - ID:', connectionId, 'URL:', url)

    const client = {
      connect() {
        try {
          console.log('🔗 SENDER WS CONNECT START - ID:', connectionId, 'URL:', url)
          console.log('🔗 WebSocket.CONNECTING =', WebSocket.CONNECTING, 'WebSocket.OPEN =', WebSocket.OPEN)
          
          // Clear any existing timeout
          if (connectionTimeout) {
            clearTimeout(connectionTimeout)
            connectionTimeout = null
          }
          
          // Set connection timeout (10 seconds for initial connection)
          const timeoutDuration = reconnectAttempts === 0 ? 10000 : 5000
          connectionTimeout = setTimeout(() => {
            console.log('⏰ Connection timeout after', timeoutDuration / 1000, 'seconds')
            if (ws && ws.readyState === WebSocket.CONNECTING) {
              console.log('❌ TIMEOUT: WebSocket still connecting, closing...')
              ws.close()
              
              // If this is the first connection attempt, show no receiver error
              if (reconnectAttempts === 0) {
                options.onStatusChange('no-receiver', {
                  message: 'No receiver found. Please open the stream URL in a web browser first.'
                })
                return
              }
            }
          }, timeoutDuration)
          
          ws = new WebSocket(url)
          console.log('🔗 WebSocket created - ReadyState:', ws.readyState, '(should be', WebSocket.CONNECTING, ')')

          ws.onopen = () => {
            console.log('✅ SENDER WS CONNECTED - ID:', connectionId, 'URL:', url)
            console.log('✅ WebSocket state: ReadyState =', ws.readyState, '(should be', WebSocket.OPEN, ')')
            
            // Clear connection timeout on successful connection
            if (connectionTimeout) {
              clearTimeout(connectionTimeout)
              connectionTimeout = null
            }
            
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
            
            // Clear connection timeout on close
            if (connectionTimeout) {
              clearTimeout(connectionTimeout)
              connectionTimeout = null
            }

            // Don't reconnect if we're in the process of stopping
            if (options.isStopping && options.isStopping()) {
              console.log('🛑 Not reconnecting - stop was requested')
              return
            }

            // Check if this was a connection refused (no receiver available)
            if (event.code === 1006 && reconnectAttempts === 0) {
              console.log('❌ No receiver available on first attempt')
              options.onStatusChange('no-receiver', {
                message: 'No receiver found. Please open the stream URL in a web browser first.',
                code: event.code
              })
              return
            }

            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++
              options.onStatusChange('reconnecting', { attempt: reconnectAttempts })

              setTimeout(() => {
                // Double-check stopping flag before reconnecting
                if (!options.isStopping || !options.isStopping()) {
                  this.connect()
                }
              }, reconnectDelay)

              reconnectDelay = Math.min(reconnectDelay * 2, 30000)
            } else {
              console.log('❌ Max reconnection attempts reached, giving up')
              options.onStatusChange('no-receiver', {
                message: 'Cannot connect to receiver. Please ensure the stream URL is open in a web browser.',
                attempts: maxReconnectAttempts
              })
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
        // Clear any pending timeouts
        if (connectionTimeout) {
          clearTimeout(connectionTimeout)
          connectionTimeout = null
        }
        
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

      case 'no-receiver':
        console.log('❌ No receiver available:', data.message)
        this.updateStatus('no-receiver', data)
        // Trigger error callback with helpful message
        this.onError(new Error(data.message || 'No receiver found'))
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
      
      // Find the primary display - prioritize entire screen or first display
      let primaryScreen = sources.find(source => 
        source.name.includes('Entire screen') || 
        source.name.includes('Screen 1') ||
        source.name.toLowerCase().includes('main') ||
        source.name.toLowerCase().includes('primary')
      )
      
      // Fallback to first screen source if no obvious primary found
      if (!primaryScreen) {
        primaryScreen = sources.find(source => source.name.includes('Screen')) || sources[0]
      }
      
      console.log('Using primary screen source:', primaryScreen.name)
      console.log('Available sources:', sources.map(s => s.name))
      
      // Create constraints for getUserMedia with Android TV compatibility
      console.log('📺 Using Android TV-optimized video constraints');
      const constraints = {
        audio: false, // Desktop audio capture is complex in Electron
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: primaryScreen.id,
            maxFrameRate: 15,    // Reduced from 30 for better compatibility
            minFrameRate: 10,    // Minimum frame rate
            maxWidth: 1280,      // Reduced from 1920 (720p width)
            maxHeight: 720,      // Reduced from 1080 (720p height)
            minWidth: 640,       // Minimum width
            minHeight: 360       // Minimum height
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

      // Android TV optimization - let WebRTC choose best codec (often VP8 by default)
      console.log('📺 Using default codec selection for Android TV compatibility');
      // Temporarily disabled: offer.sdp = this.forceVP8ForAndroidTV(offer.sdp)

      await this.pc.setLocalDescription(offer)
      
      // Set Android TV-friendly encoding parameters after setting local description
      setTimeout(() => {
        this.setAndroidTVEncodingParameters()
      }, 100)

      // Send offer to receiver
      this.signalingClient.send({
        type: 'signal',
        room: this.room,
        to: 'answerer',
        data: { sdp: this.pc.localDescription }
      })

      console.log('Android TV-optimized offer created and sent')
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

  // Simple VP8 codec preference - safer approach
  forceVP8ForAndroidTV(sdp) {
    console.log('📺 Applying VP8 preference for Android TV compatibility');
    
    // Simple approach: just reorder VP8 before H.264 in the m= line
    const lines = sdp.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find the m=video line
      if (line.startsWith('m=video ')) {
        console.log('📺 Original m=video line:', line);
        
        // Extract payload types
        const parts = line.split(' ');
        if (parts.length > 3) {
          const port = parts[1];
          const protocol = parts[2];
          const payloads = parts.slice(3);
          
          // Find VP8 payload type (usually 96)
          const vp8Payloads = [];
          const otherPayloads = [];
          
          // Check rtpmap lines to identify VP8
          payloads.forEach(payload => {
            // Look ahead to find corresponding rtpmap
            const rtpmapLine = lines.find(l => l.startsWith(`a=rtpmap:${payload} VP8`));
            if (rtpmapLine) {
              vp8Payloads.push(payload);
              console.log('📺 Found VP8 payload:', payload);
            } else {
              otherPayloads.push(payload);
            }
          });
          
          // Reorder: VP8 first, then others
          if (vp8Payloads.length > 0) {
            const reorderedPayloads = vp8Payloads.concat(otherPayloads);
            const newMLine = `m=video ${port} ${protocol} ${reorderedPayloads.join(' ')}`;
            lines[i] = newMLine;
            console.log('📺 Updated m=video line:', newMLine);
            console.log('📺 VP8 now prioritized');
          } else {
            console.warn('⚠️ VP8 not found, keeping original order');
          }
        }
        break;
      }
    }
    
    return lines.join('\n');
  }
  
  // Set Android TV-optimized encoding parameters
  async setAndroidTVEncodingParameters() {
    console.log('📺 Setting Android TV-optimized encoding parameters');
    try {
      await this.setEncodingParameters({
        maxBitrate: 2000000,        // 2 Mbps - conservative for Android TV
        maxFramerate: 15,           // Lower frame rate for stability
        scaleResolutionDownBy: 1.0  // Keep original resolution (already lowered)
      });
      console.log('📺 Android TV encoding parameters applied');
    } catch (error) {
      console.warn('⚠️ Could not set encoding parameters:', error.message);
    }
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
    
    // Mark as stopping to prevent reconnection attempts
    this.isStopping = true
    this.isConnected = false

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

    // Clear debug interval if it exists
    if (this._debugInterval) {
      clearInterval(this._debugInterval)
      this._debugInterval = null
    }

    this.updateStatus('stopped')
    this.onStreamEnded()
    
    // Reset stopping flag after a short delay
    setTimeout(() => {
      this.isStopping = false
    }, 1000)
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
