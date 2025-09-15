import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // TV connection methods
  connectToTV: (tvInfo) => ipcRenderer.send('connect-to-tv', tvInfo),
  disconnect: () => ipcRenderer.send('disconnect'),
  discoverTVs: () => ipcRenderer.send('discover-tvs'),
  updateQuality: (settings) => ipcRenderer.send('update-quality', settings),

  // Streaming status methods
  streamingStarted: () => ipcRenderer.send('streaming-started'),
  streamingStopped: () => ipcRenderer.send('streaming-stopped'),

  // Network utilities
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),

  // Screen capture utilities
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

  // Event listeners
  onStartSharing: (callback) => ipcRenderer.on('start-sharing', callback),
  onStopSharing: (callback) => ipcRenderer.on('stop-sharing', callback),
  onAutoConnect: (callback) => ipcRenderer.on('auto-connect', callback),
  onDisconnect: (callback) => ipcRenderer.on('disconnect', callback),
  onTVsDiscovered: (callback) => ipcRenderer.on('tvs-discovered', callback),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
