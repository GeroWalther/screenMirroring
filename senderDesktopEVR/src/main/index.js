import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { Bonjour } from 'bonjour-service'
import icon from '../../resources/icon.png?asset'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

let tray = null
let mainWindow = null
let isStreaming = false
let connectedTV = null
let availableTVs = [
  { name: 'Living Room TV', ip: '192.168.1.100', room: 'livingroom' },
  { name: 'Bedroom TV', ip: '192.168.1.101', room: 'bedroom' },
  { name: 'Kitchen TV', ip: '192.168.1.102', room: 'kitchen' }
]

// mDNS discovery
let bonjour = null
let browser = null

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
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isStreaming ? `📺 Connected to ${connectedTV?.name || 'TV'}` : '📱 Screen Mirror',
      enabled: false
    },
    { type: 'separator' },

    // Connection status and disconnect option
    ...(isStreaming
      ? [
          {
            label: '🔴 Disconnect',
            click: () => {
              disconnectFromTV()
            }
          },
          { type: 'separator' }
        ]
      : []),

    // Available TVs submenu
    {
      label: '📺 Connect to...',
      enabled: !isStreaming,
      submenu: availableTVs.map((tv) => ({
        label: `${tv.name} (${tv.ip})`,
        click: () => {
          connectToTV(tv)
        }
      }))
    },

    { type: 'separator' },

    // Settings and controls
    {
      label: '⚙️ Settings',
      click: () => {
        createWindow()
      }
    },
    {
      label: '🔍 Discover TVs',
      click: () => {
        discoverTVs()
      }
    },

    { type: 'separator' },
    {
      label: '❌ Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

const connectToTV = async (tv) => {
  try {
    console.log(`Connecting to ${tv.name} at ${tv.ip}...`)

    // Update status
    isStreaming = true
    connectedTV = tv
    updateTrayMenu()

    // Create settings window if it doesn't exist
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow()
    }

    // Send connection details to renderer
    mainWindow.webContents.once('dom-ready', () => {
      mainWindow.webContents.send('auto-connect', {
        room: tv.room,
        serverUrl: `ws://${tv.ip}:8080`
      })
    })

    if (tray) {
      tray.displayBalloon({
        title: 'Screen Mirror',
        content: `Connecting to ${tv.name}...`,
        icon: nativeImage.createFromNamedImage('NSComputer')
      })
    }
  } catch (error) {
    console.error('Failed to connect:', error)
    isStreaming = false
    connectedTV = null
    updateTrayMenu()

    if (tray) {
      tray.displayBalloon({
        title: 'Connection Failed',
        content: `Could not connect to ${tv.name}`,
        icon: nativeImage.createFromNamedImage('NSCaution')
      })
    }
  }
}

const disconnectFromTV = () => {
  console.log(`Disconnecting from ${connectedTV?.name}...`)

  // Send disconnect signal to renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('disconnect')
  }

  // Update status
  isStreaming = false
  connectedTV = null
  updateTrayMenu()

  if (tray) {
    tray.displayBalloon({
      title: 'Screen Mirror',
      content: 'Disconnected from TV',
      icon: nativeImage.createFromNamedImage('NSComputer')
    })
  }
}

const initializeMDNS = () => {
  try {
    bonjour = new Bonjour()
    console.log('mDNS initialized')
  } catch (error) {
    console.error('Failed to initialize mDNS:', error)
  }
}

const discoverTVs = () => {
  console.log('Discovering TVs via mDNS...')

  if (!bonjour) {
    initializeMDNS()
  }

  if (tray) {
    tray.displayBalloon({
      title: 'Discovering TVs',
      content: 'Scanning for available TVs...',
      icon: nativeImage.createFromNamedImage('NSNetwork')
    })
  }

  // Clear existing discovered TVs
  const discoveredTVs = []

  if (bonjour) {
    // Browse for screen mirror services
    browser = bonjour.find({ type: 'screenmirror' }, (service) => {
      console.log('Found TV service:', service)

      const tv = {
        name: service.name || `TV at ${service.host}`,
        ip: service.referer?.address || service.host,
        port: service.port || 8080,
        room: service.txt?.room || 'default',
        type: service.type
      }

      // Avoid duplicates
      if (!discoveredTVs.find((t) => t.ip === tv.ip)) {
        discoveredTVs.push(tv)
      }
    })

    // Stop discovery after 5 seconds
    setTimeout(() => {
      if (browser) {
        browser.stop()
        browser = null
      }

      // Update available TVs with discovered ones
      if (discoveredTVs.length > 0) {
        availableTVs = [...availableTVs, ...discoveredTVs]
      }

      updateTrayMenu()

      if (tray) {
        tray.displayBalloon({
          title: 'Discovery Complete',
          content: `Found ${discoveredTVs.length} new TVs via mDNS`,
          icon: nativeImage.createFromNamedImage('NSComputer')
        })
      }

      console.log('TV discovery completed, found:', discoveredTVs)
    }, 5000)
  } else {
    // Fallback to static list
    setTimeout(() => {
      updateTrayMenu()
      if (tray) {
        tray.displayBalloon({
          title: 'Discovery Complete',
          content: `Found ${availableTVs.length} TVs (static list)`,
          icon: nativeImage.createFromNamedImage('NSComputer')
        })
      }
    }, 2000)
  }
}

function createWindow() {
  // Prevent multiple windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus()
    return
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    title: 'Screen Mirror - Settings',
    show: false,
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
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
  connectToTV(tvInfo)
})

ipcMain.on('disconnect', () => {
  disconnectFromTV()
})

ipcMain.on('discover-tvs', () => {
  discoverTVs()
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

  // Initialize mDNS
  initializeMDNS()

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
