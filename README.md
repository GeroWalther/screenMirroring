# Screen Mirror - WebRTC Screen Sharing with Exponential Backoff Reconnection

A complete screen mirroring solution with Electron sender (Mac/Windows) → React Native receiver (Google TV/Android TV) via WebRTC with robust exponential backoff reconnection.

## 🚀 Features Implemented

### ✅ **Exponential Backoff Reconnection**

- **Smart retry logic**: 1s → 2s → 4s → 8s → 16s → 30s (capped)
- **Jitter prevention**: Randomized delays prevent thundering herd
- **Automatic recovery**: Reconnects WebSocket + re-establishes WebRTC
- **Status tracking**: Real-time connection status with UI feedback

### ✅ **Electron Sender App** (System Tray)

- **System tray integration**: Lives in status bar (Mac) / system tray (Windows)
- **Emoji-based interface**: Clean, intuitive 📱 icon with dropdown menu
- **TV discovery**: Automatic mDNS discovery + manual TV list
- **One-click connection**: Connect to any discovered TV instantly
- **Settings window**: Quality presets, custom bitrate/framerate controls
- **Real-time stats**: Live connection monitoring when streaming
- **Modern UI**: Built with TailwindCSS for responsive, professional design

### ✅ **React Native Receiver**

- **Full-screen streaming**: Optimized for Android TV/Google TV
- **Touch controls**: Tap to show/hide controls with auto-timeout
- **Connection monitoring**: Visual status indicators and reconnection feedback
- **TV-optimized UI**: Large text, simple controls, immersive experience

### ✅ **Signaling Server**

- **WebSocket-based**: Fast, lightweight signaling with heartbeat
- **Room management**: Automatic cleanup of dead connections
- **Exponential backoff**: Server-side connection health monitoring

## 📁 Project Structure

```
ScreenMirror/
├── rtc-signal/                 # WebRTC signaling server (Dockerized)
│   ├── server.js            # WebSocket signaling server with heartbeat
│   ├── shared/              # Shared signaling client library
│   │   └── signaling.js     # SignalingClient with exponential backoff
│   ├── Dockerfile           # Production-ready Docker image
│   ├── docker-compose.yml   # Docker Compose configuration
│   ├── scripts/             # Deployment automation
│   └── package.json         # Server dependencies + Docker scripts
├── senderDesktop/           # Electron sender application
│   ├── src/
│   │   ├── index.html       # Main UI with TailwindCSS styling
│   │   ├── input.css        # TailwindCSS input file
│   │   ├── index.css        # Generated TailwindCSS output
│   │   ├── app.js           # UI logic and event handling
│   │   ├── webrtc.js        # WebRTC + signaling integration
│   │   └── index.js         # Electron main process
│   ├── tailwind.config.js   # TailwindCSS configuration
│   └── package.json         # Electron + TailwindCSS dependencies
└── receiverApp/             # React Native receiver (simplified)
    ├── components/
    │   └── ScreenReceiver.tsx # Full WebRTC receiver component
    ├── App.tsx              # Main app with stack navigation
    ├── index.js             # App entry point
    ├── app.json             # Android TV configuration
    └── package.json          # RN dependencies (react-native-webrtc, navigation)
```

## 🔧 Setup & Installation

### 1. **Start Signaling Server** (Docker Recommended)

**Option A: Docker (Recommended)**

```bash
cd rtc-signal
npm run docker:up
# Server runs on http://localhost:8080
# Health check: http://localhost:8080/health
```

**Option B: Local Development**

```bash
cd rtc-signal
npm install
npm start
# Server runs on http://localhost:8080
```

### 2. **Run Electron Sender** (System Tray)

```bash
cd senderDesktop
npm install
npm run build-css  # Build TailwindCSS styles
npm start
# Launches system tray app - look for 📱 icon in your status bar
```

**Usage:**

- **Mac**: Click 📱 icon in top menu bar
- **Windows**: Click 📱 icon in system tray (bottom right)
- **Menu options**:
  - `📺 Connect to...` → Select TV from discovered list
  - `🔴 Disconnect` → Stop current stream
  - `⚙️ Settings` → Open settings window
  - `🔍 Discover TVs` → Scan for new TVs

### 3. **Run React Native Receiver**

