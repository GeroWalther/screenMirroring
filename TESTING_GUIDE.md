# Screen Mirror - Local Testing Guide

## Overview

This guide explains how to test the Screen Mirror app on your local network without using NGROK or external services.

## Prerequisites

- Both devices (sender and receiver) must be on the same WiFi network
- Desktop app (sender) running on your computer
- Android TV app (receiver) installed and running on your TV/Android device
- Signaling server running locally

## Setup Steps

### 1. Start the Signaling Server

```bash
cd rtc-signal
npm install
npm start
```

The server will run on port 8080 by default.

### 2. Find Your Computer's IP Address

**On macOS/Linux:**

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Windows:**

```bash
ipconfig
```

Look for your WiFi adapter's IP address (usually starts with 192.168.x.x or 10.x.x.x).

### 3. Update the Receiver App (if needed)

The receiver app now auto-detects your computer's IP, but you may need to update it:

**Option A: Quick Update (for testing)**

1. Open the receiver app on your TV
2. Tap "Settings" button
3. Tap "Change Server"
4. Enter: `ws://YOUR_COMPUTER_IP:8080`

**Option B: Code Update (recommended)**
In `receiverApp/components/ScreenReceiver.tsx`, update line 39:

```typescript
return 'ws://YOUR_COMPUTER_IP:8080'; // Replace with your computer's IP
```

### 4. Install and Run the Receiver App

```bash
cd receiverApp
npm install
npx expo run:android  # For Android TV
```

### 5. Run the Desktop Sender App

```bash
cd senderDesktopEVR
npm install
npm run dev
```

## Testing the Connection

### Method 1: Manual Connection

1. Open the desktop app
2. Go to "TV Discovery" tab
3. In the "Manual Connection" section, enter your TV's IP address
4. Click "Connect to TV"
5. Select the screen/window you want to share

### Method 2: Auto Discovery (if mDNS works)

1. Open the desktop app
2. Go to "TV Discovery" tab
3. Click "Discover TVs on Network"
4. Your TV should appear in the list
5. Click "Connect" next to your TV

## Troubleshooting

### TV Not Found During Discovery

- **Solution**: Use manual connection with the TV's IP address
- mDNS discovery requires additional setup on the receiver side

### Connection Fails

1. Check that both devices are on the same network
2. Verify the signaling server is running
3. Check firewall settings - port 8080 should be accessible
4. Look at the debug logs in the desktop app console

### Poor Video Quality

- The app defaults to Ultra High quality (5 Mbps, 60fps)
- If experiencing issues, go to "Quality" tab and select a lower preset
- Reduce bitrate or frame rate for slower networks

### WebRTC Connection Issues

1. Check that WebSocket connection to signaling server works
2. Ensure both apps are using the same room name (default: "default")
3. Try restarting both apps

## Network Requirements

- **Minimum bandwidth**: 1 Mbps for basic quality
- **Recommended bandwidth**: 5+ Mbps for high quality
- **Port requirements**: 8080 for signaling server
- **Protocol**: WebSocket (WS) and WebRTC

## Debug Logging

The desktop app now includes extensive debug logging:

- Open Developer Tools (F12) to see console logs
- Look for messages with emojis (🔍, 📺, ✅, ❌) for key events
- All connection attempts and status changes are logged

## IP Address Examples

- Your computer: `192.168.1.100`
- Your TV: `192.168.1.101`
- Signaling server: `ws://192.168.1.100:8080`

## Quick Start Commands

```bash
# Terminal 1 - Start signaling server
cd rtc-signal && npm start

# Terminal 2 - Start desktop app
cd senderDesktopEVR && npm run dev

# Terminal 3 - Install receiver app (one time)
cd receiverApp && npx expo run:android
```

## Notes

- No NGROK needed - everything runs locally
- The receiver app will show the signaling server IP on screen
- Use the system tray menu for quick connections
- Settings window can be minimized - app runs in background
