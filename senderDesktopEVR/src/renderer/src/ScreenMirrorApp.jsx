import { useState, useEffect } from 'react'
import { useScreenSender } from './hooks/useScreenSender'
import ConnectionStatus from './components/ConnectionStatus'

const ROOM_NAME = 'living-room'

function ScreenMirrorApp() {
  const {
    connectionState,
    isStreaming,
    error,
    room,
    localIP,
    startSharing,
    stopSharing,
    retryConnection,
    openReceiverURL,
    getStreamURL,
    setRoom
  } = useScreenSender()
  
  const [discoveredTVs, setDiscoveredTVs] = useState([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [showTVList, setShowTVList] = useState(false)

  // Setup IPC listeners for TV discovery
  useEffect(() => {
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
  }, [])

  // Initialize room from constant
  useEffect(() => {
    if (room !== ROOM_NAME) {
      setRoom(ROOM_NAME)
    }
  }, [])

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

  const handleConnectToTV = async (tv) => {
    const tvRoom = tv.room || 'default'
    setRoom(tvRoom)
    await startSharing({
      room: tvRoom,
      serverUrl: `ws://${tv.ip}:8080`
    })
  }

  const handleConnect = async () => {
    if (isStreaming) {
      stopSharing()
    } else {
      await startSharing()
    }
  }

  // Get current status for UI display
  const getDisplayStatus = () => {
    if (error && error.type === 'no-receiver') return 'no-receiver'
    if (isStreaming) return 'streaming'
    if (connectionState === 'checking-receiver') return 'checking'
    if (connectionState === 'connecting' || connectionState === 'starting') return 'connecting'
    if (connectionState === 'connected' || connectionState.startsWith('webrtc-')) return 'connected'
    if (connectionState === 'reconnecting') return 'reconnecting'
    if (error || connectionState === 'error' || connectionState === 'failed') return 'error'
    return 'ready'
  }

  const getDisplayMessage = () => {
    if (error && typeof error === 'object' && error.message) return error.message
    if (error) return `Error: ${error}`
    if (isStreaming) return 'Screen sharing active!'
    if (connectionState === 'checking-receiver') return 'Checking for receiver...'
    if (connectionState === 'connecting' || connectionState === 'starting') return 'Connecting...'
    if (connectionState === 'connected') return 'Connected! Establishing WebRTC...'
    if (connectionState.startsWith('webrtc-')) return 'WebRTC connection established'
    if (connectionState === 'reconnecting') return 'Reconnecting...'
    return 'Ready to connect'
  }

  const getStatusColor = () => {
    const status = getDisplayStatus()
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-50'
      case 'connecting':
      case 'checking':
        return 'text-orange-600 bg-orange-50'
      case 'streaming':
        return 'text-blue-600 bg-blue-50'
      case 'no-receiver':
        return 'text-purple-600 bg-purple-50'
      case 'error':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusDot = () => {
    const baseClass = 'w-2 h-2 rounded-full mr-2'
    const status = getDisplayStatus()
    switch (status) {
      case 'connected':
        return `${baseClass} bg-green-500`
      case 'connecting':
      case 'checking':
        return `${baseClass} bg-orange-500 animate-pulse`
      case 'streaming':
        return `${baseClass} bg-blue-500`
      case 'no-receiver':
        return `${baseClass} bg-purple-500`
      case 'error':
        return `${baseClass} bg-red-500`
      default:
        return `${baseClass} bg-gray-400`
    }
  }

  const getButtonText = () => {
    const status = getDisplayStatus()
    if (status === 'streaming') return '🛑 Stop Sharing'
    if (status === 'connecting' || status === 'checking') return '⏳ Connecting...'
    if (status === 'error' || status === 'no-receiver') return '🔄 Try Again'
    return '🚀 Start Screen Sharing'
  }

  const isButtonDisabled = () => {
    const status = getDisplayStatus()
    return status === 'connecting' || status === 'checking'
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

        {/* Receiver URL - Always Visible */}
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <div className="text-center mb-3">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">📱 Step 1: Open This URL in Your Browser</h3>
            <p className="text-sm text-blue-700 mb-3">
              First, open this URL in any web browser (on any device on your network):
            </p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-blue-200 mb-3">
            <div className="font-mono text-sm text-center break-all select-all text-blue-900 font-semibold">
              {getStreamURL()}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const url = getStreamURL()
                navigator.clipboard.writeText(url)
                // You could add a toast notification here
              }}
              className="flex-1 py-2 px-4 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
            >
              📋 Copy URL
            </button>
            <button
              onClick={openReceiverURL}
              className="flex-1 py-2 px-4 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
            >
              🌐 Open in Browser
            </button>
          </div>
        </div>

        {/* Step 2 Header */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">📺 Step 2: Start Screen Sharing</h3>
          <p className="text-sm text-gray-600">After opening the URL above, click the button below to start sharing</p>
        </div>

        {/* Status */}
        <div className="mb-6">
          <ConnectionStatus 
            connectionState={connectionState}
            isStreaming={isStreaming}
            error={error}
            onRetry={retryConnection}
            onOpenReceiver={openReceiverURL}
            streamURL={getStreamURL()}
          />
        </div>
        
        {/* Fallback status display with new styling */}
        <div className={`rounded-lg p-4 mb-6 ${getStatusColor()}`}>
          <div className="flex items-center justify-center">
            <div className={getStatusDot()}></div>
            <span className="font-medium">{getDisplayMessage()}</span>
          </div>
        </div>

        {/* TV Discovery Section */}
        {!isStreaming && (
          <div className="mb-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleDiscoverTVs}
                disabled={isDiscovering || isButtonDisabled()}
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
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-white rounded mb-2"
                      >
                        <div>
                          <div className="font-medium text-sm">{tv.name}</div>
                          <div className="text-xs text-gray-500">
                            {tv.ip} • {tv.room}
                          </div>
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
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Enter room code"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={isStreaming || isButtonDisabled()}
            />
          </div>
          <button
            onClick={handleConnect}
            disabled={isButtonDisabled() || !room.trim()}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
              isButtonDisabled() || !room.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
            }`}
          >
            {getButtonText()}
          </button>
        </div>

        {/* Streaming Success Message */}
        {isStreaming && (
          <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Screen Sharing Active!</h3>
              <p className="text-sm text-green-700 mb-2">
                Your screen is now being streamed to the browser window you opened.
              </p>
              <p className="text-xs text-green-600">
                Keep this app running to continue sharing. Click "Stop Sharing" when done.
              </p>
            </div>
          </div>
        )}

        {/* Connection Info */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600 text-sm">Room:</span>
            <span className="font-mono bg-gray-200 px-2 py-1 rounded text-sm font-semibold">
              {room}
            </span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-600 text-sm">Server:</span>
            <span className="font-mono bg-gray-200 px-2 py-1 rounded text-sm font-semibold">
              {localIP}:8080
            </span>
          </div>
          {!isStreaming ? (
            <p className="text-xs text-gray-500 text-center">
              📋 Remember: Open the URL above in a browser first, then start sharing
            </p>
          ) : (
            <p className="text-xs text-green-600 text-center font-medium">
              ✅ Screen sharing active! Your browser should now show the stream.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ScreenMirrorApp
