const ConnectionStatus = ({ 
  connectionState, 
  isStreaming, 
  error, 
  onRetry,
  onOpenReceiver,
  streamURL 
}) => {
  const getStatusIcon = () => {
    if (error && error.type === 'no-receiver') return '📺'
    if (error) return '❌'
    if (isStreaming) return '🟢'

    switch (connectionState) {
      case 'checking-receiver':
        return '🔍'
      case 'connecting':
      case 'starting':
        return '🟡'
      case 'connected':
      case 'webrtc-connected':
        return '🟢'
      case 'reconnecting':
        return '🟠'
      case 'no-receiver':
        return '📺'
      case 'disconnected':
      case 'stopped':
        return '⚪'
      case 'error':
      case 'failed':
        return '🔴'
      default:
        return '⚪'
    }
  }

  const getStatusText = () => {
    if (error) {
      if (typeof error === 'object' && error.message) {
        return error.message
      }
      return `Error: ${error}`
    }
    if (isStreaming) return 'Screen sharing active'

    switch (connectionState) {
      case 'checking-receiver':
        return 'Checking for receiver...'
      case 'connecting':
      case 'starting':
        return 'Connecting...'
      case 'connected':
        return 'Connected to signaling server'
      case 'webrtc-connecting':
        return 'Establishing WebRTC connection...'
      case 'webrtc-connected':
        return 'WebRTC connection established'
      case 'reconnecting':
        return 'Reconnecting...'
      case 'no-receiver':
        return 'No receiver found'
      case 'disconnected':
        return 'Disconnected'
      case 'stopped':
        return 'Ready to connect'
      case 'error':
      case 'failed':
        return 'Connection failed'
      default:
        return 'Ready'
    }
  }

  const getStatusClass = () => {
    if (error && error.type === 'no-receiver') return 'border-purple-300 bg-purple-50'
    if (error) return 'border-red-300 bg-red-50'
    if (isStreaming) return 'border-blue-300 bg-blue-50'

    switch (connectionState) {
      case 'checking-receiver':
        return 'border-orange-300 bg-orange-50'
      case 'connecting':
      case 'starting':
      case 'webrtc-connecting':
        return 'border-yellow-300 bg-yellow-50'
      case 'connected':
      case 'webrtc-connected':
        return 'border-green-300 bg-green-50'
      case 'reconnecting':
        return 'border-orange-300 bg-orange-50'
      case 'no-receiver':
        return 'border-purple-300 bg-purple-50'
      case 'disconnected':
      case 'stopped':
        return 'border-gray-300 bg-gray-50'
      case 'error':
      case 'failed':
        return 'border-red-300 bg-red-50'
      default:
        return 'border-gray-300 bg-gray-50'
    }
  }

  const showActionButtons = error && error.type === 'no-receiver' && error.showRetry

  return (
    <div className={`rounded-lg p-4 border-2 ${getStatusClass()}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl mr-3">{getStatusIcon()}</span>
        <span className="font-medium flex-1">{getStatusText()}</span>
      </div>
      
      {showActionButtons && (
        <div className="flex gap-2 mt-3">
          {streamURL && (
            <button 
              className="flex-1 py-2 px-4 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
              onClick={onOpenReceiver}
              title="Open receiver in browser"
            >
              🔗 Open Receiver
            </button>
          )}
          <button 
            className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            onClick={onRetry}
            title="Retry connection"
          >
            🔄 Retry
          </button>
        </div>
      )}
      
      {error && error.type === 'no-receiver' && (
        <div className="mt-3 p-3 bg-purple-50 rounded-lg">
          <p className="text-xs text-purple-700 text-center">
            👆 Open the receiver URL shown above in any web browser first, then try again.
          </p>
        </div>
      )}
    </div>
  )
}

export default ConnectionStatus
