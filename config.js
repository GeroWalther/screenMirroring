/**
 * Configuration for Screen Mirror Application
 * Update these values for your deployment
 */

const config = {
  // Development configuration (local network)
  development: {
    signalingServer: 'ws://localhost:8080',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  },

  // Production configuration (cloud deployment)
  production: {
    // Replace with your actual signaling server URL
    signalingServer: 'wss://your-signaling-server.herokuapp.com',
    iceServers: [
      // Google's free STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },

      // Add your TURN servers for production (required for NAT traversal)
      // {
      //   urls: 'turn:your-turn-server.com:3478',
      //   username: 'your-turn-username',
      //   credential: 'your-turn-password'
      // },
      // {
      //   urls: 'turns:your-turn-server.com:5349',
      //   username: 'your-turn-username',
      //   credential: 'your-turn-password'
      // }
    ],
  },

  // Local network configuration (for office/home deployment)
  local: {
    signalingServer: 'ws://192.168.1.100:8080', // Update with your local IP
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  },
};

module.exports = config;
