import { useState } from 'react'

const TVDiscovery = ({ onTVConnect, onDiscoverTVs, isStreaming }) => {
  const [customIP, setCustomIP] = useState('')
  const [customRoom, setCustomRoom] = useState('')

  // Static list of common TVs (these would be updated by mDNS discovery)
  const [availableTVs] = useState([
    { name: 'Living Room TV', ip: '192.168.1.100', room: 'livingroom' },
    { name: 'Bedroom TV', ip: '192.168.1.101', room: 'bedroom' },
    { name: 'Kitchen TV', ip: '192.168.1.102', room: 'kitchen' }
  ])

  const handleTVConnect = (tv) => {
    onTVConnect({
      room: tv.room,
      serverUrl: `ws://${tv.ip}:8080`
    })
  }

  const handleCustomConnect = () => {
    if (customIP && customRoom) {
      onTVConnect({
        room: customRoom,
        serverUrl: `ws://${customIP}:8080`
      })
    }
  }

  const handleDiscover = () => {
    onDiscoverTVs()
  }

  const validateIP = (ip) => {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipRegex.test(ip)
  }

  return (
    <div className="tv-discovery">
      <div className="discovery-section">
        <h3>Available TVs</h3>

        <div className="discovery-controls">
          <button className="btn btn-secondary" onClick={handleDiscover} disabled={isStreaming}>
            🔍 Discover TVs on Network
          </button>
          <p className="discovery-info">
            This will scan your network for Screen Mirror receiver apps
          </p>
        </div>

        <div className="tv-list">
          {availableTVs.length > 0 ? (
            availableTVs.map((tv, index) => (
              <div key={index} className="tv-card">
                <div className="tv-info">
                  <h4>{tv.name}</h4>
                  <p>IP: {tv.ip}</p>
                  <p>Room: {tv.room}</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handleTVConnect(tv)}
                  disabled={isStreaming}
                >
                  {isStreaming ? 'Connected' : 'Connect'}
                </button>
              </div>
            ))
          ) : (
            <div className="no-tvs">
              <p>No TVs found. Try discovering or add a custom connection below.</p>
            </div>
          )}
        </div>
      </div>

      <div className="custom-connection-section">
        <h3>Custom Connection</h3>
        <p>Manually connect to a TV by entering its IP address and room name.</p>

        <div className="custom-form">
          <div className="form-group">
            <label htmlFor="custom-ip">TV IP Address:</label>
            <input
              id="custom-ip"
              type="text"
              value={customIP}
              onChange={(e) => setCustomIP(e.target.value)}
              placeholder="192.168.1.100"
              disabled={isStreaming}
            />
            {customIP && !validateIP(customIP) && (
              <span className="validation-error">Please enter a valid IP address</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="custom-room">Room Name:</label>
            <input
              id="custom-room"
              type="text"
              value={customRoom}
              onChange={(e) => setCustomRoom(e.target.value)}
              placeholder="livingroom"
              disabled={isStreaming}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleCustomConnect}
            disabled={!customIP || !customRoom || !validateIP(customIP) || isStreaming}
          >
            Connect to Custom TV
          </button>
        </div>
      </div>

      <div className="help-section">
        <h3>Setup Instructions</h3>
        <div className="instructions">
          <h4>Setting up your TV/Device:</h4>
          <ol>
            <li>Install the Screen Mirror Receiver app on your TV or device</li>
            <li>Connect your TV to the same Wi-Fi network as this computer</li>
            <li>Open the receiver app on your TV</li>
            <li>Note the IP address shown on the TV screen</li>
            <li>Use the "Discover TVs" button or enter the IP manually</li>
          </ol>

          <h4>Troubleshooting:</h4>
          <ul>
            <li>
              <strong>TV not appearing?</strong> Make sure both devices are on the same network
            </li>
            <li>
              <strong>Connection fails?</strong> Check if the TV app is running and port 8080 is
              open
            </li>
            <li>
              <strong>Can't find IP?</strong> Check your TV's network settings or router admin panel
            </li>
            <li>
              <strong>Firewall issues?</strong> Ensure WebSocket connections are allowed
            </li>
          </ul>

          <h4>Network Requirements:</h4>
          <ul>
            <li>Both devices must be on the same local network</li>
            <li>Port 8080 should be accessible for WebSocket connections</li>
            <li>Minimum 1 Mbps bandwidth recommended for decent quality</li>
            <li>5+ Mbps recommended for high quality streaming</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default TVDiscovery
