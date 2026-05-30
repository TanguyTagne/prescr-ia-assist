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
  // NOTE: do NOT call setDriverType("hidraw") on Windows.
  // "hidraw" requires WinUSB/libusb; barcode scanners enumerated as HID keyboards
  // use the native kbdhid.sys driver which is NOT WinUSB-compatible.
  // The default Windows HID API ("winhid") opens keyboard-class HID devices
  // in shared mode and is the correct backend for barcode scanners.
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
const SCAN_MAX_KEY_INTERVAL_MS = 180; // was 80 — raised for slow 2D/DataMatrix scanners
const SCAN_MIN_LENGTH = 7;
const SCAN_MAX_LENGTH = 60; // GS1 DataMatrix payloads can be long
const SCAN_DEDUP_WINDOW_MS = 800;
const SCAN_RESET_INACTIVITY_MS = 800; // was 400 — more tolerant for Bluetooth scanners
let scanBuffer = "";
let scanLastKeyAt = 0;
let scanResetTimer = null;
let scanLastEmitted = { code: "", at: 0 };
// Diagnostic: expose last global key time, buffer length and last rejection reason
let scanLastGlobalKeyAt = 0;
let scanLastRejection = null; // { raw, reason, at }
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
function isEnterKey(keycode) {
  if (!UiohookKey) return false;
  return keycode === UiohookKey.Enter || keycode === UiohookKey.NumpadEnter;
}
// Tab accepted as terminator only when buffer already has ≥ SCAN_MIN_LENGTH chars.
// Avoids false-positives when the user navigates a LGO form with Tab.
function isTabKey(keycode) {
  if (!UiohookKey || UiohookKey.Tab === undefined) return false;
  return keycode === UiohookKey.Tab;
}
function resetScanBuffer(reason = null) {
  if (reason && scanBuffer.length >= SCAN_MIN_LENGTH) {
    scanLastRejection = { raw: scanBuffer.slice(0, 60), reason, at: Date.now() };
    devLog(`[SCAN] buffer reset reason=${reason} raw="${scanBuffer.slice(0, 30)}"`);
  }
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
      scanLastGlobalKeyAt = now; // always update — diagnostic
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
            scanLastRejection = { raw: raw.slice(0, 60), reason: "cannot_parse", at: now };
            devLog(`[SCAN] rejected raw="${raw}" reason=cannot-parse`);
          }
        } else if (raw.length > 0) {
          scanLastRejection = { raw: raw.slice(0, 60), reason: "too_short", at: now };
          devLog(`[SCAN] rejected raw="${raw}" reason=too-short len=${raw.length}`);
        }
        resetScanBuffer();
        return;
      }
      // Tab as terminator — only when a barcode sequence is already accumulating
      if (isTabKey(event.keycode)) {
        if (scanBuffer.length >= SCAN_MIN_LENGTH) {
          const raw = scanBuffer;
          const parsed = parseBarcodeToCip(raw);
          if (parsed) {
            emitGlobalScan(parsed);
          } else {
            scanLastRejection = { raw: raw.slice(0, 60), reason: "cannot_parse", at: now };
            devLog(`[SCAN] tab-terminated rejected raw="${raw}" reason=cannot-parse`);
          }
          resetScanBuffer();
        }
        // If buffer < SCAN_MIN_LENGTH, ignore Tab entirely (normal keyboard navigation)
        return;
      }
      const ch = charFromKeycode(event.keycode, event.keychar);
      if (ch !== null) {
        if (scanBuffer.length === 0 || elapsed < SCAN_MAX_KEY_INTERVAL_MS) {
          if (scanBuffer.length < SCAN_MAX_LENGTH) {
            scanBuffer += ch;
          }
        } else {
          // Gap between keys too large — abandon previous buffer
          if (scanBuffer.length >= SCAN_MIN_LENGTH) {
            scanLastRejection = { raw: scanBuffer.slice(0, 60), reason: "timeout", at: now };
          }
          scanBuffer = ch;
        }
        scanResetTimer = setTimeout(() => resetScanBuffer("timeout"), SCAN_RESET_INACTIVITY_MS);
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
          resetScanBuffer("key_break");
        }
      }
    });
    uIOhook.start();
    devLog("[SCAN] HID listener started.");
  } catch (e) {
    console.error("[ASCLION-SCAN] failed to start:", e);
  }
}

