# Screen Mirror - Production Deployment Strategy

## Overview

This document outlines different approaches for deploying the Screen Mirror app in production environments, from simple home setups to enterprise deployments.

## 🏠 Home/Personal Use (Recommended)

### Architecture

```
[Desktop App] ←→ [Local Signaling Server] ←→ [TV/Android Device]
     ↑                    ↑                        ↑
  192.168.1.100      192.168.1.100:8080      192.168.1.101
```

### Deployment Steps

1. **Install Desktop App** on your computer (Windows/Mac/Linux)
2. **Run Signaling Server** locally on the same computer
3. **Install TV App** on Android TV or mobile device
4. **Connect** - Everything runs on your local network

### Benefits

- ✅ No external dependencies
- ✅ Maximum privacy (nothing leaves your network)
- ✅ Low latency
- ✅ No ongoing costs
- ✅ Works offline

### Setup

```bash
# One-time setup
cd rtc-signal && npm install
cd ../senderDesktopEVR && npm install
cd ../receiverApp && npm install

# Daily usage
cd rtc-signal && npm start &  # Background
cd ../senderDesktopEVR && npm run dev
```

## 🏢 Small Office/Multiple Users

### Architecture

```
[Desktop App 1] ←→ [Dedicated Server] ←→ [Conference Room TV]
[Desktop App 2] ←→      (Pi/NUC)     ←→ [Meeting Room TV]
[Desktop App 3] ←→   192.168.1.50   ←→ [Lobby Display]
```

### Deployment Steps

1. **Setup Dedicated Server** (Raspberry Pi, Intel NUC, or spare computer)
2. **Install Signaling Server** on the dedicated machine
3. **Configure Auto-Start** for the signaling server
4. **Deploy Desktop Apps** to all computers
5. **Install TV Apps** on all displays

### Server Setup (Ubuntu/Raspberry Pi)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <your-repo>
cd ScreenMirror/rtc-signal
npm install

# Create systemd service
sudo tee /etc/systemd/system/screenmirror.service > /dev/null <<EOF
[Unit]
Description=Screen Mirror Signaling Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ScreenMirror/rtc-signal
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl enable screenmirror
sudo systemctl start screenmirror
```

## ☁️ Cloud Deployment (Advanced)

### Architecture

```
[Desktop Apps] ←→ [Cloud Server] ←→ [TV Apps Worldwide]
                   AWS/GCP/Azure
                   Load Balanced
```

### Options

#### Option 1: Docker + Cloud VM

```dockerfile
# Dockerfile for signaling server
FROM node:18-alpine
WORKDIR /app
COPY rtc-signal/package*.json ./
RUN npm ci --only=production
COPY rtc-signal/ .
EXPOSE 8080
CMD ["node", "server.js"]
```

```bash
# Deploy to cloud
docker build -t screenmirror-signal .
docker run -d -p 8080:8080 --name screenmirror screenmirror-signal
```

#### Option 2: Serverless (AWS Lambda + API Gateway)

- Convert signaling server to use WebSocket API Gateway
- Use Lambda functions for connection management
- Store connection state in DynamoDB

#### Option 3: Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: screenmirror-signaling
spec:
  replicas: 3
  selector:
    matchLabels:
      app: screenmirror-signaling
  template:
    metadata:
      labels:
        app: screenmirror-signaling
    spec:
      containers:
        - name: signaling
          image: screenmirror-signal:latest
          ports:
            - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: screenmirror-service
spec:
  selector:
    app: screenmirror-signaling
  ports:
    - port: 80
      targetPort: 8080
  type: LoadBalancer
```

## 📱 Mobile App Distribution

### Development/Testing

```bash
# Android APK
cd receiverApp
npx expo build:android

# iOS (requires Apple Developer account)
npx expo build:ios
```

### Production Distribution

#### Option 1: Private Distribution

- Build signed APKs
- Distribute via internal app store or direct download
- Use Firebase App Distribution for beta testing

#### Option 2: Public App Stores

- Publish to Google Play Store
- Publish to Apple App Store
- Add proper app icons, descriptions, privacy policy

#### Option 3: Enterprise Distribution

- Use Android Enterprise (managed Google Play)
- Use Apple Business Manager
- MDM integration for automatic deployment

## 🖥️ Desktop App Distribution

### Development

```bash
cd senderDesktopEVR
npm run build
```

### Production Packaging

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### Auto-Updates

- Implement electron-updater
- Host update server
- Code signing for Windows/macOS

## 🔧 Configuration Management

### Environment Variables

```bash
# Server
SIGNALING_PORT=8080
CORS_ORIGIN=*
LOG_LEVEL=info

# Desktop App
SIGNALING_URL=ws://your-server:8080
AUTO_UPDATE_URL=https://your-update-server.com

# Mobile App
EXPO_PUBLIC_SIGNALING_URL=ws://your-server:8080
```

### Config Files

```json
// config/production.json
{
  "signaling": {
    "url": "wss://your-domain.com",
    "port": 443,
    "ssl": true
  },
  "features": {
    "autoConnect": true,
    "qualityPresets": ["ultra-high", "high", "medium"]
  }
}
```

## 🛡️ Security Considerations

### Network Security

- Use WSS (WebSocket Secure) in production
- Implement proper CORS policies
- Use VPN for remote access
- Firewall rules to restrict access

### Authentication (Optional)

- Add room passwords
- Implement user authentication
- Use JWT tokens for session management
- Rate limiting for connections

### SSL/TLS Setup

```bash
# Using Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

## 📊 Monitoring & Logging

### Basic Monitoring

```bash
# PM2 for process management
npm install -g pm2
pm2 start server.js --name screenmirror
pm2 monit
```

### Advanced Monitoring

- Use Prometheus + Grafana
- Implement health checks
- Monitor WebRTC connection quality
- Alert on service failures

## 🚀 Recommended Production Setup

For most users, we recommend the **Home/Personal Use** approach:

1. **Keep it simple** - Run everything locally
2. **Maximum privacy** - No data leaves your network
3. **Best performance** - Lowest latency
4. **Zero ongoing costs** - No cloud bills
5. **Easy maintenance** - Minimal complexity

### Quick Production Checklist

- [ ] Desktop app auto-starts with system
- [ ] Signaling server runs as system service
- [ ] TV apps configured with correct server IP
- [ ] Network firewall allows port 8080
- [ ] Backup configuration files
- [ ] Document IP addresses for team

## 🔄 Migration Path

1. **Start** with local deployment
2. **Scale** to dedicated server if needed
3. **Move** to cloud only if required for remote access
4. **Add** authentication and monitoring as needed

This approach lets you start simple and grow as your needs evolve!
