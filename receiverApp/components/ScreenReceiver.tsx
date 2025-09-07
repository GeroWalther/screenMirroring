/**
 * Simple Screen Receiver - Test Version
 */

import React, { useState } from 'react';
import { View, StyleSheet, StatusBar, Text } from 'react-native';

interface ConnectionState {
  status: string;
  message: string;
  reconnectAttempt: number;
  isStreaming: boolean;
}

// Default signaling URL - update this with your computer's IP
const SIGNALING_URL = 'ws://192.168.0.25:8080';
const DEFAULT_ROOM = 'default';

export default function ScreenReceiver() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    message: 'Ready to connect',
    reconnectAttempt: 0,
    isStreaming: false,
  });
  const [showControls, setShowControls] = useState(true);

  console.log('📺 Screen Mirror Receiver loading...');

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Main content */}
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>📺 Screen Mirror Receiver</Text>
        <Text style={styles.roomText}>Waiting for screen share...</Text>
        <Text style={styles.roomText}>Server: {SIGNALING_URL}</Text>
        <Text style={styles.roomText}>Room: {DEFAULT_ROOM}</Text>
        <Text style={styles.roomText}>Status: {connectionState.status}</Text>
      </View>

      {/* Status overlay */}
      {showControls && (
        <View style={styles.overlay}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: '#ff6b6b' }]} />
            <Text style={styles.statusText}>{connectionState.message}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  roomText: {
    color: '#ccc',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  overlay: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    zIndex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
});
