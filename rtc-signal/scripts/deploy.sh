#!/bin/bash

# Deploy script for Screen Mirror Signaling Server
set -e

echo "🚀 Deploying Screen Mirror Signaling Server..."

# Configuration
IMAGE_NAME="screen-mirror-signaling"
CONTAINER_NAME="screen-mirror-signaling"
PORT="${PORT:-8080}"

# Stop existing container if running
if docker ps -q -f name="${CONTAINER_NAME}" | grep -q .; then
    echo "🛑 Stopping existing container..."
    docker stop "${CONTAINER_NAME}"
    docker rm "${CONTAINER_NAME}"
fi

# Run the new container
echo "🏃 Starting new container on port ${PORT}..."
docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    -p "${PORT}:8080" \
    -e NODE_ENV=production \
    -e PORT=8080 \
    "${IMAGE_NAME}:latest"

# Wait for container to be ready
echo "⏳ Waiting for container to be ready..."
sleep 5

# Health check
if curl -f "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    echo "✅ Deployment successful! Server is healthy."
    echo "🌐 Server available at: http://localhost:${PORT}"
    echo "📊 Health check: http://localhost:${PORT}/health"
    echo "📈 Stats: http://localhost:${PORT}/api/stats"
else
    echo "❌ Deployment failed! Server health check failed."
    echo "📋 Container logs:"
    docker logs "${CONTAINER_NAME}"
    exit 1
fi
