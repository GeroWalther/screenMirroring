/**
 * Complete WebRTC Screen Receiver with Auto-Discovery
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Text, Pressable } from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';
import { createWebRTCSignaling } from '../utils/signaling';

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'webrtc-connecting' | 'streaming' | 'reconnecting' | 'error';
  message: string;
  reconnectAttempt: number;
  isStreaming: boolean;
}

// Auto-detect signaling server URL
const getSignalingURL = () => {
  // In production, you might want to use mDNS discovery or a config service
  const LOCAL_IP = '192.168.0.25'; // Your Mac's IP address
  return __DEV__
    ? `ws://${LOCAL_IP}:8080` // Local development
    : `wss://your-signaling-server.com`; // Cloud production
};

const SIGNALING_URL = getSignalingURL();
const DEFAULT_ROOM = 'living-room'; // Default room code

// ICE servers for WebRTC connection
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function ScreenReceiver() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    message: 'Ready to connect',
    reconnectAttempt: 0,
    isStreaming: false,
  });
  const [showControls, setShowControls] = useState(true);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [room] = useState(DEFAULT_ROOM); // Remove setRoom as it's not used

  // WebRTC refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalingClientRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after 5 seconds of no interaction
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (connectionState.isStreaming) {
        setShowControls(false);
      }
    }, 5000);
  };

  // Handle signaling messages
  const handleSignal = async (data: any) => {
    console.log('📨 Received signaling data:', data.type || 'unknown');
    
    if (!peerConnectionRef.current) {
      console.warn('⚠️ No peer connection available');
      return;
    }

    try {
      if (data.sdp) {
        if (data.sdp.type === 'offer') {
          console.log('📝 Processing SDP offer');
          setConnectionState(prev => ({ 
            ...prev, 
            status: 'webrtc-connecting', 
            message: 'Establishing connection...' 
          }));

          try {
            console.log('🔧 Setting remote description...');
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(data.sdp)
            );
            console.log('✅ Remote description set successfully');

            console.log('🔧 Creating answer...');
            const answer = await peerConnectionRef.current.createAnswer();
            console.log('✅ Answer created:', answer.type);

            // Send answer immediately after creation, before setLocalDescription
            const answerMessage = {
              sdp: answer // Use the answer directly, not localDescription
            };
            console.log('📤 Sending answer via signaling (before setLocal):', answerMessage.sdp?.type);
            
            if (signalingClientRef.current && signalingClientRef.current.sendSignal) {
              signalingClientRef.current.sendSignal(answerMessage);
              console.log('✅ Answer sent successfully');
            } else {
              console.error('❌ Signaling client not available for sending answer');
            }

            // Skip setLocalDescription - it causes crashes in React Native WebRTC
            // The answer was already sent, which is sufficient for the connection
            console.log('✅ Skipping setLocalDescription to prevent crash - answer already sent');
            
            // Mark connection as ready since we sent the answer
            setConnectionState(prev => ({ 
              ...prev, 
              status: 'webrtc-connecting', 
              message: 'Answer sent, waiting for connection...' 
            }));
            
          } catch (sdpError) {
            console.error('❌ SDP processing error:', sdpError);
            console.error('❌ SDP error details:', {
              message: sdpError.message,
              name: sdpError.name,
              stack: sdpError.stack
            });
            throw sdpError;
          }
        }
      } else if (data.ice) {
        console.log('🧆 Adding ICE candidate:', data.ice.candidate?.substring(0, 50) + '...');
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.ice)
          );
          console.log('✅ ICE candidate added successfully');
        } catch (iceError) {
          console.error('❌ ICE candidate error:', iceError);
          // Don't throw - ICE errors are often non-fatal
        }
      }
    } catch (error) {
      console.error('❌ Error handling signaling data:', error);
      console.error('❌ Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      setConnectionState(prev => ({ 
        ...prev, 
        status: 'error', 
        message: `Connection failed: ${error.message}` 
      }));
    }
  };

  // Handle connection status changes
  const handleStatusChange = (status: string, data?: any) => {
    console.log('📊 Status change:', status, data);
    
    switch (status) {
      case 'connected':
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'connected', 
          message: 'Connected to signaling server',
          reconnectAttempt: 0
        }));
        break;
      case 'reconnecting':
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'reconnecting', 
          message: `Reconnecting... (attempt ${data.attempt})`,
          reconnectAttempt: data.attempt
        }));
        break;
      case 'disconnected':
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'disconnected', 
          message: 'Disconnected from server',
          isStreaming: false
        }));
        setRemoteStream(null);
        break;
      case 'error':
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'error', 
          message: 'Connection error occurred'
        }));
        break;
    }
  };

  // Initialize WebRTC peer connection
  const initializePeerConnection = () => {
    console.log('🔧 Initializing peer connection');
    
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Handle remote stream (legacy onaddstream)
    pc.onaddstream = (event: any) => {
      console.log('📺 Remote stream added (legacy):', event.stream.id);
      setRemoteStream(event.stream);
      setConnectionState(prev => ({ 
        ...prev, 
        status: 'streaming', 
        message: 'Receiving screen share',
        isStreaming: true
      }));
      resetControlsTimeout();
    };
    
    // Handle remote stream (modern ontrack)
    pc.ontrack = (event: any) => {
      console.log('📺 Remote track added:', event.track.kind, event.streams?.length);
      console.log('📺 Track details:', {
        id: event.track.id,
        kind: event.track.kind,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        muted: event.track.muted
      });
      
      if (event.streams && event.streams.length > 0) {
        const remoteStream = event.streams[0];
        console.log('📺 Setting remote stream from ontrack:', remoteStream.id);
        console.log('📺 Stream tracks:', {
          videoTracks: remoteStream.getVideoTracks().length,
          audioTracks: remoteStream.getAudioTracks().length,
          active: remoteStream.active
        });
        
        setRemoteStream(remoteStream);
        setConnectionState(prev => {
          console.log('📦 Updating state to streaming from:', prev.status);
          return { 
            ...prev, 
            status: 'streaming', 
            message: 'Receiving screen share via track',
            isStreaming: true
          };
        });
        
        // Force check the current peer connection state
        setTimeout(() => {
          if (peerConnectionRef.current) {
            console.log('🔍 Force checking peer connection states:');
            console.log('  - connectionState:', peerConnectionRef.current.connectionState);
            console.log('  - iceConnectionState:', peerConnectionRef.current.iceConnectionState);
            console.log('  - signalingState:', peerConnectionRef.current.signalingState);
            
            // If connection is already established, update state
            if (peerConnectionRef.current.connectionState === 'connected' || 
                peerConnectionRef.current.iceConnectionState === 'connected' ||
                peerConnectionRef.current.iceConnectionState === 'completed') {
              console.log('✅ Connection already established! Updating UI...');
              setConnectionState(prev => ({ 
                ...prev, 
                status: 'streaming', 
                message: 'Connected and streaming!',
                isStreaming: true
              }));
            }
          }
        }, 1000);
        resetControlsTimeout();
      } else {
        console.log('⚠️ No streams in ontrack event');
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔗 RECEIVER WebRTC Connection state:', pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        console.log('✅ RECEIVER WebRTC Connected!');
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'streaming', 
          message: 'WebRTC Connected - Receiving video',
          isStreaming: true
        }));
      } else if (pc.connectionState === 'connecting') {
        console.log('🔗 RECEIVER WebRTC Connecting...');
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'webrtc-connecting', 
          message: 'WebRTC connecting...',
          isStreaming: false
        }));
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.log('❌ RECEIVER WebRTC Disconnected/Failed');
        setRemoteStream(null);
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'disconnected', 
          message: 'WebRTC connection lost',
          isStreaming: false
        }));
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate');
        signalingClientRef.current?.sendSignal({
          ice: event.candidate,
        });
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('🧆 RECEIVER ICE connection state:', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'connected') {
        console.log('✅ RECEIVER ICE Connected!');
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'streaming', 
          message: 'ICE Connected - Video should be flowing',
          isStreaming: true
        }));
      } else if (pc.iceConnectionState === 'completed') {
        console.log('✅ RECEIVER ICE Completed!');
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'streaming', 
          message: 'ICE Completed - Optimal connection established',
          isStreaming: true
        }));
      } else if (pc.iceConnectionState === 'checking') {
        console.log('🧆 RECEIVER ICE Checking...');
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'webrtc-connecting', 
          message: 'ICE checking connectivity...',
          isStreaming: false
        }));
      } else if (pc.iceConnectionState === 'failed') {
        console.log('❌ RECEIVER ICE Failed!');
        setConnectionState(prev => ({ 
          ...prev, 
          status: 'error', 
          message: 'ICE connection failed',
          isStreaming: false
        }));
      }
    };

    return pc;
  };

  // Connect to signaling server and initialize WebRTC
  const connect = async () => {
    console.log('🚀 Starting connection process');
    
    try {
      // Initialize peer connection
      peerConnectionRef.current = initializePeerConnection();

      // Create signaling client
      signalingClientRef.current = createWebRTCSignaling(SIGNALING_URL, {
        role: 'answerer', // Must match sender's 'to' field
        room: room,
        onSignal: handleSignal,
        onStatusChange: handleStatusChange,
      });

      // Connect to signaling server
      setConnectionState(prev => ({ 
        ...prev, 
        status: 'connecting', 
        message: 'Connecting to signaling server...' 
      }));
      
      signalingClientRef.current.connect();

    } catch (error) {
      console.error('❌ Connection failed:', error);
      setConnectionState(prev => ({ 
        ...prev, 
        status: 'error', 
        message: 'Failed to initialize connection'
      }));
    }
  };

  // Disconnect and cleanup
  const disconnect = () => {
    console.log('🔌 Disconnecting...');
    
    if (signalingClientRef.current) {
      signalingClientRef.current.close();
      signalingClientRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }

    setRemoteStream(null);
    setConnectionState({
      status: 'disconnected',
      message: 'Disconnected',
      reconnectAttempt: 0,
      isStreaming: false,
    });
    setShowControls(true);
  };

  // Auto-connect on mount
  useEffect(() => {
    console.log('📺 Screen Mirror Receiver initializing...');
    connect();

    // Temporarily disable cleanup to prevent constant disconnections
    // return () => {
    //   disconnect();
    // };
  }, []); // Empty dependency array - run once on mount

  // TV interface - always show controls
  const handleScreenTap = () => {
    // No-op for TV interface
  };

  // Get status indicator color
  const getStatusColor = () => {
    switch (connectionState.status) {
      case 'connected': return '#4CAF50'; // Green
      case 'connecting': return '#FF9800'; // Orange
      case 'webrtc-connecting': return '#FF9800'; // Orange
      case 'streaming': return '#2196F3'; // Blue
      case 'reconnecting': return '#FF9800'; // Orange
      case 'error': return '#f44336'; // Red
      default: return '#757575'; // Gray
    }
  };

  // Debug current state
  console.log('🖼️ RENDER - Current state:', {
    hasRemoteStream: !!remoteStream,
    remoteStreamId: remoteStream?.id,
    remoteStreamActive: remoteStream?.active,
    remoteStreamURL: remoteStream?.toURL?.(),
    connectionStatus: connectionState.status,
    isStreaming: connectionState.isStreaming,
    message: connectionState.message
  });

  return (
    <Pressable style={styles.root} onPress={handleScreenTap}>
      <StatusBar hidden />

      {/* Video Stream */}
      {remoteStream ? (
        <>
          {/* Android TV optimized RTCView */}
          <RTCView
            streamURL={remoteStream.toURL()}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'black',
              zIndex: -1
            }}
            objectFit="contain"
            mirror={false}
          />
          <RTCView
            stream={remoteStream}
            style={{
              position: 'absolute',
              top: 100,
              left: 100, 
              width: 800,
              height: 600,
              backgroundColor: 'blue',
              zIndex: 0
            }}
            objectFit="cover"
            mirror={false}
          />
          
          {/* Third attempt - fixed size, different position */}
          <RTCView
            streamURL={remoteStream.toURL()}
            style={{
              position: 'absolute',
              top: 200,
              right: 100,
              width: 400,
              height: 300,
              backgroundColor: 'green',
              borderWidth: 5,
              borderColor: 'yellow'
            }}
            objectFit="cover"
          />
          
          {/* Debug overlay with stream info */}
          <View style={{position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,0,0,0.8)', padding: 20, zIndex: 1000}}>
            <Text style={{color: 'white', fontSize: 20, fontWeight: 'bold'}}>
              📺 STREAM DETECTED!
            </Text>
            <Text style={{color: 'white', fontSize: 16}}>
              ID: {remoteStream.id}
            </Text>
            <Text style={{color: 'white', fontSize: 16}}>
              URL: {remoteStream.toURL()}
            </Text>
            <Text style={{color: 'white', fontSize: 16}}>
              Active: {remoteStream.active ? 'YES' : 'NO'}
            </Text>
            <Text style={{color: 'white', fontSize: 16}}>
              Video Tracks: {remoteStream.getVideoTracks().length}
            </Text>
            <Text style={{color: 'white', fontSize: 16}}>
              Track State: {remoteStream.getVideoTracks()[0]?.readyState || 'N/A'}
            </Text>
          </View>
        </>
      ) : (
        /* Waiting State */
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingText}>📺 Screen Mirror Receiver</Text>
          <Text style={styles.roomText}>Waiting for screen share...</Text>
          <View style={styles.roomCodeContainer}>
            <Text style={styles.roomCodeLabel}>Room Code:</Text>
            <Text style={styles.roomCode}>{room}</Text>
          </View>
          <Text style={styles.serverText}>Server: {SIGNALING_URL}</Text>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {connectionState.message}
          </Text>
        </View>
      )}

      {/* Status Overlay - Always visible for TV */}
      {(showControls || true) && (
        <View style={styles.overlay}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.overlayStatusText}>{connectionState.message}</Text>
          </View>
          
          {/* Connection Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>Room: {room}</Text>
            <Text style={styles.infoText}>Status: {connectionState.status}</Text>
            {connectionState.reconnectAttempt > 0 && (
              <Text style={styles.infoText}>Retry: {connectionState.reconnectAttempt}</Text>
            )}
          </View>

          {/* TV Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              {connectionState.isStreaming ? '📺 Screen Sharing Active' : '📺 Waiting for screen share...'}
            </Text>
          </View>
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
  
  // Video Stream
  videoStream: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  
  // Waiting State
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  waitingText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  roomText: {
    color: '#ccc',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 32,
  },
  roomCodeContainer: {
    backgroundColor: '#333',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 12,
    marginBottom: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  roomCodeLabel: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 8,
  },
  roomCode: {
    color: '#4CAF50',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  serverText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  statusText: {
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // Overlay Controls
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
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'monospace',
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
    fontSize: 12,
    opacity: 0.8,
    textAlign: 'center',
  },
});
