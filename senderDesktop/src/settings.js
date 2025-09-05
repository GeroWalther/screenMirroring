/**
 * Settings Window Logic for Screen Mirror Tray App
 * Handles quality settings, TV discovery, and connection status
 */

class SettingsApp {
  constructor() {
    this.isStreaming = false;
    this.statsInterval = null;

    // Quality presets
    this.presets = {
      cinema: {
        maxBitrate: 8000000,
        maxFramerate: 30,
        scaleResolutionDownBy: 1,
      },
      smooth: {
        maxBitrate: 6000000,
        maxFramerate: 60,
        scaleResolutionDownBy: 1.5,
      },
      battery: {
        maxBitrate: 4000000,
        maxFramerate: 30,
        scaleResolutionDownBy: 1.2,
      },
    };

    this.initializeUI();
  }

  initializeUI() {
    // Get DOM elements
    this.elements = {
      statusDot: document.getElementById('status-dot'),
      statusText: document.getElementById('status-text'),
      bitrateSlider: document.getElementById('bitrate-slider'),
      bitrateValue: document.getElementById('bitrate-value'),
      framerateSlider: document.getElementById('framerate-slider'),
      framerateValue: document.getElementById('framerate-value'),
      serverInput: document.getElementById('server-input'),
      discoverBtn: document.getElementById('discover-btn'),
      tvList: document.getElementById('tv-list'),
      statsSection: document.getElementById('stats-section'),
      statBitrate: document.getElementById('stat-bitrate'),
      statFramerate: document.getElementById('stat-framerate'),
      statPacketloss: document.getElementById('stat-packetloss'),
      statRtt: document.getElementById('stat-rtt'),
    };

    // Bind event listeners
    this.bindEvents();

    // Load saved settings
    this.loadSettings();

    // Set initial status
    this.updateStatus('disconnected', 'Use system tray to connect');

    console.log('Settings window initialized');
  }

  bindEvents() {
    // Quality sliders
    this.elements.bitrateSlider.addEventListener('input', (e) => {
      this.elements.bitrateValue.textContent = e.target.value;
      this.saveSettings();
    });

    this.elements.framerateSlider.addEventListener('input', (e) => {
      this.elements.framerateValue.textContent = e.target.value;
      this.saveSettings();
    });

    // Quality presets
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const preset = e.target.dataset.preset;
        this.applyPreset(preset);
      });
    });

    // Server input
    this.elements.serverInput.addEventListener('change', () => {
      this.saveSettings();
    });

    // Discover button
    this.elements.discoverBtn.addEventListener('click', () => {
      this.discoverTVs();
    });
  }

  applyPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) return;

    // Update UI
    this.elements.bitrateSlider.value = Math.round(preset.maxBitrate / 1000000);
    this.elements.bitrateValue.textContent = this.elements.bitrateSlider.value;
    this.elements.framerateSlider.value = preset.maxFramerate;
    this.elements.framerateValue.textContent = preset.maxFramerate;

    console.log(`Applied ${presetName} preset`);

    // Visual feedback
    document
      .querySelectorAll('.preset-btn')
      .forEach((btn) => btn.classList.remove('active'));
    document
      .querySelector(`[data-preset="${presetName}"]`)
      .classList.add('active');

    // Save settings
    this.saveSettings();
  }

  discoverTVs() {
    console.log('Discovering TVs...');

    // Disable button during discovery
    this.elements.discoverBtn.disabled = true;
    this.elements.discoverBtn.textContent = '🔍 Discovering...';

    // Simulate discovery process
    setTimeout(() => {
      this.updateTVList([
        { name: 'Living Room TV', ip: '192.168.1.100', status: 'online' },
        { name: 'Bedroom TV', ip: '192.168.1.101', status: 'online' },
        { name: 'Kitchen TV', ip: '192.168.1.102', status: 'offline' },
        { name: 'Office TV', ip: '192.168.1.103', status: 'online' },
      ]);

      // Re-enable button
      this.elements.discoverBtn.disabled = false;
      this.elements.discoverBtn.textContent = '🔍 Discover TVs';

      console.log('TV discovery completed');
    }, 2000);
  }

  updateTVList(tvs) {
    this.elements.tvList.innerHTML = '';

    tvs.forEach((tv) => {
      const tvItem = document.createElement('div');
      tvItem.className =
        'flex justify-between items-center py-2 border-b border-dark-accent';

      const statusIcon = tv.status === 'online' ? '🟢' : '🔴';

      tvItem.innerHTML = `
        <span>${statusIcon} 📺 ${tv.name}</span>
        <span class="text-xs">${tv.ip}</span>
      `;

      this.elements.tvList.appendChild(tvItem);
    });
  }

  updateStatus(status, message) {
    // Update status dot
    this.elements.statusDot.className = `status-dot ${status}`;

    // Update status text
    this.elements.statusText.textContent = message;

    // Show/hide stats section based on streaming status
    this.isStreaming = status === 'streaming' || status === 'connected';
    if (this.isStreaming) {
      this.elements.statsSection.classList.remove('hidden');
      this.startStatsUpdates();
    } else {
      this.elements.statsSection.classList.add('hidden');
      this.stopStatsUpdates();
    }
  }

  startStatsUpdates() {
    if (this.statsInterval) return;

    this.statsInterval = setInterval(() => {
      // Simulate stats for demo
      this.updateStats({
        bitrate: Math.floor(Math.random() * 2000) + 4000,
        framerate: Math.floor(Math.random() * 10) + 25,
        packetLoss: (Math.random() * 2).toFixed(1),
        rtt: Math.floor(Math.random() * 50) + 10,
      });
    }, 2000);
  }

  stopStatsUpdates() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Reset stats display
    this.elements.statBitrate.textContent = '-';
    this.elements.statFramerate.textContent = '-';
    this.elements.statPacketloss.textContent = '-';
    this.elements.statRtt.textContent = '-';
  }

  updateStats(stats) {
    this.elements.statBitrate.textContent = `${Math.round(stats.bitrate / 1000)} kbps`;
    this.elements.statFramerate.textContent = `${stats.framerate} fps`;
    this.elements.statPacketloss.textContent = `${stats.packetLoss}%`;
    this.elements.statRtt.textContent = `${stats.rtt} ms`;
  }

  saveSettings() {
    const settings = {
      server: this.elements.serverInput.value,
      bitrate: this.elements.bitrateSlider.value,
      framerate: this.elements.framerateSlider.value,
    };

    localStorage.setItem('screenMirrorSettings', JSON.stringify(settings));
    console.log('Settings saved:', settings);
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('screenMirrorSettings');
      if (saved) {
        const settings = JSON.parse(saved);

        if (settings.server) this.elements.serverInput.value = settings.server;
        if (settings.bitrate) {
          this.elements.bitrateSlider.value = settings.bitrate;
          this.elements.bitrateValue.textContent = settings.bitrate;
        }
        if (settings.framerate) {
          this.elements.framerateSlider.value = settings.framerate;
          this.elements.framerateValue.textContent = settings.framerate;
        }

        console.log('Settings loaded:', settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  // Public API for main process to call
  setConnectionStatus(status, message, tvName) {
    if (status === 'connected' && tvName) {
      this.updateStatus('streaming', `Connected to ${tvName}`);
    } else if (status === 'disconnected') {
      this.updateStatus('disconnected', 'Use system tray to connect');
    } else if (status === 'connecting') {
      this.updateStatus('connecting', `Connecting to ${tvName}...`);
    } else if (status === 'error') {
      this.updateStatus('error', message || 'Connection failed');
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.settingsApp = new SettingsApp();

  // Expose API for main process
  if (window.electronAPI) {
    window.electronAPI.onStatusUpdate((status, message, tvName) => {
      window.settingsApp.setConnectionStatus(status, message, tvName);
    });
  }
});
