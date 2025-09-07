const ConnectionStatus = ({ connectionState, isStreaming, error }) => {
  const getStatusIcon = () => {
    if (error) return '❌'
    if (isStreaming) return '🟢'

    switch (connectionState) {
      case 'connecting':
      case 'starting':
        return '🟡'
      case 'connected':
      case 'webrtc-connected':
        return '🟢'
      case 'reconnecting':
        return '🟠'
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
    if (error) return `Error: ${error}`
    if (isStreaming) return 'Screen sharing active'

    switch (connectionState) {
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
    if (error) return 'status-error'
    if (isStreaming) return 'status-streaming'

    switch (connectionState) {
      case 'connecting':
      case 'starting':
      case 'webrtc-connecting':
        return 'status-connecting'
      case 'connected':
      case 'webrtc-connected':
        return 'status-connected'
      case 'reconnecting':
        return 'status-reconnecting'
      case 'disconnected':
      case 'stopped':
        return 'status-disconnected'
      case 'error':
      case 'failed':
        return 'status-error'
      default:
        return 'status-ready'
    }
  }

  return (
    <div className={`connection-status ${getStatusClass()}`}>
      <span className="status-icon">{getStatusIcon()}</span>
      <span className="status-text">{getStatusText()}</span>
    </div>
  )
}

export default ConnectionStatus