// ────────────────────────────────────────────────────────────
// HID-DIRECT scanner reader (node-hid)
//
// Reads raw HID Input Reports directly from the barcode scanner USB device.
// Uses HIDAPI (not a low-level keyboard hook) → NOT flagged as keylogger by
// antivirus, works regardless of focus, regardless of OS keyboard layout
// (no AZERTY/QWERTY corruption). Runs in parallel to the uiohook fallback;
// emitGlobalScan() dedups within SCAN_DEDUP_WINDOW_MS.
// ────────────────────────────────────────────────────────────
const SCANNER_VIDS = new Set([
  0x0c2e, // Honeywell / Metrologic / Intermec
  0x0536, // Hand Held Products (Honeywell)
  0x05e0, // Symbol Technologies / Zebra
  0x05f9, // Datalogic / PSC
  0x1eab, // Newland Auto-ID
  0x1a86, // QinHeng (OEM cheap scanners — very common)
  0x1ab1, // Inateck OEMs
  0x2dd6, // NetumScan
  0x2cd5, // Yanzeo
  0x2ab4, // Eyoyo
  0x26f1, // Generalplus
  0x0483, // STMicroelectronics (some 2D imagers)
  0x04b4, // Cypress (some scanner controllers)
  0x04f2, // Chicony (some imagers)
  0x065a, // Opticon (popular in European pharmacies)
  0x0699, // Denso Wave (QR / DataMatrix, Japan)
  0x04d9, // Holtek Semiconductor (very common on cheap OEM scanners)
  0x1504, // Bixolon
  0x2c32, // TERA scanners
  0x1d57, // Xenta/OEM (widely used IC in budget scanners)
  0x04b8, // Epson / POS scanners
  0x05f0, // Optec
  0x16d0, // MCS Electronics (some OEM readers)
  0x2c32, // TERA
  0x0425, // Motorola Solutions additional VID
]);
const SCANNER_PRODUCT_HINT = /scan|barcode|imager|reader|2d ?bar|hid ?pos|ean|qr|code/i;

function hex(n) {
  return (
    "0x" +
    Number(n || 0)
      .toString(16)
      .padStart(4, "0")
  );
}

function scannerPrefPath() {
  return path.join(app.getPath("userData"), "scanner.json");
}
function loadScannerPref() {
  try {
    return JSON.parse(fs.readFileSync(scannerPrefPath(), "utf-8"));
  } catch {
    return null;
  }
}
function applyScannerPref() {
  const pref = loadScannerPref();
  if (pref && typeof pref.allowGeneric === "boolean") {
    hidState.allowGeneric = pref.allowGeneric;
  }
}
function saveScannerPref(pref) {
  try {
    fs.writeFileSync(scannerPrefPath(), JSON.stringify(pref ?? {}));
  } catch (e) {
    devWarn("scanner pref save failed:", e);
  }
}

// HID Usage IDs → ASCII (page 0x07, "Keyboard/Keypad")
const HID_USAGE_TO_CHAR = {
  0x1e: "1",
  0x1f: "2",
  0x20: "3",
  0x21: "4",
  0x22: "5",
  0x23: "6",
  0x24: "7",
  0x25: "8",
  0x26: "9",
  0x27: "0",
  // Numpad
  0x59: "1",
  0x5a: "2",
  0x5b: "3",
  0x5c: "4",
  0x5d: "5",
  0x5e: "6",
  0x5f: "7",
  0x60: "8",
  0x61: "9",
  0x62: "0",
  // Letters — kept for GS1 DataMatrix alphanumeric payloads
  0x04: "a",
  0x05: "b",
  0x06: "c",
  0x07: "d",
  0x08: "e",
  0x09: "f",
  0x0a: "g",
  0x0b: "h",
  0x0c: "i",
  0x0d: "j",
  0x0e: "k",
  0x0f: "l",
  0x10: "m",
  0x11: "n",
  0x12: "o",
  0x13: "p",
  0x14: "q",
  0x15: "r",
  0x16: "s",
  0x17: "t",
  0x18: "u",
  0x19: "v",
  0x1a: "w",
  0x1b: "x",
  0x1c: "y",
  0x1d: "z",
  // Common punctuation found in GS1 payloads
  0x2d: "-",
  0x36: ",",
  0x37: ".",
};
const HID_USAGE_ENTER = 0x28;
const HID_USAGE_NUMPAD_ENTER = 0x58;
const HID_USAGE_TAB = 0x2b;

const hidState = {
  bound: null,
  device: null,
  buffer: "",
  lastReportAt: 0,
  lastEnterAt: 0,
  lastError: null,
  rebindTimer: null,
  pollTimer: null,
  rawTap: null, // { until, reports }
  // When true: auto-bind to any keyboard-class HID device when no scanner-labeled
  // device is detected. Requires explicit user activation from the admin panel.
  allowGeneric: false,
};
let uiohookStarted = false;

function isLikelyScanner(d) {
  if (!d) return false;
  if (SCANNER_VIDS.has(d.vendorId)) return true;
  // HID Point-of-Sale usage page (0x8C) is always a barcode scanner interface
  if (d.usagePage === 0x8c) return true;
  const p = (d.product || "") + " " + (d.manufacturer || "");
  return SCANNER_PRODUCT_HINT.test(p);
}

function listHidDevices() {
  if (!HID) return [];
  try {
    return (HID.devices() || []).map((d) => ({
      path: d.path,
      vendorId: d.vendorId,
      productId: d.productId,
      vendorIdHex: hex(d.vendorId),
      productIdHex: hex(d.productId),
      manufacturer: d.manufacturer || null,
      product: d.product || null,
      usagePage: d.usagePage,
      usage: d.usage,
      interface: d.interface,
      likelyScanner: isLikelyScanner(d),
      bound: !!(hidState.bound && hidState.bound.path === d.path),
    }));
  } catch (e) {
    hidState.lastError = "list: " + (e && e.message);
    return [];
  }
}

function closeHidDevice() {
  if (hidState.device) {
    try {
      hidState.device.removeAllListeners("data");
    } catch (_) {}
    try {
      hidState.device.close();
    } catch (_) {}
  }
  hidState.device = null;
  hidState.bound = null;
  hidState.buffer = "";
}

function decodeKeyboardReport(report) {
  // HID Boot Keyboard report = 8 bytes: [mods, reserved, k1..k6].
  // Some scanners send shorter/longer variants → scan bytes 1..end.
  const chars = [];
  let enter = false;
  let tab = false;
  const start = report.length >= 8 ? 2 : 1;
  for (let i = start; i < report.length; i++) {
    const u = report[i];
    if (!u) continue;
    if (u === HID_USAGE_ENTER || u === HID_USAGE_NUMPAD_ENTER) {
      enter = true;
      continue;
    }
    if (u === HID_USAGE_TAB) {
      tab = true;
      continue;
    }
    const c = HID_USAGE_TO_CHAR[u];
    if (c) chars.push(c);
  }
  return { chars, enter, tab };
}

function handleHidReport(report) {
  const now = Date.now();
  hidState.lastReportAt = now;
  if (hidState.rawTap && now < hidState.rawTap.until) {
    hidState.rawTap.reports.push({ at: now, bytes: Array.from(report) });
  }
  const { chars, enter, tab } = decodeKeyboardReport(report);
  if (chars.length) {
    for (const c of chars) {
      if (hidState.buffer.length < SCAN_MAX_LENGTH) hidState.buffer += c;
    }
  }
  // Tab terminates only when a barcode sequence is already long enough
  const isTerminator = enter || (tab && hidState.buffer.length >= SCAN_MIN_LENGTH);
  if (isTerminator) {
    const raw = hidState.buffer;
    hidState.buffer = "";
    hidState.lastEnterAt = now;
    if (raw.length >= SCAN_MIN_LENGTH) {
      const parsed = parseBarcodeToCip(raw);
      if (parsed) emitGlobalScan(parsed);
      else devLog(`[SCAN] HID-direct rejected raw="${raw}"`);
    }
  }
}

function openHidDevice(deviceInfo) {
  if (!HID) return { ok: false, error: hidLoadError || "node-hid not loaded" };
  if (!deviceInfo || !deviceInfo.path) return { ok: false, error: "device path missing" };
  closeHidDevice();
  try {
    const dev = new HID.HID(deviceInfo.path);
    dev.on("data", handleHidReport);
    dev.on("error", (err) => {
      hidState.lastError = "device: " + (err && err.message);
      devWarn("[SCAN] HID device error:", err);
      closeHidDevice();
      scheduleRebind();
    });
    hidState.device = dev;
    hidState.bound = {
      vendorId: deviceInfo.vendorId,
      productId: deviceInfo.productId,
      path: deviceInfo.path,
      product: deviceInfo.product || null,
      manufacturer: deviceInfo.manufacturer || null,
    };
    hidState.lastError = null;
    saveScannerPref({
      vendorId: deviceInfo.vendorId,
      productId: deviceInfo.productId,
      path: deviceInfo.path,
    });
    devLog(
      `[SCAN] HID-direct bound: "${deviceInfo.product || "?"}" ` +
        `VID=${hex(deviceInfo.vendorId)} PID=${hex(deviceInfo.productId)}`,
    );
    return { ok: true, bound: hidState.bound };
  } catch (e) {
    hidState.lastError = "open: " + (e && e.message);
    devWarn("[SCAN] HID open failed:", e);
    return { ok: false, error: hidState.lastError };
  }
}

function findBestScanner() {
  const all = listHidDevices();
  const pref = loadScannerPref();
  if (pref) {
    let m = all.find((d) => d.path === pref.path);
    if (m) return m;
    m = all.find((d) => d.vendorId === pref.vendorId && d.productId === pref.productId);
    if (m) return m;
  }

  // Priority 1: devices recognized as scanners (known VID, POS HID page, or name match)
  const candidates = all.filter((d) => d.likelyScanner);
  candidates.sort((a, b) => {
    // POS usage page (0x8C) first — not claimed by keyboard driver, always openable
    const aPOS = a.usagePage === 0x8c ? 0 : 1;
    const bPOS = b.usagePage === 0x8c ? 0 : 1;
    if (aPOS !== bPOS) return aPOS - bPOS;
    // Then keyboard interface (where scan data normally flows)
    const ka = a.usagePage === 1 && a.usage === 6 ? 0 : 1;
    const kb = b.usagePage === 1 && b.usage === 6 ? 0 : 1;
    return ka - kb;
  });
  if (candidates.length > 0) return candidates[0];

  // Priority 2 (opt-in): generic keyboard-class HID devices.
  // Many cheap/OEM scanners enumerate as plain "USB Keyboard" with no recognizable
  // VID or name. When allowGeneric is enabled by the pharmacist from the admin panel,
  // we try to bind the first keyboard-class HID device. The barcode buffer logic
  // (inter-key < 180 ms + 7+ chars + Enter) filters out normal keyboard typing.
  if (hidState.allowGeneric) {
    const keyboards = all.filter((d) => d.usagePage === 1 && d.usage === 6);
    if (keyboards.length > 0) {
      keyboards.sort((a, b) => (a.interface ?? 99) - (b.interface ?? 99));
      devLog("[SCAN] allowGeneric: trying generic keyboard HID", keyboards[0].product, hex(keyboards[0].vendorId));
      return keyboards[0];
    }
  }

  return null;
}

function scheduleRebind() {
  if (hidState.rebindTimer) return;
  hidState.rebindTimer = setTimeout(() => {
    hidState.rebindTimer = null;
    if (!hidState.device) {
      const best = findBestScanner();
      if (best) openHidDevice(best);
    }
  }, 5000);
}

function startHidPolling() {
  if (hidState.pollTimer) return;
  hidState.pollTimer = setInterval(() => {
    if (!hidState.device) {
      const best = findBestScanner();
      if (best) openHidDevice(best);
    }
  }, 5000);
}

function startUiohookFallback() {
  if (uiohookStarted || !uIOhook) return;
  uiohookStarted = true;
  startGlobalBarcodeListener();
}

function bootScannerStack() {
  // Load persisted preferences (allowGeneric, etc.) before scanning
  applyScannerPref();
  // 1) Direct HID read (works without focus, AV-friendly)
  if (HID) {
    const best = findBestScanner();
    if (best) openHidDevice(best);
    startHidPolling();
  }
  // 2) Always start uiohook in parallel as fallback. emitGlobalScan dedups.
  startUiohookFallback();
}

function getScannerStatus() {
  return {
    mode: hidState.device ? "hid-direct" : uiohookStarted ? "uiohook" : "none",
    hidLoaded: !!HID,
    hidLoadError,
    uiohookLoaded: !!uIOhook,
    uiohookLoadError,
    uiohookStarted,
    bound: hidState.bound,
    lastReportAt: hidState.lastReportAt || null,
    lastEnterAt: hidState.lastEnterAt || null,
    lastError: hidState.lastError,
    bufferLen: hidState.buffer.length,
    allowGeneric: hidState.allowGeneric,
    // Global keyboard diagnostic (uiohook path)
    lastGlobalKeyAt: scanLastGlobalKeyAt || null,
    globalBufferLen: scanBuffer.length,
    lastRejection: scanLastRejection,
  };
}

// IPC — exposed to renderer via preload `electronAPI.scanner`
ipcMain.handle("scanner:list", () => listHidDevices());
ipcMain.handle("scanner:status", () => getScannerStatus());
ipcMain.handle("scanner:bind", (_e, devicePath) => {
  const all = listHidDevices();
  const target = all.find((d) => d.path === devicePath);
  if (!target) return { ok: false, error: "device not found" };
  return openHidDevice(target);
});
ipcMain.handle("scanner:unbind", () => {
  closeHidDevice();
  saveScannerPref(null);
  return { ok: true };
});
ipcMain.handle("scanner:test-capture", async (_e, ms) => {
  const duration = Math.min(Math.max(Number(ms) || 5000, 500), 30000);
  hidState.rawTap = { until: Date.now() + duration, reports: [] };
  await new Promise((r) => setTimeout(r, duration));
  const reports = hidState.rawTap ? hidState.rawTap.reports : [];
  hidState.rawTap = null;
  return { reports, durationMs: duration, count: reports.length };
});
ipcMain.handle("scanner:reload", () => {
  closeHidDevice();
  bootScannerStack();
  return getScannerStatus();
});

// Test a SPECIFIC device path for N ms without binding it.
// Returns raw HID reports + decoded characters so the pharmacist can verify
// which device is their scanner before committing to a binding.
ipcMain.handle("scanner:test-device", async (_e, { devicePath, ms }) => {
  const duration = Math.min(Math.max(Number(ms) || 5000, 1000), 30000);
  if (!HID) return { ok: false, error: hidLoadError || "node-hid not loaded", reports: [], decoded: "" };
  let dev = null;
  const reports = [];
  let decodedBuffer = "";
  let barcodeDetected = null;
  const until = Date.now() + duration;
  try {
    dev = new HID.HID(devicePath);
    dev.on("data", (report) => {
      const now = Date.now();
      if (now >= until) return;
      reports.push({ at: now, bytes: Array.from(report) });
      const { chars, enter, tab } = decodeKeyboardReport(report);
      for (const c of chars) {
        if (decodedBuffer.length < SCAN_MAX_LENGTH) decodedBuffer += c;
      }
      if (enter || (tab && decodedBuffer.length >= SCAN_MIN_LENGTH)) {
        if (decodedBuffer.length >= SCAN_MIN_LENGTH) {
          const parsed = parseBarcodeToCip(decodedBuffer);
          if (parsed) barcodeDetected = parsed;
        }
        decodedBuffer = "";
      }
    });
    dev.on("error", () => {});
    await new Promise((r) => setTimeout(r, duration));
  } catch (e) {
    return { ok: false, error: e && e.message, reports: [], decoded: "" };
  } finally {
    try {
      if (dev) {
        dev.removeAllListeners();
        dev.close();
      }
    } catch (_) {}
  }
  return {
    ok: true,
    reports: reports.slice(-30),
    count: reports.length,
    decoded: decodedBuffer,
    barcodeDetected,
  };
});

// Enable / disable auto-binding to generic keyboard-class HID devices.
// Must be activated explicitly by the pharmacist from the admin panel.
ipcMain.handle("scanner:set-allow-generic", (_e, allow) => {
  hidState.allowGeneric = !!allow;
  // Persist in scanner pref
  try {
    const pref = loadScannerPref() || {};
    fs.writeFileSync(scannerPrefPath(), JSON.stringify({ ...pref, allowGeneric: hidState.allowGeneric }));
  } catch (e) {
    devWarn("allowGeneric pref save failed:", e);
  }
  // If enabling and no device bound yet, trigger a rebind scan
  if (hidState.allowGeneric && !hidState.device) {
    const best = findBestScanner();
    if (best) openHidDevice(best);
  }
  return getScannerStatus();
});

app.on("will-quit", () => {
  try {
    if (uIOhook && uiohookStarted) uIOhook.stop();
  } catch {
    /* noop */
  }
  try {
    closeHidDevice();
  } catch {
    /* noop */
  }
  if (hidState.pollTimer) {
    clearInterval(hidState.pollTimer);
    hidState.pollTimer = null;
  }
});
