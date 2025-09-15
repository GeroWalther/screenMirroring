/**
 * Simple WebView Screen Receiver
 * Loads the working stream URL in a WebView
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Text, Pressable, Dimensions, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { discoverStreamServer, generateStreamUrl } from '../utils/networkUtils';

const DEFAULT_ROOM = 'living-room';

export default function ScreenReceiver() {
  const [streamURL, setStreamURL] = useState('');
  const [serverIP, setServerIP] = useState('192.168.0.26'); // Fallback IP
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const webViewRef = useRef<WebView | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { width, height } = Dimensions.get('window');

  // Auto-hide controls after 5 seconds of no interaction
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  };

  // Handle WebView load states
  const handleLoadStart = () => {
    console.log('📱 WebView: Load started');
    setIsLoading(true);
    setError(null);
  };

  const handleLoadEnd = () => {
    console.log('📱 WebView: Load ended');
    setIsLoading(false);
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.log('📱 WebView: Stream not available (this is normal when not streaming)', nativeEvent);
    
    // Don't show error - instead show instructions
    setError(null);
    setIsLoading(false);
  };

  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('📱 WebView Message:', message);
      
      // Handle different message types from the web page
      if (message.type === 'stream-status') {
        if (message.status === 'connected') {
          setError(null);
        } else if (message.status === 'error') {
          setError(message.message || 'Stream connection failed');
        }
      }
    } catch (err) {
      console.log('📱 WebView Message (non-JSON):', event.nativeEvent.data);
    }
  };

  // Refresh the WebView
  const refreshStream = () => {
    console.log('🔄 Refreshing stream...');
    setLastRefresh(Date.now());
    
    // Regenerate URL with current server IP
    const newUrl = generateStreamUrl(serverIP, DEFAULT_ROOM);
    setStreamURL(newUrl);
    
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  // Handle screen tap
  const handleScreenTap = () => {
    resetControlsTimeout();
  };

  // Auto-discover stream server and start controls timeout on mount
  useEffect(() => {
    resetControlsTimeout();
    
    // Discover stream server
    const initializeStream = async () => {
      console.log('🔍 Starting stream server discovery...');
      setIsLoading(true);
      
      try {
        const discovery = await discoverStreamServer();
        setServerIP(discovery.ip);
        const url = generateStreamUrl(discovery.ip, DEFAULT_ROOM);
        setStreamURL(url);
        console.log('✅ Stream URL set to:', url);
      } catch (error) {
        console.error('❌ Discovery failed:', error);
        // Use fallback IP
        const fallbackUrl = generateStreamUrl(serverIP, DEFAULT_ROOM);
        setStreamURL(fallbackUrl);
        console.log('⚠️ Using fallback URL:', fallbackUrl);
      }
    };
    
    initializeStream();
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Note: Auto-refresh removed since we now show instructions instead of errors

  return (
    <Pressable style={styles.container} onPress={handleScreenTap}>
      <StatusBar hidden />
      
      {/* WebView Stream */}
      {streamURL ? (
        <WebView
          ref={webViewRef}
          source={{ uri: `${streamURL}&t=${lastRefresh}` }}
          style={styles.webview}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        scalesPageToFit={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEnabled={false}
        // Additional WebView props for better video support
        allowsBackForwardNavigationGestures={false}
        cacheEnabled={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
      />
      ) : (
        <View style={styles.discoveryOverlay}>
          <Text style={styles.discoveryText}>🔍 Discovering stream server...</Text>
          <Text style={styles.discoverySubtext}>Please wait while we find your screen sharing server</Text>
        </View>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading stream...</Text>
          <Text style={styles.urlText}>{streamURL}</Text>
        </View>
      )}

      {/* Instructions Overlay - show when not loading and no error */}
      {!isLoading && !error && streamURL && (
        <View style={styles.instructionsOverlay}>
          <Text style={styles.instructionsTitle}>📺 Ready to Receive Stream</Text>
          <Text style={styles.instructionsText}>
            To start streaming:
          </Text>
          <View style={styles.instructionsList}>
            <Text style={styles.instructionStep}>• Open the Screen Mirror desktop app</Text>
            <Text style={styles.instructionStep}>• Click “🚀 Share Screen”</Text>
            <Text style={styles.instructionStep}>• The stream will appear here automatically</Text>
          </View>
          <Text style={styles.urlTitle}>Or share this URL:</Text>
          <Text style={styles.urlText}>{streamURL}</Text>
          <Pressable style={styles.refreshButton} onPress={refreshStream}>
            <Text style={styles.refreshButtonText}>🔄 Check for Stream</Text>
          </Pressable>
        </View>
      )}

      {/* Controls Overlay */}
      {showControls && !isLoading && (
        <View style={styles.controlsOverlay}>
          <View style={styles.controls}>
            <Pressable style={styles.controlButton} onPress={refreshStream}>
              <Text style={styles.controlButtonText}>🔄 Refresh</Text>
            </Pressable>
            <Pressable 
              style={styles.controlButton} 
              onPress={() => {
                Alert.alert(
                  'Stream URL',
                  streamURL,
                  [
                    { text: 'OK', style: 'default' },
                    { 
                      text: 'Refresh', 
                      style: 'default',
                      onPress: refreshStream 
                    }
                  ]
                );
              }}
            >
              <Text style={styles.controlButtonText}>ℹ️ Info</Text>
            </Pressable>
          </View>
          
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              {isLoading ? '⏳ Loading...' : '⏳ Waiting for stream...'}
            </Text>
            <Text style={styles.roomText}>Room: living-room</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  webview: {
    flex: 1,
    backgroundColor: 'black',
  },
  discoveryOverlay: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  discoveryText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  discoverySubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  instructionsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    zIndex: 500,
  },
  instructionsTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  instructionsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 18,
    marginBottom: 15,
    textAlign: 'center',
  },
  instructionsList: {
    marginBottom: 30,
    alignItems: 'flex-start',
  },
  instructionStep: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginBottom: 8,
    paddingLeft: 10,
  },
  urlTitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    pointerEvents: 'box-none',
  },
  controls: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  statusBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  roomText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
  },
  errorTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  urlText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
