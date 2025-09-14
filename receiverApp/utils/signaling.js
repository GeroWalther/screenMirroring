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
    const connectionId = Math.random().toString(36).substr(2, 9);
    console.log('🔗 RECEIVER CONNECT START - ID:', connectionId, 'URL:', this.url);
    console.log('🔗 Current state - isConnecting:', this.isConnecting, 'ws exists:', !!this.ws, 'readyState:', this.ws?.readyState);
    
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      console.log('⚠️ RECEIVER - Skipping connect, already connecting or connected');
      return;
    }

    this.isConnecting = true;
    console.log('🔗 RECEIVER - Setting isConnecting = true');

    try {
      console.log('🔗 RECEIVER - Creating WebSocket to:', this.url);
      this.ws = new WebSocket(this.url);
      console.log('🔗 RECEIVER - WebSocket created, readyState:', this.ws.readyState);

      this.ws.onopen = () => {
        console.log('✅ RECEIVER WS CONNECTED - URL:', this.url);
        console.log('✅ WebSocket readyState:', this.ws.readyState, '(should be', WebSocket.OPEN, ')');
        this.isConnecting = false;
        this.retryDelay = 1000; // Reset delay on successful connection
        
        const wasReconnecting = this.retryCount > 0;
        this.retryCount = 0;
        
        console.log('📡 RECEIVER - Calling onOpen handler');
        
        if (wasReconnecting) {
          console.log('✅ RECEIVER - This was a reconnection');
          this.onReconnected();
        }
        this.onOpen();
      };

      this.ws.onmessage = (event) => {
        this.onMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log('📴 RECEIVER WS CLOSED - Code:', event.code, 'Reason:', event.reason, 'Clean:', event.wasClean);
        console.log('📴 Close event details:', {
          url: this.url,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          shouldReconnect: this.shouldReconnect
        });
        this.isConnecting = false;
        this.onClose(event);

        if (this.shouldReconnect) {
          console.log('🔄 RECEIVER - Will attempt reconnection');
          this.scheduleReconnect();
        } else {
          console.log('⚠️ RECEIVER - No reconnection (shouldReconnect = false)');
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ RECEIVER WS ERROR:', error);
        console.error('❌ Error details:', {
          url: this.url,
          readyState: this.ws?.readyState,
          isConnecting: this.isConnecting,
          error: error
        });
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
    console.log('📨 RECEIVER WS SEND - Message:', data);
    console.log('📨 WebSocket state:', {
      exists: !!this.ws,
      readyState: this.ws?.readyState,
      expectedOpen: WebSocket.OPEN
    });
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      console.log('📨 RECEIVER - Sending payload:', payload);
      this.ws.send(payload);
      console.log('✅ RECEIVER - Message sent successfully');
      return true;
    }
    console.error('❌ RECEIVER - Cannot send message, WebSocket not connected:', {
      data: data,
      wsExists: !!this.ws,
      readyState: this.ws?.readyState,
      expectedState: WebSocket.OPEN
    });
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
      console.log(`📱 ${role} about to join room:`, room, 'as role:', role.toLowerCase());
      onStatusChange?.('connected');
      
      // Join room immediately after connection
      if (room) {
        const joinMessage = {
          type: 'join',
          room: room,
          role: role.toLowerCase()
        };
        console.log(`📱 ${role} - Sending join message:`, joinMessage);
        const sent = client.send(joinMessage);
        console.log(`📱 ${role} - Join message sent:`, sent);
      } else {
        console.warn(`⚠️ ${role} - No room specified for joining`);
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
