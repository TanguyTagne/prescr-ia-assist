const { app, BrowserWindow, shell, ipcMain, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { exec } = require("child_process");

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

  // Force the window title to "Asclion" and prevent the loaded page from changing it
  mainWindow.setTitle("Asclion");
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    mainWindow.setTitle("Asclion");
  });

  // Always load remote URL with desktop flag + cache-buster to bypass any stale SW
  const getDesktopUrl = () => `${APP_URL}?desktop=1&v=${Date.now()}`;
  mainWindow.loadURL(getDesktopUrl());

  // Handle load failures — retry after a delay
  mainWindow.webContents.on("did-fail-load", (_event, _code, _desc, url) => {
    console.error("Failed to load:", url);
    setTimeout(() => {
      mainWindow.loadURL(getDesktopUrl());
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
    // Aggressively clear all caches to always load the latest version
    const { session } = require("electron");
    try {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({
        storages: ["cachestorage", "serviceworkers", "shadercache", "websql"],
      });
      await session.defaultSession.clearData({
        dataTypes: ["serviceWorkerRegistrations", "cache"],
      }).catch(() => {});
    } catch (e) {
      console.error("Cache clear failed:", e);
    }

    createWindow();

    // Detect installed LGO (Windows only) and forward to renderer when ready
    detectLgoAndNotify();

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

// ────────────────────────────────────────────────────────────
// IPC: Native notification (called from renderer via preload)
// ────────────────────────────────────────────────────────────
ipcMain.handle("notify", (_event, { title, body }) => {
  if (!Notification.isSupported()) return false;
  const notif = new Notification({
    title: title || "Asclion",
    body: body || "",
    icon: path.join(__dirname, "assets", "icon.ico"),
    silent: false,
  });
  notif.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("notification-clicked");
    }
  });
  notif.show();
  return true;
});

// ────────────────────────────────────────────────────────────
// LGO auto-detection (Windows only — silent fallback elsewhere)
// ────────────────────────────────────────────────────────────
function detectLgoAndNotify() {
  if (process.platform !== "win32") return;

  exec("tasklist /FO CSV /NH", { timeout: 5000 }, (err, stdout) => {
    if (err || !stdout) return;
    const lower = stdout.toLowerCase();

    let detected = null;
    if (/winpharma|wp\.exe|wpgest/.test(lower)) detected = "winpharma";
    else if (/lgpi/.test(lower)) detected = "lgpi";
    else if (/pharmagest|leo\.exe|leo_/.test(lower)) detected = "pharmagest";
    else if (/smartrx|smart_rx/.test(lower)) detected = "smart_rx";
    else if (/leopharm/.test(lower)) detected = "leo";

    if (!detected || !mainWindow) return;

    const send = () => {
      try {
        mainWindow.webContents.send("lgo-detected", { lgo: detected });
      } catch (_) { /* ignore */ }
    };
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once("did-finish-load", send);
    } else {
      send();
    }
  });
}

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
