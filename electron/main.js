const { app, BrowserWindow, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

// Disable hardware acceleration for compatibility
app.disableHardwareAcceleration();

let mainWindow;

const APP_URL = "https://prescr-ia-assist.lovable.app";
const getDesktopUrl = () => `${APP_URL}?desktop=1&t=${Date.now()}`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 580,
    minWidth: 340,
    minHeight: 480,
    maxWidth: 450,
    maxHeight: 700,
    resizable: true,
    title: "PrescrIA",
    icon: path.join(__dirname, "assets", "icon.ico"),
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#f4f6f5",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Remove the menu bar entirely
  mainWindow.setMenuBarVisibility(false);

  // Clear persistent web cache to avoid stale chunks causing white screens
  const clearAndLoad = async () => {
    try {
      await mainWindow.webContents.session.clearCache();
      await mainWindow.webContents.session.clearStorageData({
        storages: ["serviceworkers", "cachestorage"],
      });
    } catch (error) {
      console.error("Cache clear error:", error);
    }
    mainWindow.loadURL(getDesktopUrl());
  };

  clearAndLoad();

  // Handle load failures — retry after a delay (keep desktop mode)
  mainWindow.webContents.on("did-fail-load", (_event, _code, _desc, url) => {
    console.error("Failed to load:", url);
    setTimeout(() => {
      mainWindow?.loadURL(getDesktopUrl());
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
