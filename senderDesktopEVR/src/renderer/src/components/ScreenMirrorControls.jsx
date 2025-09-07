import { useState } from 'react'

const ScreenMirrorControls = ({
  room,
  serverUrl,
  isStreaming,
  isConnected,
  onRoomChange,
  onServerUrlChange,
  onStartSharing,
  onStopSharing,
  stats
}) => {
  const [localRoom, setLocalRoom] = useState(room)
  const [localServerUrl, setLocalServerUrl] = useState(serverUrl)

  const handleRoomChange = (e) => {
    const value = e.target.value
    setLocalRoom(value)
    onRoomChange(value)
  }

  const handleServerUrlChange = (e) => {
    const value = e.target.value
    setLocalServerUrl(value)
    onServerUrlChange(value)
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatBitrate = (bitrate) => {
    if (!bitrate) return '0 bps'
    const k = 1000
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps']
    const i = Math.floor(Math.log(bitrate) / Math.log(k))
    return parseFloat((bitrate / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="controls-panel">
      <div className="connection-settings">
        <h3>Connection Settings</h3>

        <div className="form-group">
          <label htmlFor="room-input">Room Name:</label>
          <input
            id="room-input"
            type="text"
            value={localRoom}
            onChange={handleRoomChange}
            disabled={isStreaming}
            placeholder="Enter room name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="server-input">Server URL:</label>
          <input
            id="server-input"
            type="text"
            value={localServerUrl}
            onChange={handleServerUrlChange}
            disabled={isStreaming}
            placeholder="ws://localhost:8080"
          />
        </div>

        <div className="control-buttons">
          {!isStreaming ? (
            <button
              id="start-btn"
              className="btn btn-primary"
              onClick={onStartSharing}
              disabled={!localRoom || !localServerUrl}
            >
              🎬 Start Screen Sharing
            </button>
          ) : (
            <button id="stop-btn" className="btn btn-danger" onClick={onStopSharing}>
              ⏹️ Stop Sharing
            </button>
          )}
        </div>
      </div>

      {isStreaming && stats && (
        <div className="stats-panel">
          <h3>Connection Statistics</h3>

          {stats.video && (
            <div className="stats-section">
              <h4>Video</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Resolution:</span>
                  <span className="stat-value">
                    {stats.video.frameWidth || 0} × {stats.video.frameHeight || 0}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Frame Rate:</span>
                  <span className="stat-value">{stats.video.framesPerSecond || 0} fps</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Bitrate:</span>
                  <span className="stat-value">{formatBitrate(stats.video.bitrate)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Bytes Sent:</span>
                  <span className="stat-value">{formatBytes(stats.video.bytesSent)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Frames Encoded:</span>
                  <span className="stat-value">{stats.video.framesEncoded || 0}</span>
                </div>
              </div>
            </div>
          )}

          {stats.audio && (
            <div className="stats-section">
              <h4>Audio</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Bytes Sent:</span>
                  <span className="stat-value">{formatBytes(stats.audio.bytesSent)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Packets Sent:</span>
                  <span className="stat-value">{stats.audio.packetsSent || 0}</span>
                </div>
              </div>
            </div>
          )}

          {stats.connection && (
            <div className="stats-section">
              <h4>Connection</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Round Trip Time:</span>
                  <span className="stat-value">
                    {Math.round((stats.connection.currentRoundTripTime || 0) * 1000)} ms
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Available Outgoing:</span>
                  <span className="stat-value">
                    {formatBitrate(stats.connection.availableOutgoingBitrate)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isStreaming && (
        <div className="instructions">
          <h3>Instructions</h3>
          <ol>
            <li>Enter a room name (e.g., "livingroom", "bedroom")</li>
            <li>Set the server URL (your TV's IP address with port 8080)</li>
            <li>Click "Start Screen Sharing" to begin</li>
            <li>Select the screen/window you want to share</li>
            <li>Your screen will be mirrored to the TV</li>
          </ol>

          <div className="tips">
            <h4>💡 Tips</h4>
            <ul>
              <li>Make sure your TV app is running and connected to the same network</li>
              <li>Use the TV Discovery tab to find available TVs automatically</li>
              <li>Adjust quality settings in the Quality tab for better performance</li>
              <li>You can minimize this window - the app will run in the system tray</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScreenMirrorControls
