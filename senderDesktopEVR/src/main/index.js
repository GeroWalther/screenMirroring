import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { networkInterfaces } from 'os'
import icon from '../../resources/icon.png?asset'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

let tray = null
let mainWindow = null
let isStreaming = false
let currentRoom = 'living-room'
let signalingServerPort = 8080

// Get local IP address
const getLocalIPAddress = () => {
  const nets = networkInterfaces()
  const results = []

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address)
      }
    }
  }

  // Prefer 192.168.x.x addresses (most common for home networks)
  const homeNetwork = results.find((ip) => ip.startsWith('192.168.'))
  if (homeNetwork) {
    console.log('🏠 Detected home network IP:', homeNetwork)
    return homeNetwork
  }

  // Fallback to first available IP
  const fallback = results[0] || 'localhost'
  console.log('🌐 Using IP address:', fallback)
  return fallback
}

// Generate stream URL for sharing
const getStreamURL = () => {
  const localIP = getLocalIPAddress()
  const streamPort = 8080 // Your working stream server port
  return `http://${localIP}:${streamPort}/web-receiver.html?room=${currentRoom}`
}

const createTray = () => {
  try {
    console.log('Creating system tray...')

    // Create tray icon - using system icon for better compatibility
    const trayIcon = nativeImage.createFromNamedImage('NSComputer', [16, 16])
    tray = new Tray(trayIcon)

    console.log('Tray created successfully')

    tray.setToolTip('Screen Mirror - Click to open menu')
    updateTrayMenu()

    // Handle tray icon click
    tray.on('click', () => {
      console.log('Tray clicked')
      updateTrayMenu()
    })
  } catch (error) {
    console.error('Failed to create tray:', error)
    // Fallback: just create the main window
    createWindow()
  }
}

const updateTrayMenu = () => {
  const streamURL = getStreamURL()
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isStreaming ? '📺 Screen Mirror - Sharing' : '📱 Screen Mirror',
      enabled: false
    },
    { type: 'separator' },

    // Stream URL info when sharing
    ...(isStreaming
      ? [
          {
            label: '📺 Stream URL:',
            enabled: false
          },
          {
            label: streamURL,
            click: () => {
              // Copy to clipboard and open in browser
              shell.writeTextToClipboard(streamURL)
              shell.openExternal(streamURL)
            }
          },
          { type: 'separator' },
          {
            label: '🔴 Stop Sharing',
            click: () => stopSharing()
          },
          { type: 'separator' }
        ]
      : []),

    // Room info
    {
      label: `Room: ${currentRoom}`,
      enabled: false
    },

    { type: 'separator' },
    {
      label: '✈️ Open',
      click: () => createWindow()
    },
    {
      label: '❌ Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

const startSharing = async () => {
  try {
    console.log('🚀 Starting screen sharing...')

    // Update status
    isStreaming = true
    updateTrayMenu()

    // Create settings window if it doesn't exist
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow()
    }

    // Send start sharing signal to renderer
    mainWindow.webContents.once('dom-ready', () => {
      const localIP = getLocalIPAddress()
      mainWindow.webContents.send('start-sharing', {
        room: currentRoom,
        serverUrl: `ws://${localIP}:${signalingServerPort}`,
        streamUrl: getStreamURL()
      })
    })

    if (tray) {
      const streamURL = getStreamURL()
      tray.displayBalloon({
        title: 'Screen Mirror',
        content: `Screen sharing started successfully! Stream is active.`,
        icon: nativeImage.createFromNamedImage('NSComputer')
      })
    }
  } catch (error) {
    console.error('Failed to start sharing:', error)
    isStreaming = false
    updateTrayMenu()

    if (tray) {
      tray.displayBalloon({
        title: 'Sharing Failed',
        content: 'Could not start screen sharing. Please try again.',
        icon: nativeImage.createFromNamedImage('NSCaution')
      })
    }
  }
}

const stopSharing = () => {
  console.log('🔴 Stopping screen sharing...')

  // Send stop sharing signal to renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stop-sharing')
  }

  // Update status
  isStreaming = false
  updateTrayMenu()

  if (tray) {
    tray.displayBalloon({
      title: 'Screen Mirror',
      content: 'Screen sharing stopped',
      icon: nativeImage.createFromNamedImage('NSComputer')
    })
  }
}

function createWindow() {
  console.log('🖼️ Creating main window...')
  // Prevent multiple windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('🖼️ Main window already exists, focusing...')
    mainWindow.show() // Ensure it's visible
    mainWindow.focus()
    mainWindow.center() // Center on screen
    mainWindow.setAlwaysOnTop(true) // Bring to front
    setTimeout(() => mainWindow.setAlwaysOnTop(false), 1000) // Remove always on top after 1s
    return
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    title: 'Screen Mirror - Settings',
    show: true,
    autoHideMenuBar: true,
    resizable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Required for getDisplayMedia
      allowRunningInsecureContent: true, // Allow screen capture
      experimentalFeatures: true, // Enable experimental web APIs
      enableRemoteModule: false
    }
  })

  console.log('🖼️ Main window created successfully')

  mainWindow.on('ready-to-show', () => {
    console.log('🖼️ Main window ready to show')
    mainWindow.show()

    // Auto-open DevTools in development
    if (is.dev) {
      console.log('🔧 Opening DevTools for debugging')
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Hide window instead of closing when user clicks X
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC handlers
ipcMain.on('connect-to-tv', (event, tvInfo) => {
  console.log('Legacy connect-to-tv - using startSharing instead')
  startSharing()
})

ipcMain.on('disconnect', () => {
  console.log('Legacy disconnect - using stopSharing instead')
  stopSharing()
})

// mDNS discovery removed - now using simple share/stop model
ipcMain.on('discover-tvs', () => {
  console.log('TV discovery disabled - using direct streaming model')
})

ipcMain.on('update-quality', (event, settings) => {
  console.log('Quality settings updated:', settings)
  // Quality settings will be handled in the renderer process
})

ipcMain.on('streaming-started', () => {
  isStreaming = true
  updateTrayMenu()
})

ipcMain.on('streaming-stopped', () => {
  isStreaming = false
  connectedTV = null
  updateTrayMenu()
})

// Get local IP address for renderer
ipcMain.handle('get-local-ip', () => {
  return getLocalIPAddress()
})

// Handle room updates from renderer
ipcMain.on('update-room', (event, newRoom) => {
  console.log('🏠 Main process received room update:', newRoom)
  currentRoom = newRoom
  updateTrayMenu() // Update tray menu with new room
})

// Get current room (for renderer to sync on startup)
ipcMain.handle('get-current-room', () => {
  return currentRoom
})

// Get desktop sources for screen capture
ipcMain.handle('get-desktop-sources', async () => {
  const { desktopCapturer } = require('electron')
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'], // Only get screen sources, not individual windows
      thumbnailSize: { width: 300, height: 200 }
    })
    console.log('📺 Found', sources.length, 'screen sources')

    // Sort sources to prioritize primary display
    const sortedSources = sources.sort((a, b) => {
      // Put "Entire screen" or "Screen 1" first
      if (a.name.includes('Entire screen') || a.name.includes('Screen 1')) return -1
      if (b.name.includes('Entire screen') || b.name.includes('Screen 1')) return 1
      return 0
    })

    return sortedSources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }))
  } catch (error) {
    console.error('Failed to get desktop sources:', error)
    throw error
  }
})

// Handle opening external URLs
ipcMain.handle('shell-open-external', async (event, url) => {
  try {
    console.log('🌐 Opening external URL:', url)
    await shell.openExternal(url)
    return { success: true }
  } catch (error) {
    console.error('Failed to open external URL:', error)
    throw error
  }
})

// Enable screen capture command line switches
app.commandLine.appendSwitch('enable-media-stream')
app.commandLine.appendSwitch('enable-usermedia-screen-capturing')
app.commandLine.appendSwitch('allow-http-screen-capture')
app.commandLine.appendSwitch('disable-web-security') // Allow getDisplayMedia

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  console.log('Electron app is ready')

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.waltherandstilling.screenmirror')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Create tray
  createTray()

  // Create initial window for testing
  setTimeout(() => {
    console.log('Opening settings window for testing...')
    createWindow()
  }, 1000)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  console.log('App initialization complete')
})

app.on('window-all-closed', (event) => {
  // Prevent app from quitting when all windows are closed
  event.preventDefault()
})

app.on('before-quit', () => {
  app.isQuiting = true

  // Cleanup mDNS
  if (browser) {
    browser.stop()
  }
  if (bonjour) {
    bonjour.destroy()
  }
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
