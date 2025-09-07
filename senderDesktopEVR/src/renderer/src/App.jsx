import { useState } from 'react'
import ScreenMirrorControls from './components/ScreenMirrorControls'
import ConnectionStatus from './components/ConnectionStatus'
import QualitySettings from './components/QualitySettings'
import TVDiscovery from './components/TVDiscovery'
import { useScreenSender } from './hooks/useScreenSender'

function App() {
  const [activeTab, setActiveTab] = useState('controls')

  const {
    connectionState,
    isStreaming,
    error,
    stats,
    room,
    serverUrl,
    localIP,
    startSharing,
    stopSharing,
    updateQuality,
    setRoom,
    setServerUrl,
    isConnected
  } = useScreenSender()

  const handleStartSharing = () => {
    startSharing({ room, serverUrl })
  }

  const handleStopSharing = () => {
    stopSharing()
  }

  const handleQualityUpdate = (settings) => {
    updateQuality(settings)
  }

  const handleTVConnect = (tvInfo) => {
    setRoom(tvInfo.room)
    setServerUrl(tvInfo.serverUrl)
    startSharing({ room: tvInfo.room, serverUrl: tvInfo.serverUrl })
  }

  const handleDiscoverTVs = () => {
    if (window.api?.discoverTVs) {
      window.api.discoverTVs()
    }
  }

  return (
    <div className="app">
      <div className="app-header">
        <h1>📱 Screen Mirror</h1>
        <ConnectionStatus
          connectionState={connectionState}
          isStreaming={isStreaming}
          error={error}
        />
      </div>

      <div className="app-tabs">
        <button
          className={`tab ${activeTab === 'controls' ? 'active' : ''}`}
          onClick={() => setActiveTab('controls')}
        >
          Controls
        </button>
        <button
          className={`tab ${activeTab === 'discovery' ? 'active' : ''}`}
          onClick={() => setActiveTab('discovery')}
        >
          TV Discovery
        </button>
        <button
          className={`tab ${activeTab === 'quality' ? 'active' : ''}`}
          onClick={() => setActiveTab('quality')}
        >
          Quality
        </button>
      </div>

      <div className="app-content">
        {activeTab === 'controls' && (
          <ScreenMirrorControls
            room={room}
            serverUrl={serverUrl}
            isStreaming={isStreaming}
            isConnected={isConnected}
            onRoomChange={setRoom}
            onServerUrlChange={setServerUrl}
            onStartSharing={handleStartSharing}
            onStopSharing={handleStopSharing}
            stats={stats}
          />
        )}

        {activeTab === 'discovery' && (
          <TVDiscovery
            onTVConnect={handleTVConnect}
            onDiscoverTVs={handleDiscoverTVs}
            isStreaming={isStreaming}
            localIP={localIP}
          />
        )}

        {activeTab === 'quality' && (
          <QualitySettings onQualityUpdate={handleQualityUpdate} isStreaming={isStreaming} />
        )}
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}
    </div>
  )
}

export default App
