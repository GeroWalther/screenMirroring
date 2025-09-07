import { useState } from 'react'

const QualitySettings = ({ onQualityUpdate, isStreaming }) => {
  const [maxBitrate, setMaxBitrate] = useState(2000000) // 2 Mbps
  const [maxFramerate, setMaxFramerate] = useState(30)
  const [scaleResolutionDownBy, setScaleResolutionDownBy] = useState(1)

  const presets = {
    high: {
      name: 'High Quality (2 Mbps)',
      maxBitrate: 2000000,
      maxFramerate: 30,
      scaleResolutionDownBy: 1
    },
    medium: {
      name: 'Medium Quality (1 Mbps)',
      maxBitrate: 1000000,
      maxFramerate: 30,
      scaleResolutionDownBy: 1.5
    },
    low: {
      name: 'Low Quality (500 Kbps)',
      maxBitrate: 500000,
      maxFramerate: 24,
      scaleResolutionDownBy: 2
    },
    'ultra-low': {
      name: 'Ultra Low (250 Kbps)',
      maxBitrate: 250000,
      maxFramerate: 15,
      scaleResolutionDownBy: 3
    }
  }

  const handlePresetChange = (presetKey) => {
    const preset = presets[presetKey]
    if (preset) {
      setMaxBitrate(preset.maxBitrate)
      setMaxFramerate(preset.maxFramerate)
      setScaleResolutionDownBy(preset.scaleResolutionDownBy)

      if (isStreaming) {
        onQualityUpdate({
          maxBitrate: preset.maxBitrate,
          maxFramerate: preset.maxFramerate,
          scaleResolutionDownBy: preset.scaleResolutionDownBy
        })
      }
    }
  }

  const handleApplySettings = () => {
    onQualityUpdate({
      maxBitrate,
      maxFramerate,
      scaleResolutionDownBy
    })
  }

  const formatBitrate = (bitrate) => {
    if (bitrate >= 1000000) {
      return `${(bitrate / 1000000).toFixed(1)} Mbps`
    } else if (bitrate >= 1000) {
      return `${(bitrate / 1000).toFixed(0)} Kbps`
    }
    return `${bitrate} bps`
  }

  return (
    <div className="quality-settings">
      <div className="settings-section">
        <h3>Quality Presets</h3>
        <div className="preset-buttons">
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              className="btn btn-secondary preset-btn"
              onClick={() => handlePresetChange(key)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>Custom Settings</h3>

        <div className="form-group">
          <label htmlFor="bitrate-slider">Max Bitrate: {formatBitrate(maxBitrate)}</label>
          <input
            id="bitrate-slider"
            type="range"
            min="100000"
            max="5000000"
            step="100000"
            value={maxBitrate}
            onChange={(e) => setMaxBitrate(parseInt(e.target.value))}
          />
          <div className="slider-labels">
            <span>100 Kbps</span>
            <span>5 Mbps</span>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="framerate-slider">Max Frame Rate: {maxFramerate} fps</label>
          <input
            id="framerate-slider"
            type="range"
            min="10"
            max="60"
            step="1"
            value={maxFramerate}
            onChange={(e) => setMaxFramerate(parseInt(e.target.value))}
          />
          <div className="slider-labels">
            <span>10 fps</span>
            <span>60 fps</span>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="resolution-slider">Resolution Scale: {scaleResolutionDownBy}x</label>
          <input
            id="resolution-slider"
            type="range"
            min="1"
            max="4"
            step="0.5"
            value={scaleResolutionDownBy}
            onChange={(e) => setScaleResolutionDownBy(parseFloat(e.target.value))}
          />
          <div className="slider-labels">
            <span>Full (1x)</span>
            <span>Quarter (4x)</span>
          </div>
          <div className="setting-description">
            Higher values reduce resolution to save bandwidth
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleApplySettings} disabled={!isStreaming}>
          {isStreaming ? 'Apply Settings' : 'Start streaming to apply settings'}
        </button>
      </div>

      <div className="settings-section">
        <h3>Quality Guidelines</h3>
        <div className="guidelines">
          <div className="guideline-item">
            <strong>High Quality (2+ Mbps):</strong>
            <p>Best for fast, stable networks. Full resolution, smooth playback.</p>
          </div>
          <div className="guideline-item">
            <strong>Medium Quality (1 Mbps):</strong>
            <p>Good balance for most home networks. Slight resolution reduction.</p>
          </div>
          <div className="guideline-item">
            <strong>Low Quality (500 Kbps):</strong>
            <p>For slower networks or when experiencing lag. Noticeable quality reduction.</p>
          </div>
          <div className="guideline-item">
            <strong>Ultra Low (250 Kbps):</strong>
            <p>Emergency setting for very poor connections. Significant quality loss.</p>
          </div>
        </div>

        <div className="tips">
          <h4>💡 Optimization Tips</h4>
          <ul>
            <li>Start with Medium quality and adjust based on performance</li>
            <li>Lower frame rate if video appears choppy</li>
            <li>Reduce bitrate if connection keeps dropping</li>
            <li>Use resolution scaling to improve performance on slower networks</li>
            <li>Settings can be changed during streaming for real-time optimization</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default QualitySettings
