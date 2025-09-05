const {
  app,
  Tray,
  Menu,
  BrowserWindow,
  nativeImage,
  ipcMain,
} = require('electron');
const path = require('node:path');
const { Bonjour } = require('bonjour-service');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let tray = null;
let mainWindow = null;
let isStreaming = false;
let connectedTV = null;
let availableTVs = [
  { name: 'Living Room TV', ip: '192.168.1.100', room: 'livingroom' },
  { name: 'Bedroom TV', ip: '192.168.1.101', room: 'bedroom' },
  { name: 'Kitchen TV', ip: '192.168.1.102', room: 'kitchen' },
];

// mDNS discovery
let bonjour = null;
let browser = null;

const createTray = () => {
  // Create tray icon - using emoji as requested
  const icon = nativeImage.createFromNamedImage('NSComputer', [16, 16]);
  tray = new Tray(icon);

  tray.setToolTip('Screen Mirror');
  updateTrayMenu();

  // Handle tray icon click
  tray.on('click', () => {
    updateTrayMenu();
  });
};

const updateTrayMenu = () => {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isStreaming
        ? `📺 Connected to ${connectedTV?.name || 'TV'}`
        : '📱 Screen Mirror',
      enabled: false,
    },
    { type: 'separator' },

    // Connection status and disconnect option
    ...(isStreaming
      ? [
          {
            label: '🔴 Disconnect',
            click: () => {
              disconnectFromTV();
            },
          },
          { type: 'separator' },
        ]
      : []),

    // Available TVs submenu
    {
      label: '📺 Connect to...',
      enabled: !isStreaming,
      submenu: availableTVs.map((tv) => ({
        label: `${tv.name} (${tv.ip})`,
        click: () => {
          connectToTV(tv);
        },
      })),
    },

    { type: 'separator' },

    // Settings and controls
    {
      label: '⚙️ Settings',
      click: () => {
        createSettingsWindow();
      },
    },
    {
      label: '🔍 Discover TVs',
      click: () => {
        discoverTVs();
      },
    },

    { type: 'separator' },
    {
      label: '❌ Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
};

const connectToTV = async (tv) => {
  try {
    console.log(`Connecting to ${tv.name} at ${tv.ip}...`);

    // Update status
    isStreaming = true;
    connectedTV = tv;
    updateTrayMenu();

    // Here we'll integrate with the WebRTC functionality
    // For now, simulate connection
    tray.displayBalloon({
      title: 'Screen Mirror',
      content: `Connected to ${tv.name}`,
      icon: nativeImage.createFromNamedImage('NSComputer'),
    });
  } catch (error) {
    console.error('Failed to connect:', error);
    tray.displayBalloon({
      title: 'Connection Failed',
      content: `Could not connect to ${tv.name}`,
      icon: nativeImage.createFromNamedImage('NSCaution'),
    });
  }
};

const disconnectFromTV = () => {
  console.log(`Disconnecting from ${connectedTV?.name}...`);

  // Update status
  isStreaming = false;
  connectedTV = null;
  updateTrayMenu();

  tray.displayBalloon({
    title: 'Screen Mirror',
    content: 'Disconnected from TV',
    icon: nativeImage.createFromNamedImage('NSComputer'),
  });
};

const initializeMDNS = () => {
  try {
    bonjour = new Bonjour();
    console.log('mDNS initialized');
  } catch (error) {
    console.error('Failed to initialize mDNS:', error);
  }
};

const discoverTVs = () => {
  console.log('Discovering TVs via mDNS...');

  if (!bonjour) {
    initializeMDNS();
  }

  tray.displayBalloon({
    title: 'Discovering TVs',
    content: 'Scanning for available TVs...',
    icon: nativeImage.createFromNamedImage('NSNetwork'),
  });

  // Clear existing discovered TVs
  const discoveredTVs = [];

  if (bonjour) {
    // Browse for screen mirror services
    browser = bonjour.find({ type: 'screenmirror' }, (service) => {
      console.log('Found TV service:', service);

      const tv = {
        name: service.name || `TV at ${service.host}`,
        ip: service.referer?.address || service.host,
        port: service.port || 8080,
        room: service.txt?.room || 'default',
        type: service.type,
      };

      // Avoid duplicates
      if (!discoveredTVs.find((t) => t.ip === tv.ip)) {
        discoveredTVs.push(tv);
      }
    });

    // Stop discovery after 5 seconds
    setTimeout(() => {
      if (browser) {
        browser.stop();
        browser = null;
      }

      // Update available TVs with discovered ones
      if (discoveredTVs.length > 0) {
        availableTVs = [...availableTVs, ...discoveredTVs];
      }

      updateTrayMenu();

      tray.displayBalloon({
        title: 'Discovery Complete',
        content: `Found ${discoveredTVs.length} new TVs via mDNS`,
        icon: nativeImage.createFromNamedImage('NSComputer'),
      });

      console.log('TV discovery completed, found:', discoveredTVs);
    }, 5000);
  } else {
    // Fallback to static list
    setTimeout(() => {
      updateTrayMenu();
      tray.displayBalloon({
        title: 'Discovery Complete',
        content: `Found ${availableTVs.length} TVs (static list)`,
        icon: nativeImage.createFromNamedImage('NSComputer'),
      });
    }, 2000);
  }
};

const createSettingsWindow = () => {
  // Prevent multiple settings windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }

  // Create the settings window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Screen Mirror - Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'settings.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Hide window instead of closing when user clicks X
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
};

// IPC handlers
ipcMain.on('connect-to-tv', (event, tvInfo) => {
  connectToTV(tvInfo);
});

ipcMain.on('disconnect', () => {
  disconnectFromTV();
});

ipcMain.on('discover-tvs', () => {
  discoverTVs();
});

ipcMain.on('update-quality', (event, settings) => {
  console.log('Quality settings updated:', settings);
  // TODO: Apply quality settings to WebRTC connection
});

// App event handlers
app.whenReady().then(() => {
  // Hide dock icon on macOS (makes it a true menu bar app)
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  // Initialize mDNS
  initializeMDNS();

  createTray();
});

app.on('window-all-closed', (event) => {
  // Prevent app from quitting when all windows are closed
  event.preventDefault();
});

app.on('before-quit', () => {
  app.isQuiting = true;

  // Cleanup mDNS
  if (browser) {
    browser.stop();
  }
  if (bonjour) {
    bonjour.destroy();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
