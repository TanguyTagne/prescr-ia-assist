const { app, BrowserWindow, shell, ipcMain, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

// Load uiohook-napi lazily — if the native binary fails to load (rare),
// the app keeps working without the global scanner.
let uIOhook = null;
let UiohookKey = null;
try {
  const mod = require("uiohook-napi");
  uIOhook = mod.uIOhook;
  UiohookKey = mod.UiohookKey;
} catch (e) {
  console.error("[ASCLION-SCAN] uiohook-napi unavailable:", e && e.message);
}


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

    // Register Windows auto-launch tasks (at boot + 08:30 + 09:00 catch-up)
    registerAutoLaunch();

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
// Robust auto-launch (Windows Task Scheduler via XML)
// 3 tasks: at boot, daily 08:30, daily 09:00 (catch-up)
// Runs as SYSTEM so it fires even when no user is logged in.
// Falls back to current user if SYSTEM registration is refused.
// ────────────────────────────────────────────────────────────
const AUTOLAUNCH_TASKS = [
  { name: "AsclionAtBoot", kind: "boot" },
  { name: "AsclionDaily0830", kind: "daily", time: "08:30:00" },
  { name: "AsclionDaily0900", kind: "daily", time: "09:00:00" },
];

function buildTaskXml({ kind, time, exePath }) {
  const exeEscaped = exePath
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const trigger =
    kind === "boot"
      ? `<BootTrigger><Enabled>true</Enabled><Delay>PT30S</Delay></BootTrigger>`
      : `<CalendarTrigger>
           <StartBoundary>2026-01-01T${time}</StartBoundary>
           <Enabled>true</Enabled>
           <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
         </CalendarTrigger>`;
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>Asclion</Author>
    <Description>Lancement automatique d'Asclion</Description>
  </RegistrationInfo>
  <Triggers>${trigger}</Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <DisallowStartOnRemoteAppSession>false</DisallowStartOnRemoteAppSession>
    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>
    <WakeToRun>true</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT5M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${exeEscaped}</Command>
    </Exec>
  </Actions>
</Task>`;
}

function buildTaskXmlUser({ kind, time, exePath }) {
  // Fallback: same XML but principal = current interactive user (no SYSTEM)
  const xml = buildTaskXml({ kind, time, exePath });
  return xml
    .replace(/<UserId>S-1-5-18<\/UserId>/, `<GroupId>S-1-5-32-545</GroupId>`)
    .replace(/<RunLevel>HighestAvailable<\/RunLevel>/, `<RunLevel>LeastPrivilege</RunLevel>`);
}

function execAsync(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true, timeout: 10000 }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code || 1 : 0, stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

function writeAutolaunchState(state) {
  try {
    fs.writeFileSync(
      path.join(app.getPath("userData"), "autolaunch-state.json"),
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)
    );
  } catch (e) {
    console.error("autolaunch state save failed:", e);
  }
}

async function registerAutoLaunch() {
  if (process.platform !== "win32") return;
  const exePath = process.execPath;
  const tmpDir = app.getPath("temp");
  const results = [];

  for (const task of AUTOLAUNCH_TASKS) {
    const xmlPath = path.join(tmpDir, `${task.name}.xml`);
    let registered = false;
    let mode = "system";
    let lastError = "";

    try {
      // 1st attempt: SYSTEM principal (runs without logged-in user)
      const xml = buildTaskXml({ kind: task.kind, time: task.time, exePath });
      fs.writeFileSync(xmlPath, "\uFEFF" + xml, { encoding: "utf16le" });
      let r = await execAsync(
        `schtasks /Create /TN "${task.name}" /XML "${xmlPath}" /F /RU SYSTEM`
      );
      if (r.code === 0) {
        registered = true;
      } else {
        lastError = r.stderr || r.stdout;
        // 2nd attempt: current user fallback (no UAC needed, but requires session)
        const xmlUser = buildTaskXmlUser({ kind: task.kind, time: task.time, exePath });
        fs.writeFileSync(xmlPath, "\uFEFF" + xmlUser, { encoding: "utf16le" });
        r = await execAsync(`schtasks /Create /TN "${task.name}" /XML "${xmlPath}" /F`);
        if (r.code === 0) {
          registered = true;
          mode = "user";
        } else {
          lastError = r.stderr || r.stdout || lastError;
        }
      }
    } catch (e) {
      lastError = String(e && e.message ? e.message : e);
    } finally {
      try { fs.unlinkSync(xmlPath); } catch { /* ignore */ }
    }

    results.push({ name: task.name, kind: task.kind, time: task.time || null, registered, mode, error: registered ? null : lastError.trim().slice(0, 500) });
    if (registered) {
      console.log(`Auto-launch task "${task.name}" registered (${mode}).`);
    } else {
      console.error(`Auto-launch task "${task.name}" failed:`, lastError);
    }
  }

  writeAutolaunchState({ tasks: results });
  return results;
}

async function queryAutoLaunchStatus() {
  if (process.platform !== "win32") return { platform: process.platform, tasks: [] };
  const tasks = [];
  for (const t of AUTOLAUNCH_TASKS) {
    const r = await execAsync(`schtasks /Query /TN "${t.name}" /FO LIST /V`);
    const exists = r.code === 0;
    let nextRun = null;
    let lastRun = null;
    let lastResult = null;
    if (exists) {
      const lines = r.stdout.split(/\r?\n/);
      const grab = (label) => {
        const line = lines.find((l) => l.trim().toLowerCase().startsWith(label.toLowerCase()));
        return line ? line.split(":").slice(1).join(":").trim() : null;
      };
      nextRun = grab("Next Run Time") || grab("Prochaine exécution");
      lastRun = grab("Last Run Time") || grab("Dernière exécution");
      lastResult = grab("Last Result") || grab("Dernier résultat");
    }
    tasks.push({ name: t.name, kind: t.kind, exists, nextRun, lastRun, lastResult });
  }
  return { platform: "win32", tasks };
}

ipcMain.handle("autolaunch:status", async () => queryAutoLaunchStatus());
ipcMain.handle("autolaunch:reinstall", async () => {
  const results = await registerAutoLaunch();
  return { results, status: await queryAutoLaunchStatus() };
});

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
