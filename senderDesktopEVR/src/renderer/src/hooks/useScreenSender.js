import { useState, useEffect, useCallback, useRef } from 'react'
import ScreenSender from '../utils/ScreenSender'

export const useScreenSender = () => {
  const [connectionState, setConnectionState] = useState('disconnected')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [room, setRoom] = useState('default-room')
  const [serverUrl, setServerUrl] = useState('ws://localhost:8080')

  const screenSenderRef = useRef(null)
  const statsIntervalRef = useRef(null)

  // Create screen sender instance
  const createScreenSender = useCallback(
    (options = {}) => {
      const sender = new ScreenSender({
        signalingUrl: options.serverUrl || serverUrl,
        room: options.room || room,
        onStatusChange: (status, data) => {
          console.log('Status change:', status, data)
          setConnectionState(status)

          if (status === 'error' || status === 'failed') {
            setError(data)
          } else {
            setError(null)
          }
        },
        onStreamStarted: () => {
          console.log('Stream started')
          setIsStreaming(true)
          startStatsCollection()

          // Notify main process
          if (window.api?.streamingStarted) {
            window.api.streamingStarted()
          }
        },
        onStreamEnded: () => {
          console.log('Stream ended')
          setIsStreaming(false)
          stopStatsCollection()

          // Notify main process
          if (window.api?.streamingStopped) {
            window.api.streamingStopped()
          }
        },
        onError: (err) => {
          console.error('Screen sender error:', err)
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
        setError(null)

        // Update settings if provided
        if (options.room) setRoom(options.room)
        if (options.serverUrl) setServerUrl(options.serverUrl)

        // Stop existing sender
        if (screenSenderRef.current) {
          screenSenderRef.current.stop()
        }

        // Create new sender
        screenSenderRef.current = createScreenSender(options)

        // Start sharing
        await screenSenderRef.current.start()
      } catch (err) {
        console.error('Failed to start sharing:', err)
        setError(err.message || 'Failed to start screen sharing')
        setConnectionState('error')
      }
    },
    [createScreenSender]
  )

  // Stop screen sharing
  const stopSharing = useCallback(() => {
    if (screenSenderRef.current) {
      screenSenderRef.current.stop()
      screenSenderRef.current = null
    }
    setConnectionState('disconnected')
    setIsStreaming(false)
    stopStatsCollection()
  }, [])

  // Update quality settings
  const updateQuality = useCallback(async (settings) => {
    if (screenSenderRef.current) {
      try {
        await screenSenderRef.current.setEncodingParameters(settings)

        // Notify main process
        if (window.api?.updateQuality) {
          window.api.updateQuality(settings)
        }
      } catch (err) {
        console.error('Failed to update quality:', err)
        setError('Failed to update quality settings')
      }
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

  // Listen for auto-connect events from main process
  useEffect(() => {
    if (window.api?.onAutoConnect) {
      const handleAutoConnect = (event, data) => {
        console.log('Auto-connect requested:', data)
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

  // Listen for disconnect events from main process
  useEffect(() => {
    if (window.api?.onDisconnect) {
      const handleDisconnect = () => {
        console.log('Disconnect requested from main process')
        stopSharing()
      }

      window.api.onDisconnect(handleDisconnect)

      return () => {
        if (window.api?.removeAllListeners) {
          window.api.removeAllListeners('disconnect')
        }
      }
    }
  }, [stopSharing])

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

    // Actions
    startSharing,
    stopSharing,
    updateQuality,
    setRoom,
    setServerUrl,

    // Getters
    isActive: screenSenderRef.current?.isActive() || false,
    isConnected: connectionState === 'connected' || connectionState.startsWith('webrtc-connected')
  }
}
