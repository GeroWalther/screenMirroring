# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Screen Mirror is a WebRTC-based screen sharing solution with three main components:
- **Electron sender app** (senderDesktopEVR): Desktop app for screen capture and streaming
- **React Native receiver app** (receiverApp): Android TV/mobile app for displaying streams
- **WebSocket signaling server** (rtc-signal): Handles WebRTC signaling and room management

The project implements robust exponential backoff reconnection, system tray integration, mDNS discovery, and production-ready Docker deployment.

## Development Commands

### Quick Start (All Components)
```bash
# Start signaling server (required first)
cd rtc-signal && npm start &

# Start desktop sender app
cd senderDesktopEVR && npm run dev

# Start receiver app (in separate terminal)
cd receiverApp && npm start
```

### Signaling Server (rtc-signal)
```bash
cd rtc-signal

# Development
npm install
npm start                    # Production server on port 8080
npm run dev                  # Development with nodemon

# Docker deployment
npm run docker:prod          # Production Docker Compose
npm run docker:dev           # Development Docker with rebuild
npm run docker:down          # Stop all containers
npm run docker:logs          # View container logs
npm run docker:health        # Check server health

# Direct Docker commands
docker-compose up -d         # Start in background
curl http://localhost:8080/health  # Health check
```

### Desktop Sender App (senderDesktopEVR)
```bash
cd senderDesktopEVR

# Development
npm install
npm run dev                  # Start with hot reload
npm start                   # Start built version (run build first)

# Building
npm run build               # Build for development
npm run build:unpack       # Build unpacked version
npm run build:win          # Build Windows installer
npm run build:mac          # Build macOS installer
npm run build:linux        # Build Linux installer

# Code quality
npm run lint                # ESLint
npm run format             # Prettier formatting
```

### React Native Receiver App (receiverApp)
```bash
cd receiverApp

# Development
npm install
npm start                   # Start Expo dev server
npm run android             # Run on Android device/emulator
npm run ios                 # Run on iOS device/simulator
npm run web                 # Run in web browser

# Code quality
npm run lint               # ESLint
```

### Testing Commands
```bash
# Run specific component tests
cd rtc-signal && npm test
cd senderDesktopEVR && npm test
cd receiverApp && npm test

# Local network testing (see TESTING_GUIDE.md)
# 1. Start signaling server: cd rtc-signal && npm start
# 2. Find local IP: ifconfig | grep "inet " | grep -v 127.0.0.1
# 3. Update receiver app with IP address
# 4. Run both apps on same network
```

## Architecture

### Core Components

**SignalingClient (rtc-signal/shared/signaling.js)**
- Exponential backoff WebSocket client with configurable retry logic
- Jitter prevention to avoid thundering herd problems
- Event-driven architecture with callbacks for all connection states
- Used by both sender and receiver for consistent behavior

**WebRTC Connection Flow**
1. Receiver connects to signaling server as "answerer"
2. Sender connects as "offerer" and initiates WebRTC handshake
3. SDP offer/answer and ICE candidates exchanged through signaling server
4. Direct peer-to-peer connection established for media streaming
5. Auto-reconnection on network disruptions

**System Tray Integration (Electron Main Process)**
- Lives in system tray/menu bar with 📱 emoji icon
- Context menu for TV discovery, connection management, and settings
- mDNS/Bonjour discovery for automatic TV detection
- Balloon notifications for connection status updates

### Key Files Structure

```
rtc-signal/
├── server.js              # WebSocket signaling server with room management
├── shared/signaling.js     # Reusable SignalingClient class
└── docker-compose.yml      # Production Docker deployment

senderDesktopEVR/src/
├── main/index.js           # Electron main process (tray, mDNS, IPC)
├── renderer/src/utils/ScreenSender.js  # WebRTC sender logic
├── renderer/src/hooks/useScreenSender.js  # React hook wrapper
└── preload/index.js        # Secure IPC bridge

receiverApp/
├── App.tsx                 # React Navigation setup
├── components/ScreenReceiver.tsx  # Main WebRTC receiver component
└── utils/signaling.js      # Signaling client integration
```

### Technology Stack

**Desktop App (Electron + React)**
- electron-vite for build tooling
- TailwindCSS for styling
- bonjour-service for mDNS discovery
- System tray integration with native menus

**Mobile App (React Native + Expo)**
- react-native-webrtc for WebRTC support
- React Navigation for routing
- Expo for development and building
- Android TV/Leanback launcher support

**Signaling Server (Node.js)**
- Express.js HTTP server
- ws WebSocket library
- Docker/Docker Compose for deployment
- Health check endpoints for monitoring

### Connection States & Lifecycle

The system tracks these connection states:
- `disconnected`: No active connections
- `connecting`: Establishing WebSocket connection
- `connected`: WebSocket connected, ready for WebRTC
- `webrtc-connecting`: WebRTC handshake in progress
- `streaming`: Active media streaming
- `reconnecting`: Exponential backoff retry in progress
- `error`: Connection failed

### Configuration Management

**Environment-based config (config.js)**
- Development: localhost:8080
- Production: WSS with custom domain
- Local: configurable LAN IP address
- STUN/TURN server configuration

**Quality Presets**
- Cinema: 1080p30 @ 8 Mbps
- Smooth: 720p60 @ 6 Mbps  
- Battery Saver: 900p30 @ 4 Mbps

## Important Patterns

### Error Handling
- All WebSocket connections use exponential backoff with jitter
- WebRTC peer connections auto-recreate on signaling reconnection
- UI shows real-time connection status with appropriate visual feedback
- Failed connections trigger automatic cleanup and retry logic

### Resource Management
- WebSocket connections properly closed on app termination
- WebRTC peer connections and media streams cleaned up on disconnect
- Electron app prevents multiple instances with single-instance lock
- System tray persists even when settings window is closed

### Security Considerations  
- WebSocket connections support both WS (development) and WSS (production)
- CORS configuration for signaling server
- Electron webSecurity disabled only for screen capture requirements
- Room-based isolation prevents cross-session interference

### Development Workflow
- Signaling server must start first (port 8080)
- Desktop app auto-detects local IP for receiver configuration
- Use `npm run dev` for all components during active development
- Docker deployment for production/testing environments
- mDNS discovery works automatically on local networks

When working with WebRTC connections, always ensure proper cleanup of peer connections and media tracks. The SignalingClient handles reconnection automatically, but WebRTC peer connections need to be recreated after signaling reconnection.
