/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'

const TVDiscovery = ({ onTVConnect, onDiscoverTVs, isStreaming, localIP }) => {
  const [customIP, setCustomIP] = useState('')
  const [availableTVs, setAvailableTVs] = useState([])
  const [isDiscovering, setIsDiscovering] = useState(false)

  // Listen for discovered TVs from main process
  useEffect(() => {
    if (window.api?.onTVsDiscovered) {
      const handleTVsFound = (tvs) => {
        console.log('TVs discovered:', tvs)
        setAvailableTVs(tvs)
        setIsDiscovering(false)
      }

      window.api.onTVsDiscovered(handleTVsFound)

      return () => {
        if (window.api?.removeAllListeners) {
          window.api.removeAllListeners('tvs-discovered')
        }
      }
    }
  }, [])

  const handleTVConnect = (tv) => {
    console.log('Connecting to TV:', tv)
    onTVConnect({
      room: tv.room || 'default',
      serverUrl: `ws://${tv.ip}:8080`
    })
  }

  const handleCustomConnect = () => {
    if (customIP) {
      console.log('Connecting to custom IP:', customIP)
      onTVConnect({
        room: 'default',
        serverUrl: `ws://${customIP}:8080`
      })
    }
  }

  const handleDiscover = () => {
    console.log('Starting TV discovery...')
    setIsDiscovering(true)
    setAvailableTVs([])
    onDiscoverTVs()

    // Timeout discovery after 10 seconds
    setTimeout(() => {
      setIsDiscovering(false)
    }, 10000)
  }

  const validateIP = (ip) => {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipRegex.test(ip)
  }

  return (
    <div className="tv-discovery">
      <div className="network-info">
        <h3>📡 Network Information</h3>
        <div className="network-details">
          <div className="network-item">
            <span className="network-label">Your Computer IP:</span>
            <span className="network-value">{localIP || 'Detecting...'}</span>
          </div>
          <div className="network-item">
            <span className="network-label">Signaling Server:</span>
            <span className="network-value">ws://{localIP || 'localhost'}:8080</span>
          </div>
        </div>
      </div>

      <div className="discovery-section">
        <h3>Available TVs</h3>

        <div className="discovery-controls">
          <button
            className="btn btn-secondary"
            onClick={handleDiscover}
            disabled={isStreaming || isDiscovering}
          >
            {isDiscovering ? '🔄 Discovering...' : '🔍 Discover TVs on Network'}
          </button>
          <p className="discovery-info">
            {isDiscovering
              ? 'Scanning your network for Screen Mirror receiver apps...'
              : 'This will scan your network for Screen Mirror receiver apps'}
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
              <p>
                {isDiscovering
                  ? 'Scanning for TVs...'
                  : 'No TVs found. Click "Discover TVs" or add a custom connection below.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="custom-connection-section">
        <h3>Manual Connection</h3>
        <p>Connect directly to a TV by entering its IP address.</p>

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

          <button
            className="btn btn-primary"
            onClick={handleCustomConnect}
            disabled={!customIP || !validateIP(customIP) || isStreaming}
          >
            Connect to TV
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
            <li>
              <strong>Update the receiver app:</strong> Change the signaling URL to:{' '}
              <code>ws://{localIP || 'YOUR_COMPUTER_IP'}:8080</code>
            </li>
            <li>Open the receiver app on your TV</li>
            <li>Note the IP address shown on the TV screen</li>
            <li>Use the &quot;Discover TVs&quot; button or enter the IP manually</li>
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
              <strong>Can&apos;t find IP?</strong> Check your TV&apos;s network settings or router
              admin panel
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
