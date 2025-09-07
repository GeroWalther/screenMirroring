/**
 * WebSocket signaling client with exponential backoff reconnection
 * Used by React Native receiver app
 */

export class SignalingClient {
  constructor(url, options = {}) {
    this.url = url;
    this.ws = null;
    this.retryDelay = options.initialRetryDelay || 1000;
    this.maxRetryDelay = options.maxRetryDelay || 30000;
    this.retryMultiplier = options.retryMultiplier || 2;
    this.maxRetries = options.maxRetries || Infinity;
    this.retryCount = 0;
    this.isConnecting = false;
    this.shouldReconnect = true;

    // Event handlers
    this.onOpen = options.onOpen || (() => {});
    this.onMessage = options.onMessage || (() => {});
    this.onClose = options.onClose || (() => {});
    this.onError = options.onError || (() => {});
    this.onReconnecting = options.onReconnecting || (() => {});
    this.onReconnected = options.onReconnected || (() => {});
    this.onMaxRetriesReached = options.onMaxRetriesReached || (() => {});
  }

  connect() {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('📡 WebSocket connected');
        this.isConnecting = false;
        this.retryDelay = 1000; // Reset delay on successful connection
        this.retryCount = 0;

        if (this.retryCount > 0) {
          this.onReconnected();
        }
        this.onOpen();
      };

      this.ws.onmessage = (event) => {
        this.onMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log('📡 WebSocket closed:', event.code, event.reason);
        this.isConnecting = false;
        this.onClose(event);

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnecting = false;
        this.onError(error);
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      this.isConnecting = false;
      this.onError(error);

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  scheduleReconnect() {
    if (this.retryCount >= this.maxRetries) {
      console.error('❌ Max reconnection attempts reached');
      this.onMaxRetriesReached();
      return;
    }

    this.retryCount++;
    console.log(
      `🔄 Reconnecting in ${this.retryDelay}ms (attempt ${this.retryCount})`
    );
    this.onReconnecting(this.retryCount, this.retryDelay);

    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, this.retryDelay);

    // Exponential backoff with jitter
    this.retryDelay = Math.min(
      this.retryDelay * this.retryMultiplier + Math.random() * 1000,
      this.maxRetryDelay
    );
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    }
    console.warn('⚠️ WebSocket not connected, message not sent:', data);
    return false;
  }

  close() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getReadyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Convenience function for simple usage
export function createSignalingClient(url, options = {}) {
  return new SignalingClient(url, options);
}

// Helper to create signaling client with common message handling
export function createWebRTCSignaling(url, options = {}) {
  const { role, room, onSignal, onStatusChange, ...clientOptions } = options;

  const client = createSignalingClient(url, {
    ...clientOptions,
    onOpen: () => {
      console.log(`📺 ${role} connected to signaling server`);
      onStatusChange?.('connected');
      
      // Join room immediately after connection
      if (room) {
        client.send({
          type: 'join',
          room: room,
          role: role.toLowerCase()
        });
      }
    },
    onMessage: (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`📨 ${role} received message:`, message.type);
        if (message.type === 'signal') {
          onSignal(message.data);
        }
      } catch (error) {
        console.error('❌ Failed to parse signaling message:', error);
      }
    },
    onReconnecting: (attempt, delay) => {
      console.log(
        `🔄 ${role} reconnecting... attempt ${attempt}, delay ${delay}ms`
      );
      onStatusChange?.('reconnecting', { attempt, delay });
    },
    onReconnected: () => {
      console.log(`✅ ${role} reconnected`);
      onStatusChange?.('reconnected');
      
      // Rejoin room after reconnection
      if (room) {
        client.send({
          type: 'join',
          room: room,
          role: role.toLowerCase()
        });
      }
    },
    onClose: () => {
      console.log(`📡 ${role} disconnected`);
      onStatusChange?.('disconnected');
    },
    onError: (error) => {
      console.error(`❌ ${role} signaling error:`, error);
      onStatusChange?.('error', { error });
    },
    onMaxRetriesReached: () => {
      console.error(`❌ ${role} max reconnection attempts reached`);
      onStatusChange?.('failed');
    },
  });

  // Add convenience methods
  client.joinRoom = (roomName) => {
    client.send({
      type: 'join',
      room: roomName,
      role: role.toLowerCase()
    });
  };

  client.sendSignal = (data, targetRole) => {
    client.send({
      type: 'signal',
      room: room,
      to: targetRole || (role === 'Sender' ? 'answerer' : 'offerer'),
      data: data
    });
  };

  return client;
}
