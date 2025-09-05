/**
 * Electron Sender App - Main UI Logic
 * Handles UI interactions and integrates with WebRTC sender
 */

import ScreenSender from './webrtc.js';

class SenderApp {
  constructor() {
    this.sender = null;
    this.isSharing = false;
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
      roomInput: document.getElementById('room-input'),
      serverInput: document.getElementById('server-input'),
      startBtn: document.getElementById('start-btn'),
      stopBtn: document.getElementById('stop-btn'),
      statusDot: document.getElementById('status-dot'),
      statusText: document.getElementById('status-text'),
      bitrateSlider: document.getElementById('bitrate-slider'),
      bitrateValue: document.getElementById('bitrate-value'),
      framerateSlider: document.getElementById('framerate-slider'),
      framerateValue: document.getElementById('framerate-value'),
      logContainer: document.getElementById('log-container'),
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

    this.log('Application initialized');
  }

  bindEvents() {
    // Start/Stop buttons
    this.elements.startBtn.addEventListener('click', () => this.startSharing());
    this.elements.stopBtn.addEventListener('click', () => this.stopSharing());

    // Quality sliders
    this.elements.bitrateSlider.addEventListener('input', (e) => {
      this.elements.bitrateValue.textContent = e.target.value;
      this.applyQualitySettings();
    });

    this.elements.framerateSlider.addEventListener('input', (e) => {
      this.elements.framerateValue.textContent = e.target.value;
      this.applyQualitySettings();
    });

    // Quality presets
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const preset = e.target.dataset.preset;
        this.applyPreset(preset);
      });
    });

    // Save settings on change
    this.elements.roomInput.addEventListener('change', () =>
      this.saveSettings()
    );
    this.elements.serverInput.addEventListener('change', () =>
      this.saveSettings()
    );

    // Window close handler
    window.addEventListener('beforeunload', () => {
      if (this.sender) {
        this.sender.stop();
      }
    });
  }

  async startSharing() {
    try {
      const room = this.elements.roomInput.value.trim();
      const server = this.elements.serverInput.value.trim();

      if (!room || !server) {
        this.log('Error: Room code and server URL are required', 'error');
        return;
      }

      this.log(`Starting screen share for room: ${room}`);
      this.updateUI(true);

      // Create sender with callbacks
      this.sender = new ScreenSender({
        signalingUrl: server,
        room: room,
        onStatusChange: (status, data) => this.handleStatusChange(status, data),
        onStreamStarted: () => this.handleStreamStarted(),
        onStreamEnded: () => this.handleStreamEnded(),
        onError: (error) => this.handleError(error),
      });

      // Start the sender
      await this.sender.start();
    } catch (error) {
      this.log(`Failed to start sharing: ${error.message}`, 'error');
      this.handleError(error);
    }
  }

  stopSharing() {
    if (this.sender) {
      this.log('Stopping screen share...');
      this.sender.stop();
      this.sender = null;
    }

    this.isSharing = false;
    this.updateUI(false);
    this.stopStatsUpdates();
  }

  handleStatusChange(status, data = {}) {
    let statusText = '';
    let statusClass = '';

    switch (status) {
      case 'starting':
        statusText = 'Starting...';
        statusClass = 'connecting';
        break;
      case 'connected':
        statusText = 'Connected to server';
        statusClass = 'connected';
        break;
      case 'webrtc-connecting':
        statusText = 'Establishing connection...';
        statusClass = 'connecting';
        break;
      case 'webrtc-connected':
        statusText = 'Streaming active';
        statusClass = 'streaming';
        this.startStatsUpdates();
        break;
      case 'reconnecting':
        statusText = `Reconnecting... (${data.attempt})`;
        statusClass = 'reconnecting';
        break;
      case 'reconnected':
        statusText = 'Reconnected';
        statusClass = 'connected';
        break;
      case 'disconnected':
        statusText = 'Disconnected';
        statusClass = 'disconnected';
        break;
      case 'error':
      case 'failed':
        statusText = 'Connection failed';
        statusClass = 'error';
        break;
      case 'stopped':
        statusText = 'Stopped';
        statusClass = 'disconnected';
        break;
      default:
        statusText = status;
        statusClass = 'unknown';
    }

    this.updateStatus(statusText, statusClass);
    this.log(`Status: ${statusText}`);
  }

  handleStreamStarted() {
    this.log('Screen sharing started successfully', 'success');
    this.isSharing = true;
    this.elements.statsSection.classList.remove('hidden');

    // Apply initial quality settings
    this.applyQualitySettings();
  }

  handleStreamEnded() {
    this.log('Screen sharing ended');
    this.isSharing = false;
    this.elements.statsSection.classList.add('hidden');
    this.stopStatsUpdates();
  }

  handleError(error) {
    this.log(`Error: ${error.message || error}`, 'error');
    this.updateStatus('Error', 'error');
    this.updateUI(false);
  }

  applyPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) return;

    // Update UI
    this.elements.bitrateSlider.value = Math.round(preset.maxBitrate / 1000000);
    this.elements.bitrateValue.textContent = this.elements.bitrateSlider.value;
    this.elements.framerateSlider.value = preset.maxFramerate;
    this.elements.framerateValue.textContent = preset.maxFramerate;

    // Apply to sender
    this.applyQualitySettings();

    this.log(`Applied ${presetName} preset`);

    // Visual feedback
    document
      .querySelectorAll('.preset-btn')
      .forEach((btn) => btn.classList.remove('active'));
    document
      .querySelector(`[data-preset="${presetName}"]`)
      .classList.add('active');
  }

  async applyQualitySettings() {
    if (!this.sender || !this.isSharing) return;

    const bitrate = parseInt(this.elements.bitrateSlider.value) * 1000000; // Convert to bps
    const framerate = parseInt(this.elements.framerateSlider.value);

    try {
      await this.sender.setEncodingParameters({
        maxBitrate: bitrate,
        maxFramerate: framerate,
      });

      this.log(
        `Quality updated: ${Math.round(bitrate / 1000000)}Mbps @ ${framerate}fps`
      );
    } catch (error) {
      this.log(`Failed to update quality: ${error.message}`, 'error');
    }
  }

  startStatsUpdates() {
    if (this.statsInterval) return;

    this.statsInterval = setInterval(async () => {
      if (!this.sender || !this.isSharing) {
        this.stopStatsUpdates();
        return;
      }

      try {
        const stats = await this.sender.getStats();
        this.updateStats(stats);
      } catch (error) {
        console.error('Failed to get stats:', error);
      }
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

  async updateStats(statsReport) {
    let bitrate = 0;
    let framerate = 0;
    let packetsLost = 0;
    let packetsSent = 0;
    let rtt = 0;

    statsReport.forEach((stat) => {
      if (stat.type === 'outbound-rtp' && stat.mediaType === 'video') {
        bitrate = Math.round((stat.bytesSent * 8) / 1000); // kbps
        framerate = stat.framesPerSecond || 0;
      }

      if (stat.type === 'remote-inbound-rtp' && stat.mediaType === 'video') {
        packetsLost = stat.packetsLost || 0;
        packetsSent = stat.packetsSent || 0;
        rtt = Math.round(stat.roundTripTime * 1000) || 0; // ms
      }
    });

    // Update UI
    this.elements.statBitrate.textContent = `${bitrate} kbps`;
    this.elements.statFramerate.textContent = `${framerate} fps`;

    const lossRate =
      packetsSent > 0 ? ((packetsLost / packetsSent) * 100).toFixed(1) : 0;
    this.elements.statPacketloss.textContent = `${lossRate}%`;

    this.elements.statRtt.textContent = `${rtt} ms`;
  }

  updateStatus(text, className) {
    this.elements.statusText.textContent = text;
    this.elements.statusDot.className = `status-dot ${className}`;
  }

  updateUI(isSharing) {
    this.elements.startBtn.disabled = isSharing;
    this.elements.stopBtn.disabled = !isSharing;
    this.elements.roomInput.disabled = isSharing;
    this.elements.serverInput.disabled = isSharing;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `<span class="log-time">${timestamp}</span> ${message}`;

    this.elements.logContainer.appendChild(logEntry);
    this.elements.logContainer.scrollTop =
      this.elements.logContainer.scrollHeight;

    // Keep only last 50 log entries
    while (this.elements.logContainer.children.length > 50) {
      this.elements.logContainer.removeChild(
        this.elements.logContainer.firstChild
      );
    }

    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  saveSettings() {
    const settings = {
      room: this.elements.roomInput.value,
      server: this.elements.serverInput.value,
      bitrate: this.elements.bitrateSlider.value,
      framerate: this.elements.framerateSlider.value,
    };

    localStorage.setItem('senderSettings', JSON.stringify(settings));
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('senderSettings');
      if (saved) {
        const settings = JSON.parse(saved);

        if (settings.room) this.elements.roomInput.value = settings.room;
        if (settings.server) this.elements.serverInput.value = settings.server;
        if (settings.bitrate) {
          this.elements.bitrateSlider.value = settings.bitrate;
          this.elements.bitrateValue.textContent = settings.bitrate;
        }
        if (settings.framerate) {
          this.elements.framerateSlider.value = settings.framerate;
          this.elements.framerateValue.textContent = settings.framerate;
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SenderApp();
});
