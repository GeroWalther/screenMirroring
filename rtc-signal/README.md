# Screen Mirror - WebRTC Signaling Server

WebRTC signaling server with hot reload development and production Docker deployment.

## 🚀 Quick Start

### Development (Hot Reload)

```bash
# Local development (fastest)
npm install
npm run dev

#Or Docker development (with hot reload)
npm run docker:dev
```

### Production

```bash
# Docker production
npm run docker:prod

# Or pull from Docker Hub
docker pull gero253/screen-mirror-signaling:latest
docker run -d -p 8080:8080 gero253/screen-mirror-signaling:latest
```

## 📊 Monitoring

```bash
# Health check
curl http://localhost:8080/health

# Statistics
curl http://localhost:8080/api/stats

# Container logs
npm run docker:logs
```

## 🛠️ Commands

```bash
# Development
npm run dev              # Local hot reload
npm run docker:dev       # Docker hot reload

# Production
npm run docker:prod      # Docker production
npm run docker:down      # Stop containers
npm run docker:logs      # View logs
npm run docker:health    # Health check

# Direct Docker
docker pull gero253/screen-mirror-signaling:latest
docker run -d -p 8080:8080 gero253/screen-mirror-signaling:latest
```

## 📁 Files

```
rtc-signal/
├── Dockerfile              # Unified dev/prod build
├── docker-compose.yml      # Production config
├── docker-compose.dev.yml  # Development config
├── server.js              # Main server
├── shared/signaling.js    # WebRTC client
└── package.json           # Dependencies & scripts
```
