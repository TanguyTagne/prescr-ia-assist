const { app, BrowserWindow, shell, ipcMain, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

// ────────────────────────────────────────────────────────────
// Picture-in-Picture state (always-on-top + compact mode)
// ────────────────────────────────────────────────────────────
const SIZE_NORMAL = { width: 380, height: 580 };
const SIZE_COMPACT = { width: 300, height: 440 };
let pipState = { alwaysOnTop: true, compact: false };

function getStateFile() {
  return path.join(app.getPath("userData"), "pip-state.json");
}
function loadPipState() {
  try {
    const raw = fs.readFileSync(getStateFile(), "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.alwaysOnTop === "boolean") pipState.alwaysOnTop = parsed.alwaysOnTop;
    if (typeof parsed.compact === "boolean") pipState.compact = parsed.compact;
  } catch { /* first run */ }
}
function savePipState() {
  try {
    fs.writeFileSync(getStateFile(), JSON.stringify(pipState));
  } catch (e) { console.error("PiP state save failed:", e); }
}
function applyPipState() {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(pipState.alwaysOnTop, "floating");
  try {
    mainWindow.setVisibleOnAllWorkspaces(pipState.alwaysOnTop, { visibleOnFullScreen: true });
  } catch { /* not supported on all platforms */ }
  const size = pipState.compact ? SIZE_COMPACT : SIZE_NORMAL;
  mainWindow.setSize(size.width, size.height);
}

// Disable hardware acceleration for compatibility
app.disableHardwareAcceleration();

let mainWindow;

const APP_URL = "https://prescr-ia-assist.lovable.app";
const LOCAL_PATH = path.join(__dirname, "web", "index.html");

function createWindow() {
  loadPipState();
  const initSize = pipState.compact ? SIZE_COMPACT : SIZE_NORMAL;
  mainWindow = new BrowserWindow({
    width: initSize.width,
    height: initSize.height,
    minWidth: 280,
    minHeight: 400,
    maxWidth: 520,
    maxHeight: 800,
    resizable: true,
    alwaysOnTop: pipState.alwaysOnTop,
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

  if (pipState.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, "floating");
    try {
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch { /* not supported */ }
  }

  // Remove the menu bar entirely
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setUserAgent(`${mainWindow.webContents.getUserAgent()} AsclionDesktop`);

  // Force the window title to "Asclion" and prevent the loaded page from changing it
  mainWindow.setTitle("Asclion");
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    mainWindow.setTitle("Asclion");
  });

  // Always load remote URL with desktop flag + cache-buster to bypass any stale SW
  const getDesktopUrl = () => `${APP_URL}/?desktop=1&v=${Date.now()}`;
  mainWindow.loadURL(getDesktopUrl());

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) return;
    const next = new URL(url);
    if (next.searchParams.get("desktop") === "1") return;
    event.preventDefault();
    next.searchParams.set("desktop", "1");
    next.searchParams.set("v", String(Date.now()));
    mainWindow.loadURL(next.toString());
  });

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

    // Register Windows daily auto-launch at 08:30
    registerDailyAutoLaunch();

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
ipcMain.handle("pip:get-state", () => ({ ...pipState }));
ipcMain.handle("pip:toggle", () => {
  pipState.alwaysOnTop = !pipState.alwaysOnTop;
  applyPipState();
  savePipState();
  return { ...pipState };
});
ipcMain.handle("pip:set-compact", (_e, compact) => {
  pipState.compact = !!compact;
  applyPipState();
  savePipState();
  return { ...pipState };
});

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
// Attention IPC: flash taskbar icon + bring window to front
// ────────────────────────────────────────────────────────────
ipcMain.handle("attention:flash", () => {
  if (!mainWindow) return false;
  try {
    mainWindow.flashFrame(true);
    const stop = () => {
      try { mainWindow && mainWindow.flashFrame(false); } catch { /* noop */ }
    };
    mainWindow.once("focus", stop);
  } catch (e) {
    console.error("flashFrame failed:", e);
  }
  return true;
});

ipcMain.handle("attention:bring-to-front", () => {
  if (!mainWindow) return false;
  try {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    // Force-foreground hack: temporarily pin always-on-top, then restore PiP state
    const wasOnTop = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(true, "floating");
    mainWindow.moveTop();
    mainWindow.focus();
    setTimeout(() => {
      try {
        if (!mainWindow) return;
        // Restore the persisted PiP preference (not the temporary force)
        mainWindow.setAlwaysOnTop(pipState.alwaysOnTop, "floating");
        if (!pipState.alwaysOnTop && wasOnTop === false) {
          mainWindow.setAlwaysOnTop(false);
        }
      } catch { /* noop */ }
    }, 250);
  } catch (e) {
    console.error("bring-to-front failed:", e);
  }
  return true;
});

ipcMain.handle("attention:is-focused", () => {
  return !!(mainWindow && mainWindow.isFocused());
});

// ────────────────────────────────────────────────────────────
// LGO auto-detection (Windows only — silent fallback elsewhere)
// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// Auto-launch every day at 08:30 (Windows Task Scheduler)
// ────────────────────────────────────────────────────────────
function registerDailyAutoLaunch() {
  if (process.platform !== "win32") return;
  const TASK_NAME = "AsclionDailyLaunch";
  const exePath = process.execPath;
  // Recreate the task on every startup so the exe path stays valid after updates.
  const cmd = `schtasks /Create /TN "${TASK_NAME}" /TR "\\"${exePath}\\"" /SC DAILY /ST 08:30 /F /RL LIMITED`;
  exec(cmd, { windowsHide: true, timeout: 8000 }, (err, _stdout, stderr) => {
    if (err) {
      console.error("Daily auto-launch task registration failed:", stderr || err.message);
    } else {
      console.log("Daily auto-launch task registered (08:30).");
    }
  });
}

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
