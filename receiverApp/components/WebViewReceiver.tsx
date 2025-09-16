/**
 * WebView Screen Receiver - Clean & Minimal
 * Simply displays the web receiver in a WebView
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Text, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';

interface ConnectionState {
  status: 'loading' | 'loaded' | 'error';
  message: string;
}

// Base URL for web receiver
const BASE_WEB_RECEIVER_URL = 'http://192.168.0.26:8080/web-receiver.html';

export default function WebViewReceiver() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'loading',
    message: 'Loading web receiver...',
  });
  const [showControls, setShowControls] = useState(false); // Hidden by default
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentRoom, setCurrentRoom] = useState('living-room');
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false); // Track streaming state
  const webViewRef = useRef<WebView>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Common rooms for quick selection
  const commonRooms = [
    'living-room',
    'bedroom',
    'private',
    'meeting',
    'office',
  ];

  // Auto-hide controls after 8 seconds (longer delay)
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 8000); // Longer timeout
  };

  // Handle screen tap to show/hide controls (only when not streaming)
  const handleScreenTap = () => {
    // Don't show controls when streaming - pure full-screen experience
    if (isStreaming) {
      return;
    }
    
    if (showControls) {
      // Hide controls immediately
      setShowControls(false);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
    } else {
      // Show controls and start timeout
      resetControlsTimeout();
    }
  };

  // Get current WebView URL with room parameter
  const getCurrentURL = () => {
    return `${BASE_WEB_RECEIVER_URL}?room=${currentRoom}`;
  };

  // Change room and refresh
  const handleRoomChange = (newRoom: string) => {
    console.log('🏠 Changing room from', currentRoom, 'to', newRoom);
    setCurrentRoom(newRoom);
    setRefreshKey((prev) => prev + 1);
    setConnectionState({
      status: 'loading',
      message: `Switching to room: ${newRoom}...`,
    });
    setShowRoomSelector(false);
    setShowControls(false); // Hide controls after room change
  };

  // Refresh WebView
  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    setConnectionState({
      status: 'loading',
      message: 'Refreshing...',
    });
  };

  // WebView event handlers
  const handleLoadStart = () => {
    console.log('🌐 WebView loading started');
    setConnectionState({
      status: 'loading',
      message: 'Loading...',
    });
  };

  const handleLoadEnd = () => {
    console.log('🌐 WebView loaded successfully');
    setConnectionState({
      status: 'loaded',
      message: 'Ready for screen sharing',
    });
    // Don't show controls automatically after load
    // resetControlsTimeout();
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('🌐 WebView error:', nativeEvent);
    setConnectionState({
      status: 'error',
      message: `Load error: ${nativeEvent.description || 'Network issue'}`,
    });
  };

  // Handle messages from WebView - detect streaming state
  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('📨 Message from WebView:', message);
      
      if (message.type === 'stream_state_change') {
        setIsStreaming(message.isStreaming);
        if (message.isStreaming) {
          // Hide all controls when streaming starts
          setShowControls(false);
          setShowRoomSelector(false);
          if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
          }
        }
      }
    } catch (error) {
      console.log('📨 WebView message (non-JSON):', event.nativeEvent.data);
    }
  };

  // Get status indicator color
  const getStatusColor = () => {
    switch (connectionState.status) {
      case 'loaded':
        return '#4CAF50'; // Green
      case 'loading':
        return '#FF9800'; // Orange
      case 'error':
        return '#f44336'; // Red
      default:
        return '#757575'; // Gray
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // console.log('🖼️ WebView Receiver - URL:', WEB_RECEIVER_URL, 'Status:', connectionState.status);

  return (
    <Pressable style={styles.root} onPress={handleScreenTap}>
      <StatusBar hidden />

      {/* WebView displaying the web-based receiver */}
      <WebView
        key={refreshKey}
        ref={webViewRef}
        source={{ uri: getCurrentURL() }}
        style={styles.webview}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onMessage={handleMessage}
        // Optimized WebView configuration for TV streaming
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false} // Faster loading
        scalesPageToFit={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // Media playback optimization
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        allowsFullscreenVideo={true}
        // Performance optimizations
        cacheEnabled={false} // Fresh content
        javaScriptCanOpenWindowsAutomatically={true}
        // Hardware acceleration
        // androidHardwareAccelerationDisabled={false}
        // Network and security
        originWhitelist={['*']}
        mixedContentMode={'always'}
        // Enhanced JavaScript for stream detection and clean UI
        injectedJavaScript={`
          console.log('📱 Screen Mirror Receiver App loaded for room: ${currentRoom}');
          
          // Add CSS to hide ALL UI elements when streaming - comprehensive selectors
          const style = document.createElement('style');
          style.textContent = 
            '.streaming-active .server-info, ' +
            '.streaming-active .connection-status, ' +
            '.streaming-active .status-indicator, ' +
            '.streaming-active .room-info, ' +
            '.streaming-active .controls, ' +
            '.streaming-active .header, ' +
            '.streaming-active .footer, ' +
            '.streaming-active .overlay, ' +
            '.streaming-active .ui-overlay, ' +
            '.streaming-active .info-panel, ' +
            '.streaming-active .debug-info, ' +
            '.streaming-active .connection-info, ' +
            '.streaming-active .technical-details, ' +
            '.streaming-active .status, ' +
            '.streaming-active .info, ' +
            '.streaming-active .panel, ' +
            '.streaming-active .toolbar, ' +
            '.streaming-active .menu, ' +
            '.streaming-active .nav, ' +
            '.streaming-active .sidebar, ' +
            '.streaming-active .hud, ' +
            '.streaming-active .ui, ' +
            '.streaming-active div:not([class*="video"]):not([id*="video"]), ' +
            '.streaming-active p, ' +
            '.streaming-active span, ' +
            '.streaming-active h1, .streaming-active h2, .streaming-active h3, ' +
            '.streaming-active button, ' +
            '.streaming-active input, ' +
            '.streaming-active form, ' +
            '.streaming-active label, ' +
            '.streaming-active .text { ' +
              'display: none !important; ' +
              'visibility: hidden !important; ' +
              'opacity: 0 !important; ' +
            '} ' +
            '.streaming-active { ' +
              'background: #000 !important; ' +
            '} ' +
            '.streaming-active video { ' +
              'position: fixed !important; ' +
              'top: 0 !important; ' +
              'left: 0 !important; ' +
              'width: 100vw !important; ' +
              'height: 100vh !important; ' +
              'object-fit: contain !important; ' +
              'z-index: 9999 !important; ' +
              'background: #000 !important; ' +
            '} ' +
            '.streaming-active canvas, .streaming-active [class*="stream"] { ' +
              'position: fixed !important; ' +
              'top: 0 !important; ' +
              'left: 0 !important; ' +
              'width: 100vw !important; ' +
              'height: 100vh !important; ' +
              'z-index: 9998 !important; ' +
            '}';
          document.head.appendChild(style);
          
          // Detect streaming state and communicate with React Native
          let wasStreaming = false;
          setInterval(() => {
            const videos = document.querySelectorAll('video');
            const isStreaming = videos.length > 0 && Array.from(videos).some(v => v.videoWidth > 0);
            
            // Toggle streaming class on body to hide/show UI elements
            if (isStreaming) {
              document.body.classList.add('streaming-active');
              document.documentElement.classList.add('streaming-active');
            } else {
              document.body.classList.remove('streaming-active');
              document.documentElement.classList.remove('streaming-active');
            }
            
            if (wasStreaming !== isStreaming) {
              console.log(isStreaming ? '🎥 Stream started - hiding all UI' : '⏹️ Stream stopped - showing UI');
              // Send message to React Native for clean UI control
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'stream_state_change',
                isStreaming: isStreaming
              }));
            }
            
            wasStreaming = isStreaming;
          }, 500); // Check more frequently for responsive UI hiding
          
          true; // Required for WebView
        `}
      />

      {/* Controls Overlay - Only show when not streaming */}
      {showControls && !isStreaming && (
        <View style={styles.overlay}>
          <View style={styles.statusContainer}>
            <View
              style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
            />
            <Text style={styles.overlayStatusText}>
              {connectionState.message}
            </Text>
          </View>

          {/* Room Info */}
          <View style={styles.roomContainer}>
            <Text style={styles.roomText}>Room: {currentRoom}</Text>
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            <Pressable
              onPress={() => setShowRoomSelector(!showRoomSelector)}
              style={styles.controlButton}>
              <Text style={styles.controlButtonText}>🏠 Change Room</Text>
            </Pressable>

            <Pressable
              onPress={handleRefresh}
              hasTVPreferredFocus={true}
              style={styles.controlButton}>
              <Text style={styles.controlButtonText}>🔄 Refresh</Text>
            </Pressable>
          </View>

          {/* Room Selector */}
          {showRoomSelector && (
            <View style={styles.roomSelector}>
              <Text style={styles.roomSelectorTitle}>Select Room:</Text>
              <View style={styles.roomButtons}>
                {commonRooms.map((room) => (
                  <Pressable
                    key={room}
                    onPress={() => handleRoomChange(room)}
                    style={[
                      styles.roomButton,
                      currentRoom === room && styles.roomButtonActive,
                    ]}>
                    <Text
                      style={[
                        styles.roomButtonText,
                        currentRoom === room && styles.roomButtonTextActive,
                      ]}>
                      {room}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Error State - Only show when not streaming */}
      {connectionState.status === 'error' && !isStreaming && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>⚠️ Connection Error</Text>
          <Text style={styles.errorMessage}>{connectionState.message}</Text>
          <Pressable onPress={handleRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>🔄 Retry</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  // WebView
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Minimal Overlay
  overlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  overlayStatusText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },

  // Room Info
  roomContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  roomText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Controls
  controlsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  controlButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Room Selector
  roomSelector: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  roomSelectorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  roomButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  roomButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
  },
  roomButtonActive: {
    backgroundColor: '#4CAF50',
  },
  roomButtonText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  roomButtonTextActive: {
    fontWeight: 'bold',
  },

  // Error Overlay
  errorOverlay: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    transform: [{ translateY: -100 }],
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
