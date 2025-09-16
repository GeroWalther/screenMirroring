import { useState, useEffect, useCallback, useRef } from 'react'
import ScreenSender from '../utils/ScreenSender'

export const useScreenSender = () => {
  const [connectionState, setConnectionState] = useState('disconnected')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [room, setRoom] = useState('default-room')
  const [serverUrl, setServerUrl] = useState(
    process.env.NODE_ENV === 'production'
      ? 'wss://your-signaling-server.com' // Cloud WSS for production
      : 'ws://localhost:8080' // Local for development
  )
  const [localIP, setLocalIP] = useState('localhost')

  const screenSenderRef = useRef(null)
  const statsIntervalRef = useRef(null)

  // Create screen sender instance
  const createScreenSender = useCallback(
    (options = {}) => {
      const sender = new ScreenSender({
        signalingUrl: options.serverUrl || serverUrl,
        room: options.room || room,
        // Default to highest quality settings
        encodingParameters: {
          maxBitrate: 5000000, // 5 Mbps
          maxFramerate: 60,
          scaleResolutionDownBy: 1
        },
        onStatusChange: (status, data) => {
          console.log('📡 Connection status change:', status, data)
          setConnectionState(status)

          if (status === 'error' || status === 'failed') {
            setError(data)
          } else if (status === 'no-receiver') {
            setError({
              message: data.message || 'No receiver found. Please open the stream URL in a web browser first.',
              type: 'no-receiver',
              showRetry: true,
              showOpenUrl: true
            })
          } else if (status === 'checking-receiver') {
            setError(null) // Clear any previous errors while checking
          } else {
            setError(null)
          }
        },
        onStreamStarted: () => {
          console.log('🎬 Stream started successfully')
          setIsStreaming(true)
          startStatsCollection()

          // Notify main process
          if (window.api?.streamingStarted) {
            console.log('📱 Notifying main process: streaming started')
            window.api.streamingStarted()
          }
        },
        onStreamEnded: () => {
          console.log('⏹️ Stream ended')
          setIsStreaming(false)
          stopStatsCollection()

          // Notify main process
          if (window.api?.streamingStopped) {
            console.log('📱 Notifying main process: streaming stopped')
            window.api.streamingStopped()
          }
        },
        onError: (err) => {
          console.error('❌ Screen sender error:', err)
          setError(err.message || 'Unknown error occurred')
        }
      })

      return sender
    },
    [room, serverUrl]
  )

  // Start screen sharing
  const startSharing = useCallback(
    async (options = {}) => {
      try {
        console.log('🚀 Starting screen sharing with options:', options)
        setError(null)

        // Update settings if provided
        if (options.room) {
          console.log('📝 Setting room to:', options.room)
          setRoom(options.room)
        }
        if (options.serverUrl) {
          console.log('📝 Setting server URL to:', options.serverUrl)
          setServerUrl(options.serverUrl)
        }

        // Stop existing sender
        if (screenSenderRef.current) {
          console.log('🛑 Stopping existing screen sender')
          screenSenderRef.current.stop()
        }

        // Create new sender
        console.log('🔧 Creating new screen sender')
        screenSenderRef.current = createScreenSender(options)

        // Start sharing
        console.log('▶️ Starting screen capture and sharing')
        await screenSenderRef.current.start()
      } catch (err) {
        console.error('❌ Failed to start sharing:', err)
        setError(err.message || 'Failed to start screen sharing')
        setConnectionState('error')
      }
    },
    [createScreenSender]
  )

  // Stop screen sharing
  const stopSharing = useCallback(() => {
    console.log('🛑 Stopping screen sharing')
    if (screenSenderRef.current) {
      screenSenderRef.current.stop()
      screenSenderRef.current = null
    }
    setConnectionState('disconnected')
    setIsStreaming(false)
    stopStatsCollection()
    console.log('✅ Screen sharing stopped')
  }, [])

  // Update quality settings
  const updateQuality = useCallback(async (settings) => {
    console.log('⚙️ Updating quality settings:', settings)
    if (screenSenderRef.current) {
      try {
        await screenSenderRef.current.setEncodingParameters(settings)
        console.log('✅ Quality settings updated successfully')

        // Notify main process
        if (window.api?.updateQuality) {
          window.api.updateQuality(settings)
        }
      } catch (err) {
        console.error('❌ Failed to update quality:', err)
        setError('Failed to update quality settings')
      }
    } else {
      console.warn('⚠️ Cannot update quality - no active screen sender')
    }
  }, [])

  // Start collecting connection stats
  const startStatsCollection = useCallback(() => {
    if (statsIntervalRef.current) return

    statsIntervalRef.current = setInterval(async () => {
      if (screenSenderRef.current && screenSenderRef.current.isActive()) {
        try {
          const statsReport = await screenSenderRef.current.getStats()
          if (statsReport) {
            // Process stats report
            const processedStats = await processStatsReport(statsReport)
            setStats(processedStats)
          }
        } catch (err) {
          console.error('Failed to collect stats:', err)
        }
      }
    }, 1000) // Update every second
  }, [])

  // Stop collecting connection stats
  const stopStatsCollection = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current)
      statsIntervalRef.current = null
    }
    setStats(null)
  }, [])

  // Process WebRTC stats report
  const processStatsReport = async (statsReport) => {
    const stats = {
      video: {},
      audio: {},
      connection: {}
    }

    for (const report of statsReport.values()) {
      if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
        stats.video = {
          bytesSent: report.bytesSent,
          packetsSent: report.packetsSent,
          framesEncoded: report.framesEncoded,
          frameWidth: report.frameWidth,
          frameHeight: report.frameHeight,
          framesPerSecond: report.framesPerSecond,
          bitrate: (report.bytesSent * 8) / (report.timestamp / 1000) // rough calculation
        }
      } else if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
        stats.audio = {
          bytesSent: report.bytesSent,
          packetsSent: report.packetsSent
        }
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        stats.connection = {
          currentRoundTripTime: report.currentRoundTripTime,
          availableOutgoingBitrate: report.availableOutgoingBitrate
        }
      }
    }

    return stats
  }

  // Listen for start sharing events from main process
  useEffect(() => {
    if (window.api?.onStartSharing) {
      const handleStartSharing = (event, data) => {
        console.log('🚀 Start sharing requested from tray menu:', data)
        startSharing({
          room: data.room,
          serverUrl: data.serverUrl
        })
      }

      window.api.onStartSharing(handleStartSharing)

      return () => {
        if (window.api?.removeAllListeners) {
          window.api.removeAllListeners('start-sharing')
        }
      }
    }
  }, [startSharing])

  // Listen for stop sharing events from main process
  useEffect(() => {
    if (window.api?.onStopSharing) {
      const handleStopSharing = () => {
        console.log('🔴 Stop sharing requested from main process')
        stopSharing()
      }

      window.api.onStopSharing(handleStopSharing)

      return () => {
        if (window.api?.removeAllListeners) {
          window.api.removeAllListeners('stop-sharing')
        }
      }
    }
  }, [stopSharing])

  // Listen for auto-connect events (legacy support)
  useEffect(() => {
    if (window.api?.onAutoConnect) {
      const handleAutoConnect = (event, data) => {
        console.log('🔄 Auto-connect requested from tray menu:', data)
        startSharing({
          room: data.room,
          serverUrl: data.serverUrl
        })
      }

      window.api.onAutoConnect(handleAutoConnect)

      return () => {
        if (window.api?.removeAllListeners) {
          window.api.removeAllListeners('auto-connect')
        }
      }
    }
  }, [startSharing])

  // Get stream URL for user
  const getStreamURL = useCallback(() => {
    const streamPort = 8080 // Should match your receiver port
    return `http://${localIP}:${streamPort}/web-receiver.html?room=${room}`
  }, [localIP, room])

  // Retry connection (useful when receiver becomes available)
  const retryConnection = useCallback(async () => {
    console.log('🔄 Retrying connection...')
    setError(null)
    await startSharing()
  }, [startSharing])

  // Open receiver URL in browser
  const openReceiverURL = useCallback(() => {
    const streamURL = getStreamURL()
    console.log('🔗 Opening receiver URL:', streamURL)
    if (window.api?.shell?.openExternal) {
      window.api.shell.openExternal(streamURL)
    } else if (window.open) {
      window.open(streamURL, '_blank')
    }
  }, [getStreamURL])

  // Get local IP address on mount
  useEffect(() => {
    const getIP = async () => {
      if (window.api?.getLocalIP) {
        try {
          const ip = await window.api.getLocalIP()
          console.log('🌐 Got local IP:', ip)
          setLocalIP(ip)
          // Update default server URL to use local IP
          setServerUrl(`ws://${ip}:8080`)
        } catch (error) {
          console.error('❌ Failed to get local IP:', error)
        }
      }
    }
    getIP()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSharing()
      stopStatsCollection()
    }
  }, [stopSharing, stopStatsCollection])

  return {
    // State
    connectionState,
    isStreaming,
    error,
    stats,
    room,
    serverUrl,
    localIP,

    // Actions
    startSharing,
    stopSharing,
    updateQuality,
    setRoom,
    setServerUrl,
    retryConnection,
    openReceiverURL,

    // Helpers
    getStreamURL,

    // Getters
    isActive: screenSenderRef.current?.isActive() || false,
    isConnected: connectionState === 'connected' || connectionState.startsWith('webrtc-connected')
  }
}
