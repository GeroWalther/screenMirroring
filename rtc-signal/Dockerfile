# Unified Dockerfile for dev and production
FROM node:18-alpine

# Build arguments
ARG NODE_ENV=production
ARG INSTALL_DEV=false

# Install system dependencies
RUN apk add --no-cache dumb-init

# Install nodemon globally if in dev mode
RUN if [ "$INSTALL_DEV" = "true" ]; then npm install -g nodemon; fi

# Create app user for security (production only)
RUN if [ "$NODE_ENV" = "production" ]; then \
      addgroup -g 1001 -S nodejs && \
      adduser -S appuser -u 1001 -G nodejs; \
    fi

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies based on environment
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm ci --only=production && npm cache clean --force; \
    else \
      npm install; \
    fi

# Copy application code
COPY server.js ./
COPY shared/ ./shared/

# Change ownership to app user (production only)
RUN if [ "$NODE_ENV" = "production" ]; then \
      chown -R appuser:nodejs /app; \
    fi

# Switch to app user (production only)
USER ${NODE_ENV:+appuser}

# Health check (production only)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD if [ "$NODE_ENV" = "production" ]; then \
        node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"; \
      else \
        exit 0; \
      fi

# Expose port
EXPOSE 8080

# Use dumb-init for production, direct command for dev
ENTRYPOINT ["dumb-init", "--"]

# Dynamic CMD based on environment
CMD if [ "$NODE_ENV" = "production" ]; then \
      node server.js; \
    else \
      npm run dev; \
    fi
