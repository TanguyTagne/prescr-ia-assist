const { app, BrowserWindow, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

// Disable hardware acceleration for compatibility
app.disableHardwareAcceleration();

let mainWindow;

const APP_URL = "https://prescr-ia-assist.lovable.app";
const LOCAL_PATH = path.join(__dirname, "web", "index.html");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 580,
    minWidth: 340,
    minHeight: 480,
    maxWidth: 450,
    maxHeight: 700,
    resizable: true,
    title: "Asclion",
    icon: path.join(__dirname, "assets", "icon.ico"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Remove the menu bar entirely
  mainWindow.setMenuBarVisibility(false);

  // Always load remote URL with desktop flag
  mainWindow.loadURL(APP_URL + "?desktop=1");

  // Handle load failures — retry after a delay
  mainWindow.webContents.on("did-fail-load", (_event, _code, _desc, url) => {
    console.error("Failed to load:", url);
    setTimeout(() => {
      mainWindow.loadURL(APP_URL);
    }, 3000);
  });

  // Show window when ready to avoid white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Single instance lock — prevent multiple windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Clear cache to always load latest version
    const { session } = require("electron");
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
      storages: ["cachestorage", "serviceworkers"],
    });

    createWindow();

    // Check for updates silently
    autoUpdater.checkForUpdatesAndNotify();
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Auto-updater events
autoUpdater.on("update-available", () => {
  console.log("Update available, downloading...");
});

autoUpdater.on("update-downloaded", () => {
  console.log("Update downloaded. Will install on restart.");
  autoUpdater.quitAndInstall();
});

autoUpdater.on("error", (err) => {
  console.error("Auto-updater error:", err);
});
