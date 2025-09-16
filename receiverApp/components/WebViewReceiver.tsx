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
  const [showControls, setShowControls] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentRoom, setCurrentRoom] = useState('living-room');
  const [showRoomSelector, setShowRoomSelector] = useState(false);
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

  // Auto-hide controls after 5 seconds
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  };

  // Handle screen tap to show/hide controls
  const handleScreenTap = () => {
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
      message: `Connecting to room: ${newRoom}...`,
    });
    setShowRoomSelector(false);
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
      message: 'Loading web receiver...',
    });
  };

  const handleLoadEnd = () => {
    console.log('🌐 WebView loaded successfully');
    setConnectionState({
      status: 'loaded',
      message: 'Web receiver ready',
    });
    resetControlsTimeout();
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('🌐 WebView error:', nativeEvent);
    setConnectionState({
      status: 'error',
      message: `Load error: ${nativeEvent.description || 'Network issue'}`,
    });
  };

  // Handle messages from WebView (simplified)
  const handleMessage = (event: any) => {
    console.log('📨 Message from WebView:', event.nativeEvent.data);
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
        // JavaScript to monitor connection state and auto-refresh
        injectedJavaScript={`
          console.log('📱 Screen Mirror Receiver App loaded');
          
          // Monitor for disconnections and auto-refresh
          let wasStreaming = false;
          let checkInterval = setInterval(() => {
            const videos = document.querySelectorAll('video');
            const isStreaming = videos.length > 0 && Array.from(videos).some(v => v.videoWidth > 0);
            
            // If we were streaming but now we're not, wait 3 seconds then refresh
            if (wasStreaming && !isStreaming) {
              console.log('🔄 Stream ended, will refresh in 3 seconds...');
              setTimeout(() => {
                console.log('🔄 Auto-refreshing for new connection...');
                window.location.reload();
              }, 3000);
              clearInterval(checkInterval); // Stop checking after refresh
            }
            
            wasStreaming = isStreaming;
          }, 1000);
          
          true; // Required for WebView
        `}
      />

      {/* Controls Overlay */}
      {showControls && (
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

      {/* Error State */}
      {connectionState.status === 'error' && (
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
