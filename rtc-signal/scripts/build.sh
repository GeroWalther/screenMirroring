#!/bin/bash

# Build script for Screen Mirror Signaling Server
set -e

echo "🐳 Building Screen Mirror Signaling Server Docker image..."

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
IMAGE_NAME="screen-mirror-signaling"
DOCKER_TAG="${IMAGE_NAME}:${VERSION}"
DOCKER_TAG_LATEST="${IMAGE_NAME}:latest"

echo "📦 Building version: ${VERSION}"

# Build the Docker image
docker build -t "${DOCKER_TAG}" -t "${DOCKER_TAG_LATEST}" .

echo "✅ Build complete!"
echo "📋 Image tags created:"
echo "   - ${DOCKER_TAG}"
echo "   - ${DOCKER_TAG_LATEST}"

# Optional: Show image size
echo "📏 Image size:"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