```bash
cd receiverApp
npm install
# Run on Android TV/Google TV:
npx expo run:android
# Or for development:
npm start
```

## 🎯 How It Works

### **Connection Flow**

1. **Signaling server** starts and listens for WebSocket connections
2. **Receiver** connects first, joins room as "answerer"
3. **Sender** connects, joins same room as "offerer"
4. **WebRTC handshake**: SDP offer/answer + ICE candidate exchange
5. **Stream starts**: Sender captures screen, receiver displays fullscreen

### **Reconnection Flow**

1. **Connection drops** → SignalingClient detects WebSocket close
2. **Exponential backoff** → Waits 1s, then 2s, 4s, 8s, etc.
3. **Reconnect** → Establishes new WebSocket connection
4. **Rejoin room** → Sends join message to signaling server
5. **Re-establish WebRTC** → Creates new peer connection, exchanges SDP/ICE
6. **Resume streaming** → Video stream continues seamlessly

### **Quality Management**

- **Presets**: One-click quality profiles for different use cases
- **Dynamic adjustment**: Change bitrate/framerate during streaming
- **H.264 preference**: Optimized codec ordering for Android TV
- **Stats monitoring**: Real-time connection quality feedback

## 🛠 Key Implementation Details

### **SignalingClient Features**

- **Configurable retry**: Custom delays, max retries, multipliers
- **Event-driven**: Callbacks for all connection states
- **Jitter handling**: Random delays prevent server overload
- **Resource cleanup**: Proper WebSocket lifecycle management

### **WebRTC Optimizations**

- **H.264 codec preference**: Better Android TV compatibility
- **Encoding parameters**: Runtime bitrate/framerate control
- **Connection monitoring**: Automatic failure detection
- **Stream management**: Proper track cleanup on disconnect

### **UI/UX Features**

- **Real-time status**: Visual indicators for all connection states
- **Auto-hide controls**: TV-friendly interface with timeout
- **Responsive design**: Works on desktop and mobile screens
- **Dark theme**: Modern, professional appearance

## 📊 Connection States

| State               | Sender | Receiver | Description               |
| ------------------- | ------ | -------- | ------------------------- |
| `disconnected`      | 🔴     | 🔴       | No connection             |
| `connecting`        | 🟡     | 🟡       | Establishing WebSocket    |
| `connected`         | 🟢     | 🟢       | WebSocket connected       |
| `webrtc-connecting` | 🟡     | 🟡       | WebRTC handshake          |
| `streaming`         | 🔵     | 🔵       | Active video stream       |
| `reconnecting`      | 🟠     | 🟠       | Exponential backoff retry |
| `error`             | 🔴     | 🔴       | Connection failed         |

## 🎮 Usage

### **Sender (Desktop)**

1. Enter room code (default: "livingroom")
2. Set signaling server URL (default: ws://localhost:8080)
3. Click "Start Sharing" → Select screen/window
4. Adjust quality with presets or manual sliders
5. Monitor connection stats in real-time

### **Receiver (Android TV)**

1. Launch app on Google TV/Android TV
2. Shows room code and "Waiting for screen share..."
3. Tap screen to show/hide controls
4. Automatic reconnection on network issues
5. Full-screen video with contain aspect ratio

## 🔧 Configuration

### **Quality Presets**

- **Cinema**: 1080p30 @ 8 Mbps (best quality)
- **Smooth**: 720p60 @ 6 Mbps (smooth motion)
- **Battery Saver**: 900p30 @ 4 Mbps (efficiency)

### **Reconnection Settings**

```javascript
// Customizable in SignalingClient
{
  initialRetryDelay: 1000,    // Start with 1s
  maxRetryDelay: 30000,       // Cap at 30s
  retryMultiplier: 2,         // Double each time
  maxRetries: Infinity        // Retry forever
}
```

## 🚀 Production Ready

- ✅ **Robust reconnection** with exponential backoff
- ✅ **Clean resource management** prevents memory leaks
- ✅ **Error handling** for all failure scenarios
- ✅ **Modern UI** with responsive design
- ✅ **WebRTC optimizations** for Android TV
- ✅ **Real-time monitoring** and stats
- ✅ **Configurable quality** settings
- ✅ **Production-grade signaling** server

This implementation provides a complete, production-ready screen mirroring solution with enterprise-level reliability and user experience.
