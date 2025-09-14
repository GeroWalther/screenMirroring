import { useState, useEffect } from 'react'
import ScreenSender from './utils/ScreenSender.js'

const SIGNALING_URL = 'ws://192.168.0.25:8080'
const ROOM_NAME = 'living-room'

function ScreenMirrorApp() {
  const [status, setStatus] = useState('disconnected')
  const [message, setMessage] = useState('Ready to connect')
  const [isConnected, setIsConnected] = useState(false)
  const [screenSender, setScreenSender] = useState(null)
  const [discoveredTVs, setDiscoveredTVs] = useState([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [showTVList, setShowTVList] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(ROOM_NAME)
  const [localIP, setLocalIP] = useState('192.168.0.25')

  // Get local IP and setup IPC listeners
  useEffect(() => {
    // Get local IP
    if (window.api?.getLocalIP) {
      window.api.getLocalIP().then(ip => {
        setLocalIP(ip)
      })
    }

    // Listen for discovered TVs
    if (window.api?.onTVsDiscovered) {
      const handleTVsFound = (tvs) => {
        console.log('TVs discovered:', tvs)
        setDiscoveredTVs(tvs)
        setIsDiscovering(false)
        if (tvs.length > 0) {
          setShowTVList(true)
        }
      }
      window.api.onTVsDiscovered(handleTVsFound)
    }

    return () => {
      if (screenSender) {
        screenSender.stop()
      }
    }
  }, [screenSender])

  const updateStatus = (state, msg) => {
    setStatus(state)
    setMessage(msg)
    
    if (state === 'streaming') {
      setIsConnected(true)
    } else if (state === 'disconnected' || state === 'error') {
      setIsConnected(false)
    }
  }

  const handleDiscoverTVs = () => {
    setIsDiscovering(true)
    setDiscoveredTVs([])
    setShowTVList(true)
    if (window.api?.discoverTVs) {
      window.api.discoverTVs()
    }
    // Timeout discovery after 10 seconds
    setTimeout(() => {
      setIsDiscovering(false)
    }, 10000)
  }

  const handleConnectToTV = (tv) => {
    const room = tv.room || 'default'
    const serverUrl = `ws://${tv.ip}:8080`
    setSelectedRoom(room)
    startScreenSharing(room, serverUrl)
  }

  const handleConnectToRoom = () => {
    startScreenSharing(selectedRoom, SIGNALING_URL)
  }

  const startScreenSharing = async (room, signalingUrl) => {
    if (screenSender && isConnected) {
      // Stop sharing
      screenSender.stop()
      setScreenSender(null)
      setIsConnected(false)
      updateStatus('disconnected', 'Disconnected')
      return
    }

    try {
      updateStatus('connecting', 'Connecting to signaling server...')

      const sender = new ScreenSender({
        signalingUrl: signalingUrl,
        room: room,
        onStatusChange: (status, data) => {
          console.log('📊 Status:', status, data)
          
          switch (status) {
            case 'starting':
              updateStatus('connecting', 'Starting screen capture...')
              break
            case 'connecting':
              updateStatus('connecting', 'Connecting to signaling server...')
              break
            case 'connected':
              updateStatus('connected', 'Connected! Establishing WebRTC...')
              break
            case 'webrtc-connected':
              updateStatus('streaming', 'Screen sharing active!')
              break
            case 'disconnected':
              updateStatus('disconnected', 'Disconnected')
              break
            case 'reconnecting':
              updateStatus('connecting', `Reconnecting... (attempt ${data.attempt || 1})`)
              break
            case 'error':
              updateStatus('error', 'Connection failed - check TV app is running')
              break
          }
        },
        onError: (error) => {
          console.error('❌ Screen sender error:', error)
          updateStatus('error', error.message || 'Connection failed')
        },
        onStreamStarted: () => {
          updateStatus('streaming', 'Screen sharing active!')
        },
        onStreamEnded: () => {
          updateStatus('disconnected', 'Screen sharing stopped')
        }
      })

      setScreenSender(sender)
      
      // Store globally for debugging
      window.debugSender = sender
      console.log('🔍 DEBUG: Sender stored globally as window.debugSender')
      
      // Start periodic status logging
      const statusInterval = setInterval(() => {
        if (sender && sender.getConnectionStatus) {
          sender.getConnectionStatus()
        }
      }, 5000)
      
      // Store interval for cleanup
      sender._debugInterval = statusInterval
      
      await sender.start()
      
    } catch (error) {
      console.error('❌ Failed to start screen sharing:', error)
      updateStatus('error', error.message || 'Failed to start screen sharing')
    }
  }

  const handleConnect = () => {
    handleConnectToRoom()
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-50'
      case 'connecting': return 'text-orange-600 bg-orange-50'
      case 'streaming': return 'text-blue-600 bg-blue-50'
      case 'error': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusDot = () => {
    const baseClass = "w-2 h-2 rounded-full mr-2"
    switch (status) {
      case 'connected': return `${baseClass} bg-green-500`
      case 'connecting': return `${baseClass} bg-orange-500 animate-pulse`
      case 'streaming': return `${baseClass} bg-blue-500`
      case 'error': return `${baseClass} bg-red-500`
      default: return `${baseClass} bg-gray-400`
    }
  }

  const getButtonText = () => {
    if (status === 'streaming') return '🛑 Stop Sharing'
    if (status === 'connecting') return '⏳ Connecting...'
    if (status === 'error') return '🔄 Try Again'
    return '🚀 Start Screen Sharing'
  }

  const isButtonDisabled = () => {
    return status === 'connecting'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📺</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Screen Mirror</h1>
          <p className="text-gray-600">Share your screen to any TV on your network</p>
        </div>

        {/* Status */}
        <div className={`rounded-lg p-4 mb-6 ${getStatusColor()}`}>
          <div className="flex items-center justify-center">
            <div className={getStatusDot()}></div>
            <span className="font-medium">{message}</span>
          </div>
        </div>

        {/* TV Discovery Section */}
        {!isConnected && (
          <div className="mb-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleDiscoverTVs}
                disabled={isDiscovering || status === 'connecting'}
                className="flex-1 py-2 px-4 rounded-lg font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
              >
                {isDiscovering ? '🔄 Discovering...' : '🔍 Find TVs'}
              </button>
              <button
                onClick={() => setShowTVList(!showTVList)}
                className="py-2 px-4 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {showTVList ? '📱 Manual' : '📋 List'}
              </button>
            </div>

            {/* Discovered TVs List */}
            {showTVList && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
                {discoveredTVs.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Available TVs:</h4>
                    {discoveredTVs.map((tv, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded mb-2">
                        <div>
                          <div className="font-medium text-sm">{tv.name}</div>
                          <div className="text-xs text-gray-500">{tv.ip} • {tv.room}</div>
                        </div>
                        <button
                          onClick={() => handleConnectToTV(tv)}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                        >
                          Connect
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    {isDiscovering ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full mr-2"></div>
                        Scanning network...
                      </div>
                    ) : (
                      'No TVs found. Try discovery or use manual connection below.'
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manual Room Connection */}
        <div className="mb-6">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              placeholder="Enter room code"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={isConnected || status === 'connecting'}
            />
          </div>
          <button
            onClick={handleConnect}
            disabled={isButtonDisabled() || !selectedRoom.trim()}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
              isButtonDisabled() || !selectedRoom.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
            }`}
          >
            {getButtonText()}
          </button>
        </div>

        {/* Connection Info */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600 text-sm">Room:</span>
            <span className="font-mono bg-gray-200 px-2 py-1 rounded text-sm font-semibold">
              {selectedRoom}
            </span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-600 text-sm">Server:</span>
            <span className="font-mono bg-gray-200 px-2 py-1 rounded text-sm font-semibold">
              {localIP}:8080
            </span>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Make sure your TV receiver app is running with the same room code
          </p>
        </div>
      </div>
    </div>
  )
}

export default ScreenMirrorApp