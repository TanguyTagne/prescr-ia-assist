const { app, BrowserWindow, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

// Disable hardware acceleration for compatibility
app.disableHardwareAcceleration();

let mainWindow;

const APP_URL = "https://prescr-ia-assist.lovable.app";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "PrescrIA",
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

  // Load the published app
  mainWindow.loadURL(APP_URL);

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

  app.whenReady().then(() => {
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
