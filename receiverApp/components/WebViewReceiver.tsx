/**
 * WebView-based Screen Receiver
 * Shows the web-based screen sharing interface directly in React Native
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Text, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

interface ConnectionState {
  status: 'loading' | 'loaded' | 'error';
  message: string;
}

// Use your existing working web receiver URL
const getWebViewURL = () => {
  const LOCAL_IP = '192.168.0.26'; // Your Mac's IP address
  const WEB_PORT = '8080'; // Your web receiver port
  
  // Use your existing working web receiver URL
  const baseURL = __DEV__ 
    ? `http://${LOCAL_IP}:${WEB_PORT}` 
    : `https://your-signaling-server.com`;
  
  // Your existing web receiver page
  return `${baseURL}/web-receiver.html`;
};

const WEB_RECEIVER_URL = getWebViewURL();

export default function WebViewReceiver() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'loading',
    message: 'Loading web receiver...',
  });
  const [showControls, setShowControls] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const webViewRef = useRef<WebView>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Refresh WebView
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setConnectionState({
      status: 'loading',
      message: 'Refreshing...'
    });
  };

  // WebView event handlers
  const handleLoadStart = () => {
    console.log('🌐 WebView loading started');
    setConnectionState({
      status: 'loading',
      message: 'Loading web receiver...'
    });
  };

  const handleLoadEnd = () => {
    console.log('🌐 WebView loaded successfully');
    setConnectionState({
      status: 'loaded',
      message: 'Web receiver ready'
    });
    resetControlsTimeout();
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('🌐 WebView error:', nativeEvent);
    setConnectionState({
      status: 'error',
      message: `Load error: ${nativeEvent.description || 'Network issue'}`
    });
  };

  // Handle messages from WebView (for future use)
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📨 Message from WebView:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'streaming':
          setConnectionState({
            status: 'loaded',
            message: 'Receiving screen share'
          });
          break;
        case 'disconnected':
          setConnectionState({
            status: 'loaded',
            message: 'Waiting for screen share...'
          });
          break;
        case 'error':
          setConnectionState({
            status: 'error',
            message: data.message || 'WebRTC error'
          });
          break;
      }
    } catch (error) {
      console.log('📨 Non-JSON message from WebView:', event.nativeEvent.data);
    }
  };

  // Get status indicator color
  const getStatusColor = () => {
    switch (connectionState.status) {
      case 'loaded': return '#4CAF50'; // Green
      case 'loading': return '#FF9800'; // Orange
      case 'error': return '#f44336'; // Red
      default: return '#757575'; // Gray
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

  console.log('🖼️ WebView Receiver - URL:', WEB_RECEIVER_URL, 'Status:', connectionState.status);

  return (
    <Pressable style={styles.root} onPress={handleScreenTap}>
      <StatusBar hidden />

      {/* WebView displaying the web-based receiver */}
      <WebView
        key={refreshKey}
        ref={webViewRef}
        source={{ uri: WEB_RECEIVER_URL }}
        style={styles.webview}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onMessage={handleMessage}
        // WebView configuration for optimal streaming
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // Allow media playback
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        // Network settings
        cacheEnabled={false}
        // Security - only needed for your local development
        originWhitelist={['*']}
        // Inject JavaScript to communicate back to React Native
        injectedJavaScript={`
          (function() {
            // Listen for WebRTC events and send status updates
            const originalLog = console.log;
            console.log = function(...args) {
              originalLog.apply(console, args);
              
              // Send important log messages back to React Native
              const message = args.join(' ');
              if (message.includes('streaming') || message.includes('connected') || message.includes('error')) {
                try {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log',
                    message: message
                  }));
                } catch (e) {
                  // Ignore if ReactNativeWebView is not available
                }
              }
            };

            // Monitor for streaming status changes
            let lastStreamingStatus = false;
            setInterval(() => {
              // Check if video element exists and has video
              const videos = document.querySelectorAll('video');
              const hasVideo = videos.length > 0 && Array.from(videos).some(v => v.videoWidth > 0);
              
              if (hasVideo !== lastStreamingStatus) {
                lastStreamingStatus = hasVideo;
                try {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: hasVideo ? 'streaming' : 'disconnected',
                    message: hasVideo ? 'Video streaming active' : 'No video stream'
                  }));
                } catch (e) {
                  // Ignore if ReactNativeWebView is not available
                }
              }
            }, 1000);
          })();
        `}
      />

      {/* Status Overlay */}
      {showControls && (
        <View style={styles.overlay}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.overlayStatusText}>{connectionState.message}</Text>
          </View>
          
          {/* Connection Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>Mode: WebView Receiver</Text>
            <Text style={styles.infoText}>URL: {WEB_RECEIVER_URL}</Text>
            <Text style={styles.infoText}>Status: {connectionState.status}</Text>
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            <Pressable 
              onPress={handleRefresh}
              hasTVPreferredFocus={true}
              style={styles.controlButton}
            >
              <Text style={styles.controlButtonText}>🔄 Refresh</Text>
            </Pressable>
            
            <Pressable 
              onPress={() => setShowControls(false)}
              style={styles.controlButton}
            >
              <Text style={styles.controlButtonText}>👁️ Hide Controls</Text>
            </Pressable>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              📺 WebView-based Screen Sharing
            </Text>
            <Text style={styles.instructionsSubText}>
              Displaying web receiver in native app
            </Text>
          </View>
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
  
  // Overlay Controls
  overlay: {
    position: 'absolute',
    top: Constants.statusBarHeight + 10,
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  
  // Connection Info
  infoContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  infoText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 2,
    fontFamily: 'monospace',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // Instructions
  instructionsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  instructionsSubText: {
    color: '#ccc',
    fontSize: 11,
    opacity: 0.8,
    textAlign: 'center',
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