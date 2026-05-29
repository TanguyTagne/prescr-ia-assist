const { app, BrowserWindow, shell, ipcMain, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
// Load uiohook-napi lazily — if the native binary fails to load (rare),
// the app keeps working without the global scanner.
let uIOhook = null;
let UiohookKey = null;
let uiohookLoadError = null;
try {
  const mod = require("uiohook-napi");
  uIOhook = mod.uIOhook;
  UiohookKey = mod.UiohookKey;
} catch (e) {
  uiohookLoadError = e && e.message;
  console.error("[ASCLION-SCAN] uiohook-napi unavailable:", uiohookLoadError);
}
// Load node-hid lazily — direct HID device reader (not blocked by antivirus
// because it does NOT install a low-level keyboard hook).
let HID = null;
let hidLoadError = null;
try {
  HID = require("node-hid");
  try {
    if (process.platform === "win32" && typeof HID.setDriverType === "function") {
      // hidraw allows opening the keyboard collection of a scanner non-exclusively
      HID.setDriverType("hidraw");
    }
  } catch (_) { /* noop */ }
} catch (e) {
  hidLoadError = e && e.message;
  console.error("[ASCLION-SCAN] node-hid unavailable:", hidLoadError);
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
  } catch {
    /* first run */
  }
}
function savePipState() {
  try {
    fs.writeFileSync(getStateFile(), JSON.stringify(pipState));
  } catch (e) {
    devWarn("PiP state save failed:", e);
  }
}
function applyPipState() {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(pipState.alwaysOnTop, "floating");
  try {
    mainWindow.setVisibleOnAllWorkspaces(pipState.alwaysOnTop, { visibleOnFullScreen: true });
  } catch {
    /* not supported on all platforms */
  }
  const size = pipState.compact ? SIZE_COMPACT : SIZE_NORMAL;
  mainWindow.setSize(size.width, size.height);
}
// Disable hardware acceleration for compatibility
app.disableHardwareAcceleration();

// Dev-only logger — avoids leaking internal state in production builds
const isDev = process.env.NODE_ENV !== "production";
const devLog = (...args) => isDev && console.log(...args);
const devWarn = (...args) => isDev && console.warn(...args);
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
      sandbox: true,
    },
  });
  if (pipState.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, "floating");
    try {
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch {
      /* not supported */
    }
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
    devWarn("Failed to load:", url);
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
      await session.defaultSession
        .clearData({
          dataTypes: ["serviceWorkerRegistrations", "cache"],
        })
        .catch(() => {});
    } catch (e) {
      devWarn("Cache clear failed:", e);
    }
    createWindow();
    // Register Windows auto-launch tasks (at boot + 08:30 + 09:00 catch-up)
    registerAutoLaunch();
    // Detect installed LGO (Windows only) and forward to renderer when ready
    detectLgoAndNotify();
    // Boot scanner stack: direct HID read (preferred, AV-friendly) + uiohook fallback
    bootScannerStack();
    // Check for updates silently
    autoUpdater.checkForUpdatesAndNotify();
  });
}
app.on("window-all-closed", () => {
  // Keep the global HID listener alive even if the user closes the window.
  // The window will be re-created automatically on the next scan or on activate.
  // On macOS we follow the convention of staying in the dock; on Windows/Linux
  // we also stay alive so scans can pop the widget back to front.
  // The user can fully quit via the tray / Task Manager.
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
      try {
        mainWindow && mainWindow.flashFrame(false);
      } catch {
        /* noop */
      }
    };
    mainWindow.once("focus", stop);
  } catch (e) {
    devWarn("flashFrame failed:", e);
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
      } catch {
        /* noop */
      }
    }, 250);
  } catch (e) {
    devWarn("bring-to-front failed:", e);
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
  const exeEscaped = exePath.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      <RunLevel>LeastPrivilege</RunLevel>
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
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
    );
  } catch (e) {
    devWarn("autolaunch state save failed:", e);
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
      fs.writeFileSync(xmlPath, "﻿" + xml, { encoding: "utf16le" });
      let r = await execAsync(`schtasks /Create /TN "${task.name}" /XML "${xmlPath}" /F /RU SYSTEM`);
      if (r.code === 0) {
        registered = true;
      } else {
        lastError = r.stderr || r.stdout;
        // 2nd attempt: current user fallback (no UAC needed, but requires session)
        const xmlUser = buildTaskXmlUser({ kind: task.kind, time: task.time, exePath });
        fs.writeFileSync(xmlPath, "﻿" + xmlUser, { encoding: "utf16le" });
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
      try {
        fs.unlinkSync(xmlPath);
      } catch {
        /* ignore */
      }
    }
    results.push({
      name: task.name,
      kind: task.kind,
      time: task.time || null,
      registered,
      mode,
      error: registered ? null : lastError.trim().slice(0, 500),
    });
    if (registered) {
      devLog(`Auto-launch task "${task.name}" registered (${mode}).`);
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
      } catch (_) {
        /* ignore */
      }
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
  devLog("Update available, downloading...");
});
autoUpdater.on("update-downloaded", () => {
  devLog("Update downloaded. Will install on restart.");
  autoUpdater.quitAndInstall();
});
autoUpdater.on("error", (err) => {
  console.error("Auto-updater error:", err);
});
// ────────────────────────────────────────────────────────────
// Global HID barcode scanner listener (uiohook-napi)
//
// Captures keystrokes system-wide, even when Asclion is not the focused
// window. Detects EAN-13 / CIP-13 (13 digits typed in <80ms, terminated by
// Enter). Does NOT consume the events → the LGO keeps receiving the scan.
// On valid scan, forwards the code to the renderer and brings the window
// to front WITHOUT stealing focus (showInactive + flashFrame).
// ────────────────────────────────────────────────────────────
const SCAN_MAX_KEY_INTERVAL_MS = 80;
const SCAN_MIN_LENGTH = 7;
const SCAN_MAX_LENGTH = 60; // GS1 DataMatrix payloads can be long
const SCAN_DEDUP_WINDOW_MS = 800;
const SCAN_RESET_INACTIVITY_MS = 400;
let scanBuffer = "";
let scanLastKeyAt = 0;
let scanResetTimer = null;
let scanLastEmitted = { code: "", at: 0 };
function charFromKeycode(keycode, rawKeychar) {
  if (!UiohookKey) return null;
  // 1) Numbers — top row + numpad (works whether NumLock is on or off,
  //    because we map the physical keycode, not the resulting char)
  const digitMap = {
    [UiohookKey["0"]]: "0",
    [UiohookKey["1"]]: "1",
    [UiohookKey["2"]]: "2",
    [UiohookKey["3"]]: "3",
    [UiohookKey["4"]]: "4",
    [UiohookKey["5"]]: "5",
    [UiohookKey["6"]]: "6",
    [UiohookKey["7"]]: "7",
    [UiohookKey["8"]]: "8",
    [UiohookKey["9"]]: "9",
    [UiohookKey.Numpad0]: "0",
    [UiohookKey.Numpad1]: "1",
    [UiohookKey.Numpad2]: "2",
    [UiohookKey.Numpad3]: "3",
    [UiohookKey.Numpad4]: "4",
    [UiohookKey.Numpad5]: "5",
    [UiohookKey.Numpad6]: "6",
    [UiohookKey.Numpad7]: "7",
    [UiohookKey.Numpad8]: "8",
    [UiohookKey.Numpad9]: "9",
  };
  if (digitMap[keycode] !== undefined) return digitMap[keycode];
  // 2) Letters, digits & GS1 chars (parens, FNC1/GS=\x1d) — accept any printable
  //    single char emitted by uiohook for DataMatrix payloads.
  //    FIX: digits (ASCII 48-57) are now included so douchettes that route
  //    chiffres via keychar (ex. certains HID configurés en mode virtual COM)
  //    sont correctement capturées même si le keycode physique ne matche pas.
  if (typeof rawKeychar === "number" && rawKeychar > 0) {
    const ch = String.fromCharCode(rawKeychar);
    if (/[A-Za-z0-9()]/.test(ch) || rawKeychar === 29) return ch;
  }
  return null;
}
// FIX: Tab retiré des terminateurs de scan.
// La quasi-totalité des douchettes HID envoient Enter (ou NumpadEnter) comme
// suffixe de fin de code-barres. Inclure Tab causait des faux positifs quand
// l'utilisateur naviguait dans un formulaire du LGO avec quelques touches en
// buffer (ex. saisie rapide dans Winpharma juste avant un scan).
function isEnterKey(keycode) {
  if (!UiohookKey) return false;
  return keycode === UiohookKey.Enter || keycode === UiohookKey.NumpadEnter;
}
function resetScanBuffer() {
  scanBuffer = "";
  if (scanResetTimer) {
    clearTimeout(scanResetTimer);
    scanResetTimer = null;
  }
}
/**
 * Robust barcode → CIP-13 extractor (mirrors src/lib/barcodeParser.ts).
 * Returns null when no usable code can be extracted.
 */
function parseBarcodeToCip(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[\x1d()]/g, "").trim();
  if (/^\d{13}$/.test(cleaned)) return cleaned;
  const gs1 = cleaned.match(/01(\d{14})/);
  if (gs1) {
    const gtin = gs1[1];
    // GTIN-14 pharmaceutique : l'indicateur de packaging est toujours 0 → slice(1)
    // FIX: log warning si on tombe sur le fallback slice(-13) pour faciliter le debug
    //      en cas de GTIN avec indicateur non-zéro (conditionnement multiple, etc.)
    let cip13;
    if (gtin.startsWith("0")) {
      cip13 = gtin.slice(1);
    } else {
      cip13 = gtin.slice(-13);
      console.warn(
        `[ASCLION-SCAN] parseBarcodeToCip: GTIN ne commence pas par 0 — raw="${raw}" gtin="${gtin}" fallback cip13="${cip13}". Vérifier le code-barres source.`,
      );
    }
    if (/^\d{13}$/.test(cip13)) return cip13;
  }
  if (/^\d{7}$/.test(cleaned)) return cleaned;
  if (/^\d{8,14}$/.test(cleaned)) return cleaned;
  return null;
}
function ensureWindowAlive() {
  // If the user closed the widget, re-create it so scans are not lost.
  if (!mainWindow || mainWindow.isDestroyed()) {
    try {
      createWindow();
    } catch (e) {
      console.error("[ASCLION-SCAN] could not recreate window:", e);
    }
  }
}
function emitGlobalScan(code) {
  const now = Date.now();
  if (scanLastEmitted.code === code && now - scanLastEmitted.at < SCAN_DEDUP_WINDOW_MS) {
    devLog(`[SCAN] dedup ean=${code} elapsedMs=${now - scanLastEmitted.at}`);
    return;
  }
  scanLastEmitted = { code, at: now };
  devLog(`[SCAN] ts=${new Date(now).toISOString()} ean=${code}`);
  ensureWindowAlive();
  if (!mainWindow) return;
  const send = () => {
    try {
      mainWindow.webContents.send("global-barcode", { ean: code, at: now });
    } catch (e) {
      devWarn("[SCAN] send failed:", e);
    }
  };
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", send);
  } else {
    send();
  }
  // Pop the window in front of LGO WITHOUT stealing focus.
  try {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.showInactive();
    mainWindow.moveTop();
    mainWindow.setAlwaysOnTop(true, "floating");
    mainWindow.flashFrame(true);
    setTimeout(() => {
      try {
        if (!mainWindow) return;
        mainWindow.flashFrame(false);
        mainWindow.setAlwaysOnTop(pipState.alwaysOnTop, "floating");
      } catch {
        /* noop */
      }
    }, 1500);
  } catch (e) {
    devWarn("[SCAN] pop-to-front failed:", e);
  }
}
function startGlobalBarcodeListener() {
  if (!uIOhook) {
    console.error("[SCAN] cannot start — uiohook-napi not loaded");
    return;
  }
  try {
    uIOhook.on("keydown", (event) => {
      const now = Date.now();
      const elapsed = now - scanLastKeyAt;
      scanLastKeyAt = now;
      if (scanResetTimer) {
        clearTimeout(scanResetTimer);
        scanResetTimer = null;
      }
      if (isEnterKey(event.keycode)) {
        const raw = scanBuffer;
        if (raw.length >= SCAN_MIN_LENGTH) {
          const parsed = parseBarcodeToCip(raw);
          if (parsed) {
            emitGlobalScan(parsed);
          } else {
            devLog(`[SCAN] rejected raw="${raw}" reason=cannot-parse`);
          }
        }
        resetScanBuffer();
        return;
      }
      const ch = charFromKeycode(event.keycode, event.keychar);
      if (ch !== null) {
        if (scanBuffer.length === 0 || elapsed < SCAN_MAX_KEY_INTERVAL_MS) {
          if (scanBuffer.length < SCAN_MAX_LENGTH) {
            scanBuffer += ch;
          }
        } else {
          scanBuffer = ch;
        }
        scanResetTimer = setTimeout(resetScanBuffer, SCAN_RESET_INACTIVITY_MS);
      } else if (scanBuffer.length > 0) {
        // Unknown key breaks the sequence (modifiers, arrows, function keys)
        // but only if not a simple modifier — avoid resetting on Shift/Ctrl/Alt
        const isModifier =
          event.keycode === UiohookKey.Shift ||
          event.keycode === UiohookKey.ShiftRight ||
          event.keycode === UiohookKey.Ctrl ||
          event.keycode === UiohookKey.CtrlRight ||
          event.keycode === UiohookKey.Alt ||
          event.keycode === UiohookKey.AltRight ||
          event.keycode === UiohookKey.Meta ||
          event.keycode === UiohookKey.MetaRight;
        if (!isModifier) {
          resetScanBuffer();
        }
      }
    });
    uIOhook.start();
    devLog("[SCAN] HID listener started.");
  } catch (e) {
    console.error("[ASCLION-SCAN] failed to start:", e);
  }
}
app.on("will-quit", () => {
  try {
    if (uIOhook) uIOhook.stop();
  } catch {
    /* noop */
  }
});
