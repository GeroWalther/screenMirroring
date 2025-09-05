/**
 * React Native Screen Receiver with Exponential Backoff Reconnection
 * Receives WebRTC stream and displays it fullscreen on Android TV
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Text,
  Pressable,
  Alert,
} from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
} from 'react-native-webrtc';
import { createWebRTCSignaling } from '../../rtc-signal/shared/signaling.js';

interface ConnectionState {
  status: string;
  message: string;
  reconnectAttempt: number;
  isStreaming: boolean;
}

const SIGNALING_URL = 'ws://192.168.1.100:8080'; // Default - will be configurable
const DEFAULT_ROOM = 'livingroom';

export default function ScreenReceiver() {
  // State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    message: 'Ready to connect',
    reconnectAttempt: 0,
    isStreaming: false,
  });
  const [showControls, setShowControls] = useState(true);
  const [room, setRoom] = useState(DEFAULT_ROOM);
  const [serverUrl, setServerUrl] = useState(SIGNALING_URL);

  // Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingClientRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after 5 seconds
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  }, []);

  const showControlsTemporary = useCallback(() => {
    setShowControls(true);
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Initialize receiver on mount
  useEffect(() => {
    startReceiver();

    return () => {
      cleanup();
    };
  }, [room, serverUrl]);

  const startReceiver = useCallback(() => {
    console.log('Starting receiver...');

    // Create signaling client with exponential backoff
    signalingClientRef.current = createWebRTCSignaling(serverUrl, {
      role: 'Receiver',
      room: room,
      onSignal: handleSignal,
      onStatusChange: handleSignalingStatusChange,
    });

    // Connect to signaling server
    signalingClientRef.current.connect();
  }, [room, serverUrl]);

  const handleSignalingStatusChange = useCallback(
    (status: string, data: any = {}) => {
      console.log('Signaling status:', status, data);

      switch (status) {
        case 'connected':
          setConnectionState((prev) => ({
            ...prev,
            status: 'connected',
            message: 'Connected to server',
            reconnectAttempt: 0,
          }));
          joinRoom();
          break;

        case 'reconnecting':
          setConnectionState((prev) => ({
            ...prev,
            status: 'reconnecting',
            message: `Reconnecting... (${data.attempt})`,
            reconnectAttempt: data.attempt,
          }));
          break;

        case 'reconnected':
          setConnectionState((prev) => ({
            ...prev,
            status: 'reconnected',
            message: 'Reconnected',
            reconnectAttempt: 0,
          }));
          rejoinAfterReconnect();
          break;

        case 'disconnected':
          setConnectionState((prev) => ({
            ...prev,
            status: 'disconnected',
            message: 'Disconnected',
            isStreaming: false,
          }));
          break;

        case 'error':
        case 'failed':
          setConnectionState((prev) => ({
            ...prev,
            status: 'error',
            message: 'Connection failed',
            isStreaming: false,
          }));
          break;
      }
    },
    []
  );

  const joinRoom = useCallback(() => {
    if (!signalingClientRef.current?.isConnected()) return;

    console.log('Joining room:', room);

    signalingClientRef.current.send({
      type: 'join',
      role: 'answerer',
      room: room,
    });

    // Initialize WebRTC
    initializeWebRTC();
  }, [room]);

  const rejoinAfterReconnect = useCallback(() => {
    console.log('Rejoining after reconnect...');

    // Clean up old peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setStream(null);
    setConnectionState((prev) => ({
      ...prev,
      isStreaming: false,
    }));

    // Rejoin room
    joinRoom();
  }, [joinRoom]);

  const initializeWebRTC = useCallback(() => {
    try {
      console.log('Initializing WebRTC...');

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      pcRef.current = pc;

      // Handle incoming stream
      pc.ontrack = (event) => {
        console.log('Received remote stream');
        if (event.streams && event.streams[0]) {
          setStream(event.streams[0]);
          setConnectionState((prev) => ({
            ...prev,
            status: 'streaming',
            message: 'Receiving stream',
            isStreaming: true,
          }));
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && signalingClientRef.current?.isConnected()) {
          signalingClientRef.current.send({
            type: 'signal',
            room: room,
            to: 'offerer',
            data: { ice: event.candidate },
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('WebRTC connection state:', pc.connectionState);

        switch (pc.connectionState) {
          case 'connecting':
            setConnectionState((prev) => ({
              ...prev,
              status: 'connecting',
              message: 'Establishing connection...',
            }));
            break;
          case 'connected':
            setConnectionState((prev) => ({
              ...prev,
              status: 'connected',
              message: 'Connected',
            }));
            break;
          case 'disconnected':
            setConnectionState((prev) => ({
              ...prev,
              status: 'disconnected',
              message: 'Connection lost',
              isStreaming: false,
            }));
            setStream(null);
            break;
          case 'failed':
            setConnectionState((prev) => ({
              ...prev,
              status: 'error',
              message: 'Connection failed',
              isStreaming: false,
            }));
            console.log(
              'WebRTC connection failed, will retry on next signaling reconnect'
            );
            break;
        }
      };
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      setConnectionState((prev) => ({
        ...prev,
        status: 'error',
        message: 'WebRTC initialization failed',
      }));
    }
  }, [room]);

  const handleSignal = useCallback(
    async (data: any) => {
      if (!pcRef.current) return;

      try {
        if (data.sdp && data.sdp.type === 'offer') {
          console.log('Received offer');
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(data.sdp)
          );

          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);

          if (signalingClientRef.current?.isConnected()) {
            signalingClientRef.current.send({
              type: 'signal',
              room: room,
              to: 'offerer',
              data: { sdp: pcRef.current.localDescription },
            });
          }

          setConnectionState((prev) => ({
            ...prev,
            status: 'answering',
            message: 'Answered offer',
          }));
        }

        if (data.ice) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.ice));
          console.log('ICE candidate added');
        }
      } catch (error) {
        console.error('Error handling signal:', error);
        setConnectionState((prev) => ({
          ...prev,
          status: 'error',
          message: 'Signal handling error',
        }));
      }
    },
    [room]
  );

  const cleanup = useCallback(() => {
    console.log('Cleaning up receiver...');

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    if (signalingClientRef.current) {
      signalingClientRef.current.close();
      signalingClientRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setStream(null);
    setConnectionState({
      status: 'disconnected',
      message: 'Disconnected',
      reconnectAttempt: 0,
      isStreaming: false,
    });
  }, []);

  const handleReconnect = useCallback(() => {
    cleanup();
    setTimeout(() => startReceiver(), 1000);
  }, [cleanup, startReceiver]);

  const getStatusColor = () => {
    switch (connectionState.status) {
      case 'connected':
      case 'streaming':
        return '#4caf50';
      case 'connecting':
      case 'reconnecting':
      case 'answering':
        return '#ff9800';
      case 'error':
        return '#f44336';
      default:
        return '#666';
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Video stream or placeholder */}
      {stream && connectionState.isStreaming ? (
        <Pressable
          style={styles.videoContainer}
          onPress={showControlsTemporary}>
          <RTCView
            streamURL={stream.toURL()}
            style={styles.video}
            objectFit='contain'
          />
        </Pressable>
      ) : (
        <Pressable style={styles.placeholder} onPress={showControlsTemporary}>
          <Text style={styles.placeholderText}>
            Waiting for screen share...
          </Text>
          <Text style={styles.roomText}>Room: {room}</Text>
        </Pressable>
      )}

      {/* Status and controls overlay */}
      {showControls && (
        <View style={styles.overlay}>
          <View style={styles.statusContainer}>
            <View
              style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
            />
            <Text style={styles.statusText}>{connectionState.message}</Text>
            {connectionState.reconnectAttempt > 0 && (
              <Text style={styles.reconnectText}>
                Attempt: {connectionState.reconnectAttempt}
              </Text>
            )}
          </View>

          <View style={styles.controlsContainer}>
            <Pressable
              style={[styles.button, styles.reconnectButton]}
              onPress={handleReconnect}>
              <Text style={styles.buttonText}>Reconnect</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.settingsButton]}
              onPress={() => {
                Alert.alert('Settings', `Room: ${room}\nServer: ${serverUrl}`, [
                  { text: 'OK', style: 'default' },
                ]);
              }}>
              <Text style={styles.buttonText}>Settings</Text>
            </Pressable>
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
  videoContainer: {
    flex: 1,
  },
  video: {
    flex: 1,
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
  reconnectText: {
    color: '#ffa500',
    fontSize: 14,
    marginLeft: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  reconnectButton: {
    backgroundColor: '#2196f3',
  },
  settingsButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
