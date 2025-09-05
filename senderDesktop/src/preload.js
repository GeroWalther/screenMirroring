const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for status updates from main process
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, status, message, tvName) => {
      callback(status, message, tvName);
    });
  },

  // Send commands to main process
  connectToTV: (tvInfo) => {
    ipcRenderer.send('connect-to-tv', tvInfo);
  },

  disconnect: () => {
    ipcRenderer.send('disconnect');
  },

  discoverTVs: () => {
    ipcRenderer.send('discover-tvs');
  },

  updateQuality: (settings) => {
    ipcRenderer.send('update-quality', settings);
  },
});
