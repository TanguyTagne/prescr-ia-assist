// build: electron v2026.06.09.1 — robot interception (sniffer + HTTP listener), settings refactor
const { app, BrowserWindow, shell, ipcMain, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const { exec, spawn } = require("child_process");

// Robot interception subsystem (lazy: failing to load any of these must NOT
// take down the rest of the app — pharmacies without a robot keep working).
let robotConfig = null;
let robotSniffer = null;
let robotListener = null;
let robotSubsystemError = null;
try {
  robotConfig = require("./robot/config");
  robotSniffer = require("./robot/sniffer");
  robotListener = require("./robot/listener");
} catch (e) {
  robotSubsystemError = e && e.message;
  console.error("[ROBOT] subsystem load failed:", robotSubsystemError);
}
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
// Load serialport lazily — reads barcode scanners configured in USB-CDC
// (Virtual COM Port) mode. 100% AV-safe (plain file I/O on COM port).
let SerialPortLib = null;
let serialLoadError = null;
try {
  SerialPortLib = require("serialport");
} catch (e) {
  serialLoadError = e && e.message;
  console.error("[ASCLION-SCAN] serialport unavailable:", serialLoadError);
}

// ────────────────────────────────────────────────────────────
// Native N-API Raw Input addon — preferred over the PowerShell subprocess
// (faster boot, no subprocess killable by GPO/EDR, inherits Electron
// signature). Windows-only; degrades gracefully on macOS/Linux to the
// existing PowerShell + uiohook + node-hid + WebHID + serialport fallbacks.
// ────────────────────────────────────────────────────────────
let nativeRawInput = null;
let nativeRawInputError = null;
try {
  nativeRawInput = require("./native/rawinput");
  if (!nativeRawInput.available) {
    nativeRawInputError = nativeRawInput.loadError || "not built for this platform";
    console.warn("[ASCLION-SCAN] native rawinput unavailable:", nativeRawInputError);
  }
} catch (e) {
  nativeRawInputError = e && e.message;
  console.error("[ASCLION-SCAN] native rawinput load failed:", nativeRawInputError);
}
// ────────────────────────────────────────────────────────────
// Picture-in-Picture state (always-on-top + compact mode)
//
// Position is intentionally NOT persisted: every launch puts the window in
// the top-right corner of the primary display so the pharmacist always
// finds it in the same place (just like a system tray popup). If they drag
// it elsewhere during the day, the next morning it's back top-right.
// ────────────────────────────────────────────────────────────
// Window size — reduced height (was 580) so the widget takes less vertical
// space next to the LGO. Width unchanged so the EAN + reco lines stay
// readable.
const SIZE_NORMAL = { width: 340, height: 420 };
const SIZE_COMPACT = { width: 300, height: 360 };
// Distance from the top + right edges of the primary display.
const TOP_RIGHT_MARGIN = 16;
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
// Compute the top-right anchor on the primary display, respecting the
// taskbar via workArea. Falls back to (0,0) if the screen module isn't
// ready (shouldn't happen — createWindow runs after app.whenReady).
function topRightPosition(windowWidth) {
  try {
    const { screen } = require("electron");
    // Prefer the display under the mouse cursor — on multi-monitor setups the
    // OS "primary" display isn't always where the pharmacist is working.
    // Falls back to the primary display if anything looks off.
    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point) || screen.getPrimaryDisplay();
    let wa = display.workArea;
    // Guard against bogus workArea values reported very early at boot
    // (Windows can briefly return 0x0 before all displays are enumerated).
    if (!wa || wa.width < 200 || wa.height < 200) {
      wa = screen.getPrimaryDisplay().workArea;
    }
    return {
      x: Math.max(0, wa.x + wa.width - windowWidth - TOP_RIGHT_MARGIN),
      y: wa.y + TOP_RIGHT_MARGIN,
    };
  } catch {
    return { x: 0, y: 0 };
  }
}
// Re-anchor the existing window to the top-right. Called on ready-to-show and
// shortly after, because on cold boot (auto-launch at Windows startup) the
// display module can momentarily report stale/incomplete workArea values,
// which would leave the window where Electron defaulted it (screen center).
function reanchorTopRight() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const [w] = mainWindow.getSize();
    const { x, y } = topRightPosition(w);
    mainWindow.setPosition(x, y, false);
  } catch (e) {
    devWarn("[WINDOW] reanchorTopRight failed:", e);
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
// Enable WebHID — removes Chromium's built-in HID blocklist so the renderer can
// open scanner devices (HID POS / usage page 0x8C) via navigator.hid without
// restriction. Must be set BEFORE the app is ready.
app.commandLine.appendSwitch("disable-hid-blocklist");

// Disable hardware acceleration for compatibility
app.disableHardwareAcceleration();

// Dev-only logger — avoids leaking internal state in production builds
const isDev = process.env.NODE_ENV !== "production";
const devLog = (...args) => isDev && console.log(...args);
const devWarn = (...args) => isDev && console.warn(...args);
let mainWindow;
// Set to true by ensureWindowAlive() when the window is being recreated as a
// side-effect of an incoming scan. createWindow's ready-to-show handler reads
// this flag to decide whether to .show() the freshly-built window. The flag is
// cleared by attention:bring-to-front, which the renderer invokes ONLY when a
// scan yielded curated PCs — so a closed window stays hidden for scans that
// don't deserve the pharmacist's attention.
let suppressShowOnReady = false;
const APP_URL = "https://prescr-ia-assist.lovable.app";
const LOCAL_PATH = path.join(__dirname, "web", "index.html");
function createWindow() {
  loadPipState();
  const initSize = pipState.compact ? SIZE_COMPACT : SIZE_NORMAL;
  // Always anchor the window in the top-right corner of the primary display.
  // No persistence — the pharmacist always knows where to look for it, even
  // if they moved it around the day before.
  const anchor = topRightPosition(initSize.width);
  mainWindow = new BrowserWindow({
    x: anchor.x,
    y: anchor.y,
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
  // Handle HTTP 5xx / 4xx returned by the edge (Cloudflare/Lovable hiccup).
  // `did-fail-load` does NOT fire for HTTP error status codes — the request
  // technically succeeded — so the window would otherwise stay stuck on the
  // raw "Internal Server Error" page. Retry up to 3 times with backoff, then
  // render a branded offline fallback instead of the default Chromium page.
  let httpRetryCount = 0;
  const MAX_HTTP_RETRIES = 3;
  mainWindow.webContents.on(
    "did-navigate",
    (_event, _url, httpResponseCode /*, httpStatusText */) => {
      if (httpResponseCode && httpResponseCode >= 400) {
        devWarn(`HTTP ${httpResponseCode} received — retry ${httpRetryCount + 1}/${MAX_HTTP_RETRIES}`);
        if (httpRetryCount < MAX_HTTP_RETRIES) {
          httpRetryCount++;
          setTimeout(() => mainWindow?.loadURL(getDesktopUrl()), 1500 * httpRetryCount);
        } else {
          httpRetryCount = 0;
          mainWindow?.loadURL(
            "data:text/html;charset=utf-8," +
              encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><title>Asclion</title>
<style>html,body{margin:0;height:100%;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fafafa;color:#111;display:flex;align-items:center;justify-content:center;text-align:center}
.box{max-width:320px;padding:32px}h1{font-size:18px;font-weight:600;margin:0 0 8px}p{font-size:13px;color:#555;margin:0 0 20px;line-height:1.5}
button{background:#111;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-size:13px;cursor:pointer}button:hover{background:#000}</style></head>
<body><div class="box"><h1>Asclion indisponible</h1><p>Le service est temporairement injoignable. Vérifie ta connexion ou réessaie dans un instant.</p>
<button onclick="location.href='${getDesktopUrl()}'">Réessayer</button></div></body></html>`)
          );
        }
      } else if (httpResponseCode && httpResponseCode < 400) {
        httpRetryCount = 0;
      }
    }
  );
  // Show window when ready to avoid white flash — unless the window was
  // recreated to silently process a scan (see suppressShowOnReady).
  mainWindow.once("ready-to-show", () => {
    // Re-anchor in case the display layout settled after the BrowserWindow
    // constructor ran (typical on cold boot via auto-launch).
    reanchorTopRight();
    setTimeout(reanchorTopRight, 600);
    if (suppressShowOnReady) {
      devLog("[WINDOW] ready-to-show suppressed — waiting for renderer to confirm PCs before surfacing");
      return;
    }
    mainWindow.show();
  });
  // Open external links in the default browser — but only http/https/mailto.
  // Without a scheme whitelist, a compromised origin could call window.open
  // with "javascript:", "file://", "ms-msdt:" or custom protocol handlers
  // and pivot to RCE via shell.openExternal. Hard-deny everything else.
  const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: "allow" };
    let scheme = "";
    try { scheme = new URL(url).protocol; } catch { /* malformed URL */ }
    if (!SAFE_SCHEMES.has(scheme)) {
      devWarn(`[OPEN-EXTERNAL] blocked unsafe scheme: ${scheme || "(unknown)"} url=${url.slice(0, 120)}`);
      return { action: "deny" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Inject WebHID init script after every page load.
  // executeJavaScript with userGesture:true bypasses the user-activation
  // requirement for navigator.hid.requestDevice() — Electron-specific.
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents
      .executeJavaScript(WEBHID_INIT_SCRIPT, /* userGesture */ true)
      .catch((e) => devWarn("[WEBHID] init script failed:", e));
  });
}
const REPAIR_AUTOLAUNCH_ARG = "--asclion-repair-autolaunch";
const isAutolaunchRepairMode = process.argv.includes(REPAIR_AUTOLAUNCH_ARG);
const noRestartAfterRepair = process.argv.includes("--no-restart-after-repair");
const repairTargetSidArg = process.argv.find((arg) => arg.startsWith("--target-user-sid="));
const REPAIR_TARGET_USER_SID = repairTargetSidArg ? repairTargetSidArg.split("=").slice(1).join("=").trim() : null;
const repairReplacePidArg = process.argv.find((arg) => arg.startsWith("--replace-pid="));
const REPAIR_REPLACE_PID = repairReplacePidArg ? Number(repairReplacePidArg.split("=").slice(1).join("=")) : 0;

// ── Flag --from-elevation : la nouvelle instance vient d'être lancée en admin
// via UAC depuis un ancien process Asclion en mode user. Elle doit FORCER le
// kill de l'ancienne instance (qui détient encore le single-instance lock) AVANT
// de tenter de prendre le lock elle-même, sinon elle se suicide immédiatement
// via `else if (!gotTheLock) app.quit()` et l'utilisateur se retrouve sans app.
const FROM_ELEVATION_ARG = "--from-elevation";
const isFromElevation = process.argv.includes(FROM_ELEVATION_ARG);
const elevationKillPidArg = process.argv.find((arg) => arg.startsWith("--kill-pid="));
const ELEVATION_KILL_PID = elevationKillPidArg ? Number(elevationKillPidArg.split("=").slice(1).join("=")) : 0;

if (isFromElevation && ELEVATION_KILL_PID > 0 && process.platform === "win32") {
  // Synchrone : on tue l'ancien PID, on attend qu'il libère le lock, puis on continue.
  // execSync est ici acceptable car on est avant app.whenReady() — l'event loop
  // n'a aucun travail à faire de toute façon.
  const { execSync } = require("child_process");
  try {
    execSync(`taskkill /PID ${ELEVATION_KILL_PID} /F /T`, { windowsHide: true, stdio: "ignore" });
  } catch { /* le process est peut-être déjà mort, ignore */ }
  // Petit délai pour que Windows libère vraiment le mutex single-instance.
  // 500ms est largement suffisant — Windows libère typiquement en <50ms.
  try { execSync("powershell.exe -NoProfile -Command \"Start-Sleep -Milliseconds 500\"", { windowsHide: true, stdio: "ignore" }); } catch { /* ignore */ }
}

// Single instance lock — prevent multiple windows, except the short-lived
// elevated repair helper launched via UAC for legacy per-user installs.
const gotTheLock = app.requestSingleInstanceLock();
if (isAutolaunchRepairMode) {
  app.whenReady().then(async () => {
    await registerAutoLaunch();
    if (!noRestartAfterRepair && process.platform === "win32") {
      const replace = Number.isFinite(REPAIR_REPLACE_PID) && REPAIR_REPLACE_PID > 0
        ? `taskkill /PID ${REPAIR_REPLACE_PID} /F >nul 2>nul & timeout /t 1 /nobreak >nul & `
        : "";
      spawn("cmd.exe", ["/d", "/s", "/c", `timeout /t 2 /nobreak >nul & ${replace}schtasks /Run /TN "AsclionAtLogon"`], {
        windowsHide: true,
        detached: true,
        stdio: "ignore",
      }).unref();
    }
    app.quit();
  });
} else if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // Si la fenêtre existe encore (juste minimized/cachée) → la ramener au premier plan.
    // Si elle a été détruite par un clic sur X → la recréer pour que le pharmacien
    // voie l'app revenir (sans avoir à passer par UAC, le process actuel garde son
    // niveau d'intégrité). C'est ce qui permet "ferme + ré-ouvre = pas d'UAC".
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      // User explicitly re-launched the app — clear any scan-driven show-gate
      // so the freshly-built window actually appears.
      suppressShowOnReady = false;
      createWindow();
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

    // ── WebHID auto-permission ─────────────────────────────────────────────
    // Grant permission for HID devices silently when the renderer calls
    // navigator.hid.requestDevice().  Only grant known scanner types so we
    // don't accidentally expose keyboards or mice.
    session.defaultSession.setDevicePermissionHandler((details) => {
      if (details.deviceType !== "hid") return false;
      const d = details.device || {};
      // HID POS (Point-of-Sale) usage page — always a scanner interface
      if (d.usagePage === 0x8C) return true;
      // Known scanner vendor IDs
      if (SCANNER_VIDS.has(d.vendorId)) return true;
      // Name-based hint
      const name = ((d.product || "") + " " + (d.manufacturer || ""));
      if (SCANNER_PRODUCT_HINT.test(name)) return true;
      return false;
    });

    // Auto-select the best scanner when the renderer enumerates HID devices.
    // This fires when navigator.hid.requestDevice() is called from the renderer.
    session.defaultSession.on("select-hid-device", (event, details, callback) => {
      event.preventDefault();
      const list = details.deviceList || [];
      // Prefer HID POS (usage page 0x8C), then known VIDs
      const pos = list.find((d) => d.usagePage === 0x8C);
      if (pos) { callback(pos.deviceId); return; }
      const known = list.find((d) => SCANNER_VIDS.has(d.vendorId));
      if (known) { callback(known.deviceId); return; }
      callback(""); // decline
    });

    // Re-open WebHID device when it reconnects (e.g. after USB replug)
    session.defaultSession.on("hid-device-added", (_e, _details) => {
      // Preload's navigator.hid 'connect' listener handles reopening
    });
    // ──────────────────────────────────────────────────────────────────────

    createWindow();
    // Warm up elevation detection so the FIRST heartbeat already carries the
    // privilege flag. La tâche planifiée AsclionAtLogon (HighestAvailable) fait
    // le job d'élévation automatique au logon Windows — pas besoin d'UAC à chaque
    // lancement. Le bouton AdminModeButton dans le header sert de fallback
    // manuel si la tâche n'a pas pu être créée ou ne fire pas.
    const elevated = await detectElevation();
    const autolaunchState = await registerAutoLaunch();
    void maybePromptElevatedAutolaunchRepair({ elevated, autolaunchState, reason: "startup" });
    // Detect installed LGO (Windows only) and forward to renderer when ready
    detectLgoAndNotify();
    // Boot scanner stack: direct HID read (preferred, AV-friendly) + uiohook fallback
    bootScannerStack();
    // Boot robot interception (HTTP listener + sniffer). Safe to call even when
    // the robot subsystem failed to load — bootRobotSubsystem() bails silently.
    bootRobotSubsystem();
    // Check for updates silently — el-updater downloads in background, swaps
    // the binary on quit, so the pharmacy gets the new version at next launch
    // (typically the next morning) without any manual download.
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
    // User clicked the dock icon — make sure the window actually shows.
    suppressShowOnReady = false;
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
    // Renderer confirmed the scan deserves attention — clear the show-gate
    // (set by ensureWindowAlive when the window was recreated mid-scan).
    suppressShowOnReady = false;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    // Force-foreground hack: temporarily pin always-on-top, then restore PiP state
    const wasOnTop = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(true, "floating");
    mainWindow.moveTop();
    mainWindow.focus();
    // Hold the foreground pin for 3 seconds, then release so that clicking
    // another window (e.g. the LGO) sends Asclion back to the background.
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
    }, 3000);
  } catch (e) {
    devWarn("bring-to-front failed:", e);
  }
  return true;
});
ipcMain.handle("attention:is-focused", () => {
  return !!(mainWindow && mainWindow.isFocused());
});
// ────────────────────────────────────────────────────────────
// Robust auto-launch (3 mechanisms, defence-in-depth)
//
// CRITICAL BUG FIX (was the cause of "ghost session" issue where
// some pharmacy PCs showed "hors ligne" despite being powered on):
//
//   The previous version used <BootTrigger> + UserId=S-1-5-18 (SYSTEM),
//   which made Asclion launch in Windows session 0 (services session).
//   Session 0 is isolated from the interactive user session since Vista
//   for security reasons → the Asclion window existed on a desktop NO
//   human ever sees, so the pharmacist could never log in, so no
//   session was ever registered in the backend.
//
// NEW STRATEGY (all 3 layered, run as the INTERACTIVE user):
//
//   1. HKCU\Software\Microsoft\Windows\CurrentVersion\Run
//      → primary mechanism, standard Windows GUI auto-launch.
//      Fires on user logon, runs in user session (visible).
//   2. Scheduled task with <LogonTrigger>
//      → backup if Run key is wiped by group policy or by user.
//      Fires 15 s after logon, principal = Users group.
//   3. Scheduled tasks at 08:30 and 09:00 daily
//      → catch-up if Asclion crashed during the day.
// ────────────────────────────────────────────────────────────
const AUTOLAUNCH_TASKS = [
  { name: "AsclionAtLogon", kind: "logon" },
  { name: "AsclionDaily0830", kind: "daily", time: "08:30:00" },
  { name: "AsclionDaily0900", kind: "daily", time: "09:00:00" },
];
// Old task names from pre-fix versions (registered as SYSTEM, broken).
// Deleted on every registerAutoLaunch() call so existing installs heal.
const OLD_TASK_NAMES = ["AsclionAtBoot"];

function buildTaskXml({ kind, time, exePath, userSid, runLevel = "HighestAvailable" }) {
  const exeEscaped = exePath.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sidEscaped = String(userSid || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Pas de délai sur le LogonTrigger : on veut que la tâche (qui démarre
  // Asclion en mode HighestAvailable) gagne la course contre la HKCU Run key
  // (qui démarrerait en mode user normal et bloquerait via single-instance-lock).
  const trigger =
    kind === "logon"
      ? `<LogonTrigger><Enabled>true</Enabled></LogonTrigger>`
      : `<CalendarTrigger>
           <StartBoundary>2026-01-01T${time}</StartBoundary>
           <Enabled>true</Enabled>
           <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
         </CalendarTrigger>`;
  // WakeToRun only meaningful for calendar triggers (logon = user already woke up).
  const wakeToRun = kind === "daily" ? "<WakeToRun>true</WakeToRun>" : "";
  // IMPORTANT: on cible le SID de L'UTILISATEUR CONNECTÉ, pas le groupe
  // BUILTIN\Users. Avec GroupId=Users, Windows lance la tâche en niveau
  // medium même si l'utilisateur est admin local → c'était la cause du
  // diagnostic distant bloqué sur "user" après redémarrage.
  //
  // UserId + InteractiveToken + RunLevel HighestAvailable → l'app tourne avec
  // le niveau d'intégrité maximal disponible pour ce compte Windows :
  //   • Si l'user est admin local (cas fréquent en officine) → High IL
  //     → bypass UIPI, capture scan en background, SetForegroundWindow OK
  //   • Si l'user est standard → Medium IL (comportement par défaut, OK)
  //
  // L'UAC n'est demandé QU'UNE FOIS à l'installation (installer NSIS élevé)
  // lors de la création de la tâche. Les démarrages suivants sont silencieux.
  // C'est le pattern utilisé par Steam, Discord, OBS, etc.
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>Asclion</Author>
    <Description>Lancement automatique d'Asclion (session interactive, niveau d'intégrité maximal disponible pour capture scan globale)</Description>
  </RegistrationInfo>
  <Triggers>${trigger}</Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${sidEscaped}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>${runLevel}</RunLevel>
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
    ${wakeToRun}
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

// HKCU Run key — most reliable Windows auto-launch mechanism.
// No admin required, no UAC prompt, runs in user session, visible.
async function setRunRegistryKey(enable) {
  if (process.platform !== "win32") return { ok: false, error: "not Windows" };
  const KEY = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`;
  if (enable) {
    const exePath = process.execPath;
    // Wrap value in literal quotes to handle spaces in path.
    // reg.exe needs each inner quote escaped as \"
    const r = await execAsync(`reg add "${KEY}" /v "Asclion" /t REG_SZ /d "\\"${exePath}\\"" /f`);
    return { ok: r.code === 0, output: (r.stdout || r.stderr).trim() };
  } else {
    const r = await execAsync(`reg delete "${KEY}" /v "Asclion" /f`);
    return { ok: r.code === 0, output: (r.stdout || r.stderr).trim() };
  }
}

async function queryRunRegistryKey() {
  if (process.platform !== "win32") return { exists: false, value: null };
  const KEY = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`;
  const r = await execAsync(`reg query "${KEY}" /v "Asclion"`);
  if (r.code !== 0) return { exists: false, value: null };
  // Output line looks like: "    Asclion    REG_SZ    \"C:\\path\\Asclion.exe\""
  const match = r.stdout.match(/Asclion\s+REG_SZ\s+(.+)/);
  const value = match ? match[1].trim().replace(/^"|"$/g, "") : null;
  return { exists: true, value };
}

async function cleanupOldTasks() {
  if (process.platform !== "win32") return;
  // Silently delete pre-v1.2 task names (broken because registered as SYSTEM
  // → ran in session 0, invisible). Existing installs heal on next launch.
  for (const name of OLD_TASK_NAMES) {
    const r = await execAsync(`schtasks /Delete /TN "${name}" /F`);
    if (r.code === 0) devLog(`[AUTOLAUNCH] cleaned up old task: ${name}`);
  }
}
function execAsync(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true, timeout: 10000 }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code || 1 : 0, stdout: stdout || "", stderr: stderr || "" });
    });
  });
}
async function getCurrentUserSid() {
  if (process.platform !== "win32") return null;
  const r = await execAsync("whoami /user /fo csv /nh");
  if (r.code !== 0) return null;
  const match = r.stdout.match(/"([^"]+)"\s*,\s*"([^"]+)"/);
  if (match?.[2]) return match[2].trim();
  const parts = r.stdout.trim().split(",");
  return parts.length > 1 ? parts[parts.length - 1].replace(/"/g, "").trim() : null;
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
function readAutolaunchState() {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "autolaunch-state.json"), "utf-8"));
  } catch {
    return null;
  }
}
async function registerAutoLaunch() {
  if (process.platform !== "win32") return { runKey: null, tasks: [] };
  const exePath = process.execPath;
  const tmpDir = app.getPath("temp");
  const userSid = REPAIR_TARGET_USER_SID || await getCurrentUserSid();

  // 0) Heal old broken installs: remove pre-fix SYSTEM tasks (session 0 ghosts)
  await cleanupOldTasks();

  // 1) Scheduled tasks d'abord — c'est la voie de démarrage privilégiée car
  //    elle utilise RunLevel=HighestAvailable (admin si possible → bypass
  //    UIPI Windows pour la capture scan en background sans focus).
  //    La HKCU Run key est créée APRÈS, uniquement comme fallback si les
  //    tâches échouent.
  const results = [];
  // Detect elevation once: if we're not admin, skip the HighestAvailable
  // attempt entirely (it will fail with "Accès refusé" on every EDR-locked
  // pharmacy) and create the task with LeastPrivilege so it at least exists
  // and auto-fires at logon — the UAC repair prompt will re-create it with
  // HighestAvailable once the user accepts.
  const isElevated = await detectElevation();
  for (const task of AUTOLAUNCH_TASKS) {
    const xmlPath = path.join(tmpDir, `${task.name}.xml`);
    let registered = false;
    let mode = "user";
    let lastError = "";
    const attempts = isElevated
      ? [{ runLevel: "HighestAvailable", mode: "admin" }]
      : [
          { runLevel: "HighestAvailable", mode: "admin" },
          { runLevel: "LeastPrivilege",   mode: "user-fallback" },
        ];
    try {
      if (!userSid) throw new Error("Windows user SID unavailable");
      for (const attempt of attempts) {
        const xml = buildTaskXml({ kind: task.kind, time: task.time, exePath, userSid, runLevel: attempt.runLevel });
        fs.writeFileSync(xmlPath, "\uFEFF" + xml, { encoding: "utf16le" });
        const r = await execAsync(`schtasks /Create /TN "${task.name}" /XML "${xmlPath}" /F`);
        if (r.code === 0) {
          registered = true;
          mode = attempt.mode;
          lastError = "";
          break;
        }
        lastError = (r.stderr || r.stdout).trim();
        // Only retry with LeastPrivilege on access-denied errors
        if (!/refus|denied|access/i.test(lastError)) break;
      }
    } catch (e) {
      lastError = String(e && e.message ? e.message : e);
    } finally {
      try { fs.unlinkSync(xmlPath); } catch { /* ignore */ }
    }
    results.push({
      name: task.name,
      kind: task.kind,
      time: task.time || null,
      registered,
      mode,
      error: registered ? null : lastError.slice(0, 500),
    });
    if (registered) {
      devLog(`[AUTOLAUNCH] task "${task.name}" registered (${mode}).`);
    } else {
      console.error(`[AUTOLAUNCH] task "${task.name}" failed:`, lastError);
    }
  }

  // 2) HKCU Run key — fallback uniquement si AUCUNE tâche planifiée n'est en place
  // (la tâche démarre en HighestAvailable, la Run key en user seulement →
  //  on évite que la Run key gagne la course et bloque l'app en mode user).
  const anyTaskRegistered = results.some(r => r.registered);
  let runKeyResult;
  if (anyTaskRegistered) {
    // Tâche OK → on supprime la Run key si elle existe (héritage anciens installs)
    await setRunRegistryKey(false);
    runKeyResult = { ok: false, output: "skipped (scheduled task active)" };
    devLog("[AUTOLAUNCH] HKCU Run key removed — scheduled task takes over.");
  } else {
    // Aucune tâche → fallback Run key (mais Asclion sera en user seulement)
    runKeyResult = await setRunRegistryKey(true);
    if (runKeyResult.ok) {
      devLog("[AUTOLAUNCH] HKCU Run key set (fallback user-mode):", exePath);
    } else {
      devWarn("[AUTOLAUNCH] HKCU Run key failed:", runKeyResult.output);
    }
  }

  const state = {
    userSid,
    runKey: { enabled: runKeyResult.ok, value: exePath, error: runKeyResult.ok ? null : runKeyResult.output },
    tasks: results,
  };
  writeAutolaunchState(state);
  return state;
}

async function queryAutoLaunchStatus() {
  if (process.platform !== "win32") return { platform: process.platform, tasks: [], runKey: null };
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
  const runKey = await queryRunRegistryKey();
  return { platform: "win32", tasks, runKey };
}

let autolaunchRepairPromptedThisRun = false;
function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}
function launchElevatedAutolaunchRepair(reason, targetUserSid) {
  if (process.platform !== "win32") return { ok: false, error: "not Windows" };
  // VBS + Shell.Application "runas" — same approach as spawnVbsRelaunchAsAdmin.
  // PowerShell `Start-Process -Verb RunAs` is routinely blocked by the EDRs
  // installed on French pharmacy PCs (SentinelOne, Sophos, CrowdStrike) as
  // a known LOLBin abuse pattern → UAC dialog never appears, the repair
  // silently fails, and the user sees "tâches non créées · Accès refusé".
  const vbsPath = path.join(app.getPath("temp"), `asclion-autolaunch-repair-${process.pid}-${Date.now()}.vbs`);
  try {
    const exePath = process.execPath;
    const exeEscaped = exePath.replace(/"/g, '""');
    const targetArg = targetUserSid ? ` --target-user-sid=${targetUserSid}` : "";
    const restartArg = reason === "startup" || reason === "manual" ? ` --replace-pid=${process.pid}` : "";
    const args = `${REPAIR_AUTOLAUNCH_ARG} --reason=${reason || "startup"}${targetArg}${restartArg}`;
    const argsEscaped = args.replace(/"/g, '""');

    const vbsContent = [
      `Option Explicit`,
      `Dim objShell`,
      `On Error Resume Next`,
      `Set objShell = CreateObject("Shell.Application")`,
      `objShell.ShellExecute "${exeEscaped}", "${argsEscaped}", "", "runas", 0`,
      `WScript.Quit 0`,
    ].join("\r\n");

    fs.writeFileSync(vbsPath, vbsContent, { encoding: "utf8" });
    devLog("[AUTOLAUNCH] launching elevated helper via VBS:", vbsPath);

    const child = spawn(
      "wscript.exe",
      [vbsPath],
      { windowsHide: false, detached: true, stdio: "ignore" },
    );
    child.unref();

    setTimeout(() => { try { fs.unlinkSync(vbsPath); } catch { /* ignore */ } }, 30_000);
    return { ok: true, error: null, method: "vbs" };
  } catch (e) {
    try { fs.unlinkSync(vbsPath); } catch { /* ignore */ }
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}
async function maybePromptElevatedAutolaunchRepair({ elevated, autolaunchState, reason }) {
  if (process.platform !== "win32") {
    return { prompted: false, skipped: true, skipReason: "not-windows" };
  }
  // Si déjà admin → pas besoin de prompt UAC, on a juste à réenregistrer la tâche.
  // registerAutoLaunch() a déjà tourné côté caller, donc on signale juste "ok".
  if (elevated) {
    return { prompted: false, skipped: true, skipReason: "already-elevated", alreadyElevated: true };
  }
  // Le clic manuel re-déclenche TOUJOURS UAC (sinon l'utilisateur ne peut pas
  // réessayer après avoir annulé/loupé la 1re fenêtre). Seul le auto-prompt
  // au démarrage est limité à 1× par run.
  if (reason !== "manual" && autolaunchRepairPromptedThisRun) {
    return { prompted: false, skipped: true, skipReason: "already-prompted-this-run" };
  }
  autolaunchRepairPromptedThisRun = true;
  const targetUserSid = await getCurrentUserSid();
  const repair = launchElevatedAutolaunchRepair(reason, targetUserSid);
  writeAutolaunchState({
    ...(autolaunchState || {}),
    elevatedNow: false,
    repairPrompt: {
      attempted: repair.ok,
      reason: reason || "startup",
      method: repair.method || "vbs",
      error: repair.error || null,
      at: new Date().toISOString(),
    },
  });
  if (repair.ok && Notification.isSupported()) {
    try {
      new Notification({
        title: "Asclion",
        body: "Autorisez la fenêtre Windows pour activer le démarrage admin. Le statut passera en admin au prochain redémarrage Windows.",
        icon: path.join(__dirname, "assets", "icon.ico"),
        silent: true,
      }).show();
    } catch {
      /* ignore */
    }
  }
  return { prompted: repair.ok, error: repair.error };
}

ipcMain.handle("autolaunch:status", async () => queryAutoLaunchStatus());
ipcMain.handle("autolaunch:reinstall", async () => {
  const elevated = await detectElevation();
  const state = await registerAutoLaunch();
  const repair = await maybePromptElevatedAutolaunchRepair({ elevated, autolaunchState: state, reason: "manual" });
  return { state, repair, status: await queryAutoLaunchStatus() };
});

// ────────────────────────────────────────────────────────────
// Relance Asclion en admin via VBScript natif.
//
// Pourquoi VBScript et pas PowerShell directement ?
//   • PowerShell `Start-Process -Verb RunAs` est souvent bloqué par les
//     EDR/antivirus en officine (SentinelOne, Sophos, CrowdStrike)
//     car c'est un pattern d'attaque connu (LOLBin abuse).
//   • Avec `detached:true + stdio:ignore` PowerShell perd l'association
//     parent-window → certaines configs UAC refusent d'afficher le dialogue.
//   • VBScript appelle directement Shell.Application.ShellExecute avec
//     verbe "runas" → API Windows native via shell32.dll, presque aucun
//     EDR ne la filtre, et UAC s'affiche systématiquement.
//
// Si l'utilisateur accepte → la nouvelle instance démarre en admin et
// l'ancienne se quitte. S'il refuse → rien ne se passe, l'app reste en mode user.
// ────────────────────────────────────────────────────────────
function spawnVbsRelaunchAsAdmin() {
  if (process.platform !== "win32") return { ok: false, error: "not Windows" };

  const vbsPath = path.join(app.getPath("temp"), `asclion-elevate-${process.pid}-${Date.now()}.vbs`);
  try {
    const exePath = process.execPath;
    const exeEscaped = exePath.replace(/"/g, '""');
    const replacePid = process.pid;
    const elevationArgs = `${FROM_ELEVATION_ARG} --kill-pid=${replacePid}`;

    const vbsContent = [
      `Option Explicit`,
      `Dim objShell`,
      `On Error Resume Next`,
      `Set objShell = CreateObject("Shell.Application")`,
      `objShell.ShellExecute "${exeEscaped}", "${elevationArgs}", "", "runas", 1`,
      `WScript.Quit 0`,
    ].join("\r\n");

    fs.writeFileSync(vbsPath, vbsContent, { encoding: "utf8" });
    devLog("[RELAUNCH-ADMIN] VBS helper written:", vbsPath);

    const child = spawn(
      "wscript.exe",
      [vbsPath],
      { windowsHide: false, detached: true, stdio: "ignore" },
    );
    child.unref();

    // Cleanup différé du .vbs
    setTimeout(() => {
      try { fs.unlinkSync(vbsPath); } catch { /* ignore */ }
    }, 30_000);

    return { ok: true, prompted: true, method: "vbs" };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    devWarn("[RELAUNCH-ADMIN] failed:", msg);
    try { fs.unlinkSync(vbsPath); } catch { /* ignore */ }
    return { ok: false, error: msg };
  }
}

ipcMain.handle("system:relaunch-as-admin", async () => {
  if (process.platform !== "win32") return { ok: false, error: "not Windows" };
  const elevated = await detectElevation();
  if (elevated) return { ok: true, alreadyElevated: true };
  return spawnVbsRelaunchAsAdmin();
});

// ────────────────────────────────────────────────────────────
// Elevation detection — UNIQUE source de vérité pour savoir si
// le process Asclion tourne en High Integrity Level (admin).
//
// Indispensable côté admin diag pour identifier les pharmacies
// où la capture scan en background échoue : sans High IL, Windows
// UIPI bloque les input venant de processus elevés (le LGO tourne
// souvent en admin sur les postes officine → SetForegroundWindow KO,
// uiohook attrape rien quand le LGO a le focus).
//
// Mécanique : `net session` exige des privilèges admin →
// exit code 0 = admin, ≠ 0 = user normal.  Caché 60 s pour
// éviter de spawn un cmd à chaque heartbeat.
// ────────────────────────────────────────────────────────────
let elevationCache = { value: null, at: 0 };
const ELEVATION_TTL_MS = 60_000;

async function detectElevation() {
  if (process.platform !== "win32") return false;
  const now = Date.now();
  if (elevationCache.value !== null && now - elevationCache.at < ELEVATION_TTL_MS) {
    return elevationCache.value;
  }
  const r = await execAsync("net session >nul 2>&1");
  const elevated = r.code === 0;
  elevationCache = { value: elevated, at: now };
  return elevated;
}

ipcMain.handle("system:is-elevated", async () => {
  return { elevated: await detectElevation(), platform: process.platform };
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
// Timestamp of the last successfully emitted barcode (any path: N-API, PS, uiohook, HID, serial…)
let lastGlobalScanAt = 0;
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
  // Strip ISO/IEC 15424 symbology identifier (]d2 / ]C1 / ]e0 …), FNC1 (\x1d), parens
  const cleaned = raw
    .replace(/^\](?:d[12]|C1|e[01]|Q[13])/i, "")
    .replace(/[\x1d()]/g, "")
    .trim();
  if (/^\d{13}$/.test(cleaned)) return cleaned;
  const gs1 = cleaned.match(/01(\d{14})/);
  if (gs1) {
    const gtin = gs1[1];
    // GTIN-14 pharmaceutique : l'indicateur de packaging est toujours 0 → slice(1)
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
  // Mark the recreation as scan-driven so ready-to-show keeps it hidden until
  // the renderer confirms via attention:bring-to-front that we actually have
  // PCs worth surfacing.
  if (!mainWindow || mainWindow.isDestroyed()) {
    try {
      suppressShowOnReady = true;
      createWindow();
    } catch (e) {
      suppressShowOnReady = false;
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
  lastGlobalScanAt = now;
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
  // NOTE: pas de pop-to-front ici. C'est le renderer qui décide via
  // notifyAnalysisDone() → attention:bring-to-front, et uniquement quand
  // un PC curated a été trouvé pour le médicament scanné. Sans cette
  // condition, chaque CIP inconnu ou chaque produit sans PC volerait
  // l'attention du pharmacien pour rien.
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

function hex(n) { return "0x" + Number(n || 0).toString(16).padStart(4, "0"); }

function scannerPrefPath() {
  return path.join(app.getPath("userData"), "scanner.json");
}
function loadScannerPref() {
  try { return JSON.parse(fs.readFileSync(scannerPrefPath(), "utf-8")); }
  catch { return null; }
}
function applyScannerPref() {
  const pref = loadScannerPref();
  if (pref && typeof pref.allowGeneric === "boolean") {
    hidState.allowGeneric = pref.allowGeneric;
  }
}
function saveScannerPref(pref) {
  try { fs.writeFileSync(scannerPrefPath(), JSON.stringify(pref ?? {})); }
  catch (e) { devWarn("scanner pref save failed:", e); }
}

// HID Usage IDs → ASCII (page 0x07, "Keyboard/Keypad")
const HID_USAGE_TO_CHAR = {
  0x1e: "1", 0x1f: "2", 0x20: "3", 0x21: "4", 0x22: "5",
  0x23: "6", 0x24: "7", 0x25: "8", 0x26: "9", 0x27: "0",
  // Numpad
  0x59: "1", 0x5a: "2", 0x5b: "3", 0x5c: "4", 0x5d: "5",
  0x5e: "6", 0x5f: "7", 0x60: "8", 0x61: "9", 0x62: "0",
  // Letters — kept for GS1 DataMatrix alphanumeric payloads
  0x04: "a", 0x05: "b", 0x06: "c", 0x07: "d", 0x08: "e",
  0x09: "f", 0x0a: "g", 0x0b: "h", 0x0c: "i", 0x0d: "j",
  0x0e: "k", 0x0f: "l", 0x10: "m", 0x11: "n", 0x12: "o",
  0x13: "p", 0x14: "q", 0x15: "r", 0x16: "s", 0x17: "t",
  0x18: "u", 0x19: "v", 0x1a: "w", 0x1b: "x", 0x1c: "y", 0x1d: "z",
  // Common punctuation found in GS1 payloads
  0x2d: "-", 0x36: ",", 0x37: ".",
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
  if (d.usagePage === 0x8C) return true;
  const p = ((d.product || "") + " " + (d.manufacturer || ""));
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
    try { hidState.device.removeAllListeners("data"); } catch (_) {}
    try { hidState.device.close(); } catch (_) {}
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
    if (u === HID_USAGE_ENTER || u === HID_USAGE_NUMPAD_ENTER) { enter = true; continue; }
    if (u === HID_USAGE_TAB) { tab = true; continue; }
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
      `VID=${hex(deviceInfo.vendorId)} PID=${hex(deviceInfo.productId)}`
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
    const aPOS = a.usagePage === 0x8C ? 0 : 1;
    const bPOS = b.usagePage === 0x8C ? 0 : 1;
    if (aPOS !== bPOS) return aPOS - bPOS;
    // Then keyboard interface (where scan data normally flows)
    const ka = (a.usagePage === 1 && a.usage === 6) ? 0 : 1;
    const kb = (b.usagePage === 1 && b.usage === 6) ? 0 : 1;
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

// ────────────────────────────────────────────────────────────
// WebHID init script — injected into the renderer after every
// page load (executeJavaScript with userGesture:true).
//
// Connects to HID POS (usage page 0x8C) barcode scanner devices
// via the WebHID API.  Works without focus and is NOT a keyboard hook
// so it cannot be flagged by antivirus software.
// Only activates if the scanner is in "HID POS" mode (as opposed to
// the default "USB Keyboard" mode used by most cheap scanners).
// ────────────────────────────────────────────────────────────
const WEBHID_INIT_SCRIPT = `
(async () => {
  if (typeof navigator === 'undefined' || !navigator.hid) return;

  const HID_POS_PAGE = 0x8C;
  const MIN_LEN = 7;
  let _wbuf = '';
  let _wlast = 0;
  const RESET_MS = 800;

  function _handleReport(ev) {
    const now = Date.now();
    // Reset buffer on long gap (shouldn't happen for HID POS but be safe)
    if (now - _wlast > RESET_MS && _wbuf.length > 0) _wbuf = '';
    _wlast = now;
    const view = new DataView(ev.data.buffer);
    for (let i = 0; i < view.byteLength; i++) {
      const b = view.getUint8(i);
      if (b === 0) continue; // padding
      if (b === 0x0d || b === 0x0a) { // CR or LF = end of barcode
        const code = _wbuf.trim();
        if (code.length >= MIN_LEN) {
          try {
            window.electronAPI && window.electronAPI.scanner &&
              window.electronAPI.scanner._reportWebHIDBarcode &&
              window.electronAPI.scanner._reportWebHIDBarcode(code);
          } catch(_) {}
        }
        _wbuf = '';
        return;
      }
      if (b > 0x1f && b < 0x7f) _wbuf += String.fromCharCode(b);
    }
    // Some HID POS devices deliver the entire barcode in one report with no
    // terminator — detect by examining the report length field (reportId may
    // encode the string length).  If the buffer grew and nothing terminated it
    // within RESET_MS, flush it.
    if (_wbuf.length >= MIN_LEN) {
      clearTimeout(window.__asclion_webhid_timer);
      window.__asclion_webhid_timer = setTimeout(() => {
        const code = _wbuf.trim();
        if (code.length >= MIN_LEN) {
          try {
            window.electronAPI && window.electronAPI.scanner &&
              window.electronAPI.scanner._reportWebHIDBarcode &&
              window.electronAPI.scanner._reportWebHIDBarcode(code);
          } catch(_) {}
        }
        _wbuf = '';
      }, RESET_MS);
    }
  }

  async function _open(dev) {
    if (!dev.opened) {
      try { await dev.open(); } catch(e) { return false; }
    }
    dev.removeEventListener('inputreport', _handleReport);
    dev.addEventListener('inputreport', _handleReport);
    return true;
  }

  function _isPosScanner(dev) {
    return dev.collections && dev.collections.some(c => c.usagePage === HID_POS_PAGE);
  }

  // 1. Reopen already-permitted devices (persisted across sessions)
  try {
    const granted = await navigator.hid.getDevices();
    for (const d of granted) {
      if (_isPosScanner(d)) await _open(d);
    }
  } catch(_) {}

  // 2. Request device (userGesture:true in executeJavaScript bypasses activation gate)
  try {
    const devs = await navigator.hid.requestDevice({ filters: [{ usagePage: HID_POS_PAGE }] });
    for (const d of devs) await _open(d);
  } catch(_) {}

  // 3. Listen for hot-plug
  navigator.hid.addEventListener('connect', async ({ device }) => {
    if (_isPosScanner(device)) await _open(device);
  });
  navigator.hid.addEventListener('disconnect', ({ device }) => {
    try { if (device.opened) device.close(); } catch(_) {}
  });

  console.log('[ASCLION-WEBHID] init done');
})();
`;

// ────────────────────────────────────────────────────────────
// Clipboard scanner (opt-in, Electron main process)
//
// Polls the system clipboard every 120 ms.  If new content looks
// like a barcode (EAN-13 / CIP-13 / GS1), emits it as a scan.
//
// When to use: configure the scanner to "keyboard wedge + clipboard"
// mode (most scanners support this via a config barcode from the
// manufacturer manual).  The scanner then writes the code to the
// clipboard before/after the keyboard injection, making capture
// completely focus-independent and antivirus-safe.
// ────────────────────────────────────────────────────────────
let clipboardPollTimer = null;
let clipboardLastText = "";
let clipboardEnabled = false;

function startClipboardScanner() {
  if (clipboardPollTimer) return;
  clipboardEnabled = true;
  const { clipboard } = require("electron");
  // Snapshot current clipboard so we don't emit whatever is there on start
  try { clipboardLastText = clipboard.readText().trim(); } catch (_) {}
  clipboardPollTimer = setInterval(() => {
    try {
      const text = clipboard.readText().trim();
      if (!text || text === clipboardLastText) return;
      clipboardLastText = text;
      if (text.length >= SCAN_MIN_LENGTH && text.length <= SCAN_MAX_LENGTH) {
        const parsed = parseBarcodeToCip(text);
        if (parsed) {
          devLog("[SCAN] clipboard detected:", parsed);
          emitGlobalScan(parsed);
        }
      }
    } catch (_) {}
  }, 120);
  devLog("[SCAN] Clipboard polling started.");
}

function stopClipboardScanner() {
  if (clipboardPollTimer) {
    clearInterval(clipboardPollTimer);
    clipboardPollTimer = null;
  }
  clipboardEnabled = false;
  devLog("[SCAN] Clipboard polling stopped.");
}

// ────────────────────────────────────────────────────────────
// SerialPort scanner reader (USB-CDC / Virtual COM Port)
//
// Reads barcode scanners configured in "USB Serial" / "USB-CDC" /
// "Virtual COM Port" mode.  This is the THIRD common scanner mode
// (after USB Keyboard and HID POS).
//
// SAFETY GUARANTEES:
//   • 100% AV-safe (plain file I/O on COM port — same as a modem)
//   • Auto-detects scanners by USB Vendor ID (no port hijacking)
//   • If a COM port is locked by another process (e.g. LGO reading
//     from it directly), open() returns Access Denied and we skip it.
//     We NEVER fight the LGO for the port — we let it win silently.
//   • Auto-rescan every 15 s for hot-plug / replug events.
//
// Runs in parallel to all other scanner paths.  emitGlobalScan
// deduplicates within SCAN_DEDUP_WINDOW_MS so no double-emission.
// ────────────────────────────────────────────────────────────

const SERIAL_BAUD_RATES = [9600, 115200, 38400, 19200, 57600];

const serialState = {
  ports: new Map(), // path → { sp, buf, lastAt, flushTimer, baudRate, info }
  rescanTimer: null,
  lastError: null,
  started: false,
};

async function listSerialPorts() {
  if (!SerialPortLib) return [];
  try {
    const list = await SerialPortLib.SerialPort.list();
    return list || [];
  } catch (e) {
    serialState.lastError = "list: " + (e && e.message);
    return [];
  }
}

function isLikelyScannerPort(p) {
  // 1. Match by USB vendorId (most reliable)
  if (p.vendorId) {
    const vid = parseInt(p.vendorId, 16);
    if (!isNaN(vid) && SCANNER_VIDS.has(vid)) return true;
  }
  // 2. Some Windows enumerations only fill pnpId — extract VID from it
  if (p.pnpId) {
    const m = p.pnpId.match(/VID_([0-9A-Fa-f]{4})/);
    if (m) {
      const vid = parseInt(m[1], 16);
      if (!isNaN(vid) && SCANNER_VIDS.has(vid)) return true;
    }
  }
  // 3. Manufacturer / friendly name match
  if (p.manufacturer && SCANNER_PRODUCT_HINT.test(p.manufacturer)) return true;
  if (p.friendlyName && SCANNER_PRODUCT_HINT.test(p.friendlyName)) return true;
  return false;
}

function flushSerialBuffer(portPath, reason) {
  const state = serialState.ports.get(portPath);
  if (!state) return;
  const raw = state.buf.trim();
  state.buf = "";
  if (raw.length >= SCAN_MIN_LENGTH) {
    const parsed = parseBarcodeToCip(raw);
    if (parsed) {
      devLog(`[SERIAL] barcode (${reason}) from ${portPath}: ${parsed}`);
      emitGlobalScan(parsed);
    } else {
      devLog(`[SERIAL] rejected (${reason}) raw="${raw}"`);
    }
  }
}

function handleSerialData(portPath, data) {
  const state = serialState.ports.get(portPath);
  if (!state) return;
  const now = Date.now();
  // Reset buffer on long gap (>800 ms = next scan, not a continuation)
  if (now - state.lastAt > 800 && state.buf.length > 0) state.buf = "";
  state.lastAt = now;

  // Walk bytes: accumulate printable ASCII, terminate on CR/LF
  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    if (b === 0x0d || b === 0x0a) {
      flushSerialBuffer(portPath, "crlf");
      continue;
    }
    if (b > 0x1f && b < 0x7f && state.buf.length < SCAN_MAX_LENGTH) {
      state.buf += String.fromCharCode(b);
    }
  }

  // Auto-flush after 300 ms idle (scanners that send without terminator)
  clearTimeout(state.flushTimer);
  if (state.buf.length >= SCAN_MIN_LENGTH) {
    state.flushTimer = setTimeout(() => flushSerialBuffer(portPath, "idle"), 300);
  }
}

function openSerialPortAt(portInfo, baudRate) {
  return new Promise((resolve) => {
    if (!SerialPortLib) return resolve({ ok: false, err: "lib not loaded" });
    try {
      const sp = new SerialPortLib.SerialPort({
        path: portInfo.path,
        baudRate,
        autoOpen: false,
      });
      sp.open((err) => {
        if (err) return resolve({ ok: false, err: err.message || String(err) });
        resolve({ ok: true, sp });
      });
    } catch (e) {
      resolve({ ok: false, err: e && e.message });
    }
  });
}

async function tryOpenScannerPort(portInfo) {
  if (!SerialPortLib) return;
  if (serialState.ports.has(portInfo.path)) return; // already open

  let opened = null;
  let lastErr = null;

  // Try the most common scanner baud rates in order
  for (const baudRate of SERIAL_BAUD_RATES) {
    const res = await openSerialPortAt(portInfo, baudRate);
    if (res.ok) {
      opened = { sp: res.sp, baudRate };
      break;
    }
    lastErr = res.err;
    // If "Access denied" / "in use" → another process owns it (LGO probably).
    // Don't keep trying other baud rates, just skip this port silently.
    if (lastErr && /access|denied|busy|in use|locked|EBUSY|EACCES/i.test(lastErr)) {
      devLog(`[SERIAL] ${portInfo.path} in use by another process — skipping`);
      return;
    }
  }

  if (!opened) {
    devWarn(`[SERIAL] cannot open ${portInfo.path}: ${lastErr}`);
    return;
  }

  const state = {
    sp: opened.sp,
    buf: "",
    lastAt: 0,
    flushTimer: null,
    baudRate: opened.baudRate,
    info: {
      path: portInfo.path,
      manufacturer: portInfo.manufacturer || null,
      vendorId: portInfo.vendorId || null,
      productId: portInfo.productId || null,
      friendlyName: portInfo.friendlyName || null,
    },
  };
  serialState.ports.set(portInfo.path, state);

  opened.sp.on("data", (chunk) => handleSerialData(portInfo.path, chunk));
  opened.sp.on("error", (err) => {
    devWarn(`[SERIAL] ${portInfo.path} runtime error:`, err && err.message);
  });
  opened.sp.on("close", () => {
    serialState.ports.delete(portInfo.path);
    devLog(`[SERIAL] ${portInfo.path} closed`);
  });

  devLog(
    `[SERIAL] opened ${portInfo.path} @ ${opened.baudRate} baud ` +
    `(${portInfo.manufacturer || "?"} VID=${portInfo.vendorId || "?"})`,
  );
}

async function rescanSerial() {
  if (!SerialPortLib) return;
  const list = await listSerialPorts();
  const currentPaths = new Set(list.map((p) => p.path));

  // 1. Open newly-detected scanner ports
  for (const p of list) {
    if (isLikelyScannerPort(p) && !serialState.ports.has(p.path)) {
      await tryOpenScannerPort(p);
    }
  }

  // 2. Close ports for devices that disappeared (unplugged)
  for (const [pathName, state] of serialState.ports.entries()) {
    if (!currentPaths.has(pathName)) {
      try { state.sp.close(() => {}); } catch (_) {}
      serialState.ports.delete(pathName);
      devLog(`[SERIAL] device removed: ${pathName}`);
    }
  }
}

function startSerialScan() {
  if (!SerialPortLib) return;
  if (serialState.rescanTimer) return;
  serialState.started = true;
  // Initial scan + hot-plug detection
  rescanSerial().catch((e) => devWarn("[SERIAL] initial scan failed:", e));
  serialState.rescanTimer = setInterval(() => {
    rescanSerial().catch((e) => devWarn("[SERIAL] rescan failed:", e));
  }, 15000);
  devLog("[SERIAL] scanner started (auto-detect every 15 s)");
}

function stopSerialScan() {
  if (serialState.rescanTimer) {
    clearInterval(serialState.rescanTimer);
    serialState.rescanTimer = null;
  }
  for (const [_path, state] of serialState.ports.entries()) {
    try { state.sp.close(() => {}); } catch (_) {}
  }
  serialState.ports.clear();
  serialState.started = false;
}

// ────────────────────────────────────────────────────────────
// Windows Raw Input (RIDEV_INPUTSINK) — PowerShell/C# subprocess
//
// WHY: Win32 Raw Input is fundamentally different from keyboard hooks.
//   • SetWindowsHookEx(WH_KEYBOARD_LL) → antivirus ALWAYS flags this
//   • RegisterRawInputDevices(RIDEV_INPUTSINK) → READ-ONLY message delivery
//     to a specific HWND, not a system-wide interception. No AV heuristic
//     targets this API for legitimate processes.
//
// HOW: spawns a hidden PowerShell process that:
//   1. Compiles a tiny C# class (Add-Type) creating a hidden WinForms window
//   2. Registers the window for Raw Input with RIDEV_INPUTSINK
//   3. Processes WM_INPUT messages: accumulates keypresses, detects barcodes
//   4. Writes "BARCODE:<code>\n" to stdout for main.js to consume
//
// Works for ANY scanner in USB Keyboard mode, no configuration needed.
// Runs in parallel with node-hid / WebHID / uiohook; emitGlobalScan deduplicates.
// ────────────────────────────────────────────────────────────

// C# source embedded as a PowerShell Add-Type block.
// Using String.raw to preserve backslashes literally.
const RAW_INPUT_PS_SCRIPT = String.raw`
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

public sealed class AsclionRawInput : Form {
    // ── Win32 constants ───────────────────────────────────
    const int  WM_INPUT           = 0x00FF;
    const uint RID_INPUT          = 0x10000003;
    const int  RIDEV_INPUTSINK    = 0x00000100;
    const uint RIM_TYPEKEYBOARD   = 1;
    const ushort RI_KEY_BREAK     = 0x0001; // key-up bit in RAWKEYBOARD.Flags

    // ── P/Invoke signatures ───────────────────────────────
    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTDEVICE {
        public ushort usUsagePage;
        public ushort usUsage;
        public int    dwFlags;
        public IntPtr hwndTarget;
    }

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool RegisterRawInputDevices(
        [In] RAWINPUTDEVICE[] devices, int count, int cbSize);

    [DllImport("user32.dll")]
    static extern int GetRawInputData(
        IntPtr hRawInput, uint uiCommand,
        IntPtr pData, ref int pcbSize, int cbSizeHeader);

    // RAWINPUTHEADER size: 24 bytes on 64-bit, 16 bytes on 32-bit
    static readonly int HDR_SIZE = IntPtr.Size == 8 ? 24 : 16;

    // ── Scanner state ─────────────────────────────────────
    readonly StringBuilder _buf = new StringBuilder(64);
    long _lastMs = 0;
    const int MAX_GAP_MS = 180;
    const int MIN_LEN    = 7;
    const int MAX_LEN    = 60;

    // ── Form init ─────────────────────────────────────────
    public AsclionRawInput() {
        Text            = "AsclionRawInputHelper";
        WindowState     = FormWindowState.Minimized;
        ShowInTaskbar   = false;
        FormBorderStyle = FormBorderStyle.None;
        Opacity         = 0;
        Width           = 0;
        Height          = 0;
    }

    protected override void OnHandleCreated(EventArgs e) {
        base.OnHandleCreated(e);
        var dev = new RAWINPUTDEVICE[1];
        dev[0].usUsagePage = 1;   // HID_USAGE_PAGE_GENERIC
        dev[0].usUsage     = 6;   // HID_USAGE_GENERIC_KEYBOARD
        dev[0].dwFlags     = RIDEV_INPUTSINK;
        dev[0].hwndTarget  = Handle;
        bool ok = RegisterRawInputDevices(dev, 1, Marshal.SizeOf(typeof(RAWINPUTDEVICE)));
        // Report status on stderr (devLog in main.js)
        Console.Error.WriteLine(ok
            ? "STATUS:RawInput registered OK"
            : "STATUS:RegisterRawInputDevices failed, err=" + Marshal.GetLastWin32Error());
        Console.Error.Flush();
    }

    // ── Message pump ──────────────────────────────────────
    protected override void WndProc(ref Message m) {
        if (m.Msg == WM_INPUT) ProcessRawInput(m.LParam);
        base.WndProc(ref m);
    }

    void ProcessRawInput(IntPtr hRawInput) {
        int sz = 0;
        // First call: get required buffer size
        GetRawInputData(hRawInput, RID_INPUT, IntPtr.Zero, ref sz, HDR_SIZE);
        if (sz <= 0) return;

        IntPtr ptr = Marshal.AllocHGlobal(sz);
        try {
            int read = GetRawInputData(hRawInput, RID_INPUT, ptr, ref sz, HDR_SIZE);
            if (read < 0) return;

            // RAWINPUTHEADER.dwType is at offset 0 (uint, 4 bytes)
            uint type = (uint)Marshal.ReadInt32(ptr, 0);
            if (type != RIM_TYPEKEYBOARD) return;

            // RAWKEYBOARD layout (after header):
            //   offset 0: MakeCode  (WORD)
            //   offset 2: Flags     (WORD)  ← RI_KEY_BREAK = key-up
            //   offset 4: Reserved  (WORD)
            //   offset 6: VKey      (WORD)  ← virtual key code
            //   offset 8: Message   (DWORD)
            ushort flags = (ushort)(Marshal.ReadInt16(ptr, HDR_SIZE + 2) & 0xFFFF);
            ushort vkey  = (ushort)(Marshal.ReadInt16(ptr, HDR_SIZE + 6) & 0xFFFF);

            if ((flags & RI_KEY_BREAK) != 0) return; // ignore key-up
            HandleVKey(vkey);
        } finally {
            Marshal.FreeHGlobal(ptr);
        }
    }

    // Convert Virtual Key to ASCII character.
    // Digits are layout-independent → covers EAN-13 / CIP-13 on any keyboard.
    // Letters may be layout-shifted on AZERTY but GS1 DataMatrix is handled
    // downstream by parseBarcodeToCip which is tolerant of case.
    static string VkToChar(ushort vk) {
        if (vk >= 0x30 && vk <= 0x39) return ((char)vk).ToString();              // row digits 0-9
        if (vk >= 0x60 && vk <= 0x69) return ((char)(vk - 0x60 + 0x30)).ToString(); // numpad 0-9
        if (vk >= 0x41 && vk <= 0x5A) return ((char)(vk + 32)).ToString();        // A-Z → a-z
        if (vk == 0xBD) return "-"; // VK_OEM_MINUS
        return null;
    }

    void HandleVKey(ushort vk) {
        // Enter (VK_RETURN = 0x0D) or Tab (VK_TAB = 0x09) = terminator
        if (vk == 0x0D || vk == 0x09) {
            string s = _buf.ToString();
            if (s.Length >= MIN_LEN) {
                Console.WriteLine("BARCODE:" + s);
                Console.Out.Flush();
            }
            _buf.Clear();
            return;
        }
        // Modifier keys: Shift, Ctrl, Alt, Win (LR variants) — don't break buffer
        if (vk == 0x10 || vk == 0x11 || vk == 0x12 ||
            vk == 0xA0 || vk == 0xA1 ||
            vk == 0xA2 || vk == 0xA3 ||
            vk == 0xA4 || vk == 0xA5 ||
            vk == 0x5B || vk == 0x5C) return;

        long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        // Inter-key gap too large → start fresh (scanner sends chars fast, humans slow)
        if (_buf.Length > 0 && now - _lastMs > MAX_GAP_MS) _buf.Clear();
        _lastMs = now;

        string ch = VkToChar(vk);
        if (ch != null) {
            if (_buf.Length < MAX_LEN) _buf.Append(ch);
        } else {
            // Unrecognised non-modifier key (function key, arrow, etc.) breaks sequence
            _buf.Clear();
        }
    }

    [STAThread]
    public static void Start() {
        Console.OutputEncoding = Encoding.UTF8;
        Console.Out.AutoFlush  = false; // we flush manually
        Application.Run(new AsclionRawInput());
    }
}
'@
[AsclionRawInput]::Start()
`;

let rawInputProc = null;
let rawInputStarted = false;
let rawInputError = null;
let isQuitting = false;

function startRawInput() {
  if (process.platform !== "win32") return;
  if (rawInputProc) return;

  // Write the PowerShell script to userData (less suspicious than %TEMP%)
  const ps1Path = path.join(app.getPath("userData"), "asclion-rawinput-helper.ps1");
  try {
    fs.writeFileSync(ps1Path, RAW_INPUT_PS_SCRIPT, "utf-8");
  } catch (e) {
    rawInputError = "write: " + (e && e.message);
    devWarn("[RAWINPUT] failed to write script:", e);
    return;
  }

  try {
    const { spawn } = require("child_process");
    rawInputProc = spawn(
      "powershell.exe",
      [
        "-ExecutionPolicy", "Bypass",
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle", "Hidden",
        "-File", ps1Path,
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdoutBuf = "";
    rawInputProc.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString("utf-8");
      const lines = stdoutBuf.split(/\r?\n/);
      stdoutBuf = lines.pop(); // keep partial last line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("BARCODE:")) continue;
        const raw = trimmed.slice(8).trim();
        if (raw.length < SCAN_MIN_LENGTH) continue;
        const parsed = parseBarcodeToCip(raw);
        if (parsed) {
          devLog("[RAWINPUT] barcode:", parsed);
          emitGlobalScan(parsed);
        } else {
          devLog("[RAWINPUT] rejected raw:", raw);
        }
      }
    });

    rawInputProc.stderr.on("data", (chunk) => {
      const msg = chunk.toString("utf-8").trim();
      if (msg) devLog("[RAWINPUT]", msg);
      if (msg.includes("STATUS:ok") || msg.includes("STATUS:RawInput registered OK")) {
        rawInputError = null;
      } else if (msg.includes("STATUS:fail") || msg.includes("STATUS:RegisterRawInputDevices failed")) {
        rawInputError = msg;
      }
    });

    rawInputProc.on("exit", (code, signal) => {
      devLog("[RAWINPUT] process exited:", code, signal);
      rawInputProc = null;
      rawInputStarted = false;
      rawInputError = rawInputError || `exited (code ${code})`;
      // Auto-restart after 15 s unless the app is shutting down
      if (!isQuitting) {
        setTimeout(() => {
          if (!rawInputProc && !isQuitting) startRawInput();
        }, 15000);
      }
    });

    rawInputProc.on("error", (err) => {
      rawInputError = "spawn: " + (err && err.message);
      devWarn("[RAWINPUT] spawn error:", err);
      rawInputProc = null;
      rawInputStarted = false;
    });

    rawInputStarted = true;
    rawInputError = null;
    devLog("[RAWINPUT] subprocess spawned, PID:", rawInputProc.pid);
  } catch (e) {
    rawInputError = "spawn: " + (e && e.message);
    devWarn("[RAWINPUT] failed to spawn:", e);
    rawInputProc = null;
    rawInputStarted = false;
  }
}

function stopRawInput() {
  if (rawInputProc) {
    try { rawInputProc.kill("SIGTERM"); } catch (_) {}
    rawInputProc = null;
  }
  rawInputStarted = false;
}

// ────────────────────────────────────────────────────────────
// Native N-API Raw Input — preferred over the PowerShell subprocess.
// Same Win32 API (RegisterRawInputDevices + RIDEV_INPUTSINK) but in-process,
// no subprocess to be killed by GPO, no C# JIT cost at startup.
// ────────────────────────────────────────────────────────────
let nativeRawInputStarted = false;
function startNativeRawInput() {
  if (!nativeRawInput || !nativeRawInput.available) return false;
  if (nativeRawInputStarted) return true;
  const ok = nativeRawInput.start((rawBuffer) => {
    if (!rawBuffer || rawBuffer.length < SCAN_MIN_LENGTH) return;
    const parsed = parseBarcodeToCip(rawBuffer);
    if (parsed) {
      devLog("[RAWINPUT-NATIVE] barcode:", parsed);
      emitGlobalScan(parsed);
    } else {
      devLog("[RAWINPUT-NATIVE] rejected raw:", rawBuffer);
    }
  });
  nativeRawInputStarted = !!ok;
  if (!nativeRawInputStarted) {
    devWarn("[RAWINPUT-NATIVE] start() returned false:", nativeRawInput.loadError);
  } else {
    devLog("[RAWINPUT-NATIVE] started OK");
  }
  return nativeRawInputStarted;
}
function stopNativeRawInput() {
  if (nativeRawInput && nativeRawInputStarted) {
    nativeRawInput.stop();
    nativeRawInputStarted = false;
  }
}

function bootScannerStack() {
  // Load persisted preferences (allowGeneric, clipboard, etc.) before scanning
  applyScannerPref();
  const pref = loadScannerPref();
  if (pref && pref.clipboardEnabled) startClipboardScanner();

  // ALL methods run in parallel.  emitGlobalScan() deduplicates within 800 ms
  // so duplicate captures from multiple paths are silently dropped.

  // 1) NATIVE Raw Input N-API (Windows, in-process) — preferred over the
  //    PowerShell subprocess. Inherits Electron signature, no GPO/EDR friction.
  const nativeRiOk = startNativeRawInput();

  // 2) SerialPort (USB-CDC) — AV-safe (file I/O), auto-detect scanner VIDs
  //    Skips ports in use by other apps (LGO).  No conflict with anyone.
  startSerialScan();

  // 3) Direct HID read (node-hid) — AV-safe, works for HID POS / non-keyboard interfaces
  if (HID) {
    const best = findBestScanner();
    if (best) openHidDevice(best);
    startHidPolling();
  }

  // 4) PowerShell Raw Input subprocess — fallback if native N-API addon failed
  //    to load (binary not built, blocked by AppLocker, etc.). Kept for parity
  //    with previous behaviour.
  if (!nativeRiOk) {
    devLog("[BOOT] native RawInput unavailable, falling back to PowerShell subprocess");
    startRawInput();
  }

  // 5) uiohook-napi — global keyboard hook (may be blocked by AV, last resort)
  startUiohookFallback();

  // 6) WebHID path is started by preload.js via navigator.hid after did-finish-load.
  //    Activates only if scanner is in HID POS mode (usage page 0x8C).
}

function getScannerStatus() {
  const mode = hidState.device
    ? "hid-direct"
    : uiohookStarted
      ? "uiohook"
      : "none";
  // Synchronous read of the cached elevation value — the cache is refreshed
  // by the IPC handler / heartbeat path (detectElevation runs every 60 s).
  // null means "pas encore détecté" (premier heartbeat avant le warm-up).
  const elevated = elevationCache.value;
  const autolaunchState = readAutolaunchState();
  return {
    mode,
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
    // Last successful scan from ANY path (N-API, PS, uiohook, HID, serial…)
    lastGlobalScanAt: lastGlobalScanAt || null,
    // Global keyboard diagnostic (uiohook path)
    lastGlobalKeyAt: scanLastGlobalKeyAt || null,
    globalBufferLen: scanBuffer.length,
    lastRejection: scanLastRejection,
    // Clipboard scanner
    clipboardEnabled,
    // WebHID (managed renderer-side; this just confirms the flag is set)
    webHidEnabled: true, // always available in Electron — activation depends on scanner mode
    // Raw Input Win32 subprocess (PowerShell fallback)
    rawInputStarted,
    rawInputError,
    // Native N-API Raw Input (preferred)
    nativeRawInputLoaded: !!(nativeRawInput && nativeRawInput.available),
    nativeRawInputLoadError: nativeRawInputError,
    nativeRawInputStarted,
    // SerialPort (USB-CDC) scanner
    serialLoaded: !!SerialPortLib,
    serialLoadError,
    serialStarted: serialState.started,
    serialOpenPorts: Array.from(serialState.ports.values()).map((s) => ({
      path: s.info.path,
      manufacturer: s.info.manufacturer,
      vendorId: s.info.vendorId,
      productId: s.info.productId,
      baudRate: s.baudRate,
    })),
    serialLastError: serialState.lastError,
    // ── Privilèges Windows ────────────────────────────────────
    // true  = Asclion tourne en High Integrity Level (admin)
    //         → bypass UIPI, capture scan OK même quand LGO a le focus
    // false = Medium IL (user normal) → la capture passe quand même
    //         tant que le LGO n'est PAS lui-même elevé
    // null  = pas encore détecté (premier heartbeat)
    elevated,
    autolaunch: autolaunchState
      ? {
          userSid: autolaunchState.userSid || null,
          taskRegistered: Array.isArray(autolaunchState.tasks) && autolaunchState.tasks.some((t) => t.registered),
          taskErrors: Array.isArray(autolaunchState.tasks)
            ? autolaunchState.tasks.filter((t) => !t.registered && t.error).map((t) => `${t.name}: ${t.error}`).slice(0, 3)
            : [],
          repairPrompt: autolaunchState.repairPrompt || null,
          updatedAt: autolaunchState.updatedAt || null,
        }
      : null,
    platform: process.platform,
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
    try { if (dev) { dev.removeAllListeners(); dev.close(); } } catch (_) {}
  }
  return {
    ok: true,
    reports: reports.slice(-30),
    count: reports.length,
    decoded: decodedBuffer,
    barcodeDetected,
  };
});

// ── WebHID IPC ────────────────────────────────────────────────────────────

// Called by preload.js when navigator.hid detects a full barcode scan.
// Joins the same emitGlobalScan() path as HID-direct and uiohook.
ipcMain.handle("scanner:webhid-barcode", (_e, raw) => {
  if (!raw || typeof raw !== "string") return;
  const parsed = parseBarcodeToCip(raw);
  if (parsed) {
    devLog("[WEBHID] barcode:", parsed);
    emitGlobalScan(parsed);
  } else {
    devLog("[WEBHID] rejected raw:", raw);
  }
});

// Ask the renderer to call navigator.hid.requestDevice() with userGesture:true.
// This opens the device picker (or auto-selects via select-hid-device if already
// configured).  Called from the admin panel "Connecter WebHID" button.
ipcMain.handle("scanner:webhid-request", () => {
  if (!mainWindow) return { ok: false, error: "no window" };
  mainWindow.webContents
    .executeJavaScript(WEBHID_INIT_SCRIPT, true)
    .catch((e) => devWarn("[WEBHID] manual request failed:", e));
  return { ok: true };
});

// ── Clipboard scanner IPC ─────────────────────────────────────────────────

ipcMain.handle("scanner:clipboard-start", () => {
  startClipboardScanner();
  try {
    const pref = loadScannerPref() || {};
    fs.writeFileSync(scannerPrefPath(), JSON.stringify({ ...pref, clipboardEnabled: true }));
  } catch (_) {}
  return getScannerStatus();
});

ipcMain.handle("scanner:clipboard-stop", () => {
  stopClipboardScanner();
  try {
    const pref = loadScannerPref() || {};
    fs.writeFileSync(scannerPrefPath(), JSON.stringify({ ...pref, clipboardEnabled: false }));
  } catch (_) {}
  return getScannerStatus();
});

// ─────────────────────────────────────────────────────────────────────────

// Enable / disable auto-binding to generic keyboard-class HID devices.
// Must be activated explicitly by the pharmacist from the admin panel.
ipcMain.handle("scanner:set-allow-generic", (_e, allow) => {
  hidState.allowGeneric = !!allow;
  // Persist in scanner pref
  try {
    const pref = loadScannerPref() || {};
    fs.writeFileSync(scannerPrefPath(), JSON.stringify({ ...pref, allowGeneric: hidState.allowGeneric }));
  } catch (e) { devWarn("allowGeneric pref save failed:", e); }
  // If enabling and no device bound yet, trigger a rebind scan
  if (hidState.allowGeneric && !hidState.device) {
    const best = findBestScanner();
    if (best) openHidDevice(best);
  }
  return getScannerStatus();
});

// Dev/test only — injects a barcode directly into the scan pipeline,
// bypassing all hardware paths. Only available in development builds.
ipcMain.handle("scanner:inject", (_e, { code } = {}) => {
  if (!app.isPackaged && code && typeof code === "string") {
    emitGlobalScan(code.trim(), "inject");
    return { ok: true, code: code.trim() };
  }
  return { ok: false, error: app.isPackaged ? "disabled in production" : "invalid code" };
});

// ────────────────────────────────────────────────────────────
// Robot interception subsystem
//
// Boot order: HTTP listener first (every PC needs it so the robot-server PC
// can reach them), then the sniffer (only useful on the PC physically wired
// to the robot, but harmless to start everywhere — it stays in "disabled"
// mode unless the user enables it from Paramètres).
// ────────────────────────────────────────────────────────────
function bootRobotSubsystem() {
  if (robotSubsystemError || !robotConfig || !robotListener || !robotSniffer) {
    devWarn("[ROBOT] subsystem disabled:", robotSubsystemError || "modules missing");
    return;
  }
  robotConfig.setConfigPath(path.join(app.getPath("userData"), "asclion-robot-config.json"));
  // Generate the shared secret on first launch (idempotent: returns existing
  // token on subsequent calls). The pharmacist can read it from Paramètres to
  // copy it across PCs in the officine.
  const sharedToken = robotConfig.ensureSecret();
  const cfg = robotConfig.get();

  robotListener.init({
    version: app.getVersion(),
    log: devLog,
    warn: devWarn,
    // POST /trigger reuses the SAME pipeline as a HID scan — emitGlobalScan
    // handles dedup, window pop, IPC to renderer, etc.
    onTrigger: (ean) => emitGlobalScan(ean),
  });
  robotListener
    .start({
      port: cfg.httpPort,
      // bindHost defaults to 127.0.0.1; serveLan = true rebinds to 0.0.0.0
      // and enforces the shared token on every POST /trigger.
      serveLan: !!cfg.serveLan,
      token: sharedToken,
    })
    .then((r) => {
      if (!r.ok) devWarn(`[HTTP] listener failed to start: ${r.error}`);
    });

  robotSniffer.init({
    log: devLog,
    warn: devWarn,
    onLocalTrigger: (ean) => emitGlobalScan(ean),
    userDataDir: app.getPath("userData"),
    // Token sent in the X-Asclion-Token header of every cross-PC trigger.
    httpToken: sharedToken,
  });
  robotSniffer.start(cfg);
}

ipcMain.handle("robot:get-config", () => {
  if (!robotConfig) return { error: robotSubsystemError || "subsystem missing" };
  return redactConfigForRenderer(robotConfig.get());
});

ipcMain.handle("robot:set-config", (_e, patch) => {
  if (!robotConfig) return { ok: false, error: robotSubsystemError || "subsystem missing" };
  // Block client-side attempts to rewrite the shared secret. The token is
  // generated server-side and surfaced via robot:get-token only — exposing
  // a setter would let a compromised renderer downgrade the token to "" and
  // open the LAN listener to anyone.
  if (patch && Object.prototype.hasOwnProperty.call(patch, "httpToken")) delete patch.httpToken;
  try {
    const next = robotConfig.save(patch || {});
    const token = robotConfig.ensureSecret();
    const listenerStatus = robotListener ? robotListener.getStatus() : null;
    // Restart the listener if: port changed, LAN-vs-localhost bind toggled,
    // or the listener wasn't running yet.
    const portChanged = patch && patch.httpPort && patch.httpPort !== (listenerStatus && listenerStatus.port);
    const bindChanged = patch && typeof patch.serveLan === "boolean" && !!patch.serveLan !== !!(listenerStatus && listenerStatus.serveLan);
    if (robotListener && (portChanged || bindChanged || !(listenerStatus && listenerStatus.listening))) {
      robotListener.start({ port: next.httpPort, serveLan: !!next.serveLan, token });
    }
    if (robotSniffer) robotSniffer.start(next);
    return { ok: true, config: redactConfigForRenderer(next) };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

// Hide the shared secret from the renderer. The token never crosses the
// preload boundary except via the explicit `robot:get-token` handler so an
// XSS on the lovable origin can't simply read it from a generic getConfig.
function redactConfigForRenderer(cfg) {
  if (!cfg) return cfg;
  const { httpToken: _ignored, ...rest } = cfg;
  return { ...rest, httpToken: null, httpTokenSet: !!(cfg.httpToken && cfg.httpToken.length >= 24) };
}

ipcMain.handle("robot:get-token", () => {
  // Explicit endpoint: the renderer surfaces the token in Paramètres so the
  // pharmacist can copy it to other PCs. Distinct from get-config to make
  // any leak via that path obvious in audits.
  return robotConfig ? robotConfig.ensureSecret() : null;
});

// Replace the shared secret with one supplied by the pharmacist (paste from
// the robot-server PC's clipboard). Strict validation — anything shorter
// than 24 chars or carrying weird bytes is rejected to keep brute-force out
// of reach and to detect copy/paste mishaps early.
ipcMain.handle("robot:set-token", (_e, token) => {
  if (!robotConfig) return { ok: false, error: robotSubsystemError || "subsystem missing" };
  const t = String(token || "").trim();
  if (t.length < 24 || t.length > 128 || !/^[A-Za-z0-9_-]+$/.test(t)) {
    return { ok: false, error: "Jeton invalide (24–128 caractères alphanumériques, _ ou -)." };
  }
  try {
    const next = robotConfig.save({ httpToken: t });
    // Restart the listener so the new token is enforced immediately.
    if (robotListener) {
      robotListener.start({ port: next.httpPort, serveLan: !!next.serveLan, token: t });
    }
    if (robotSniffer) {
      robotSniffer.init({ httpToken: t });
      robotSniffer.start(next);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

// Generate a fresh token. The pharmacist then has to re-distribute it to the
// other PCs in the officine — no automatic propagation, by design (it would
// require a discovery mechanism we don't want to maintain).
ipcMain.handle("robot:regenerate-token", () => {
  if (!robotConfig) return { ok: false, error: robotSubsystemError || "subsystem missing" };
  try {
    // Force regeneration by clearing then ensuring.
    const cleared = robotConfig.save({ httpToken: "" });
    const fresh = robotConfig.ensureSecret();
    const next = robotConfig.get();
    if (robotListener) robotListener.start({ port: next.httpPort, serveLan: !!next.serveLan, token: fresh });
    if (robotSniffer) {
      robotSniffer.init({ httpToken: fresh });
      robotSniffer.start(next);
    }
    return { ok: true, token: fresh };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("robot:status", () => {
  return {
    subsystemError: robotSubsystemError,
    listener: robotListener ? robotListener.getStatus() : null,
    sniffer: robotSniffer ? robotSniffer.getStatus() : null,
    config: robotConfig ? robotConfig.get() : null,
  };
});

// ────────────────────────────────────────────────────────────
// robot:discover-port
//
// Lists currently established TCP connections from this PC so the pharmacist
// can identify the LGO → robot link from the Paramètres UI without having to
// know the exact port. Returns one row per connection, sorted with the most
// likely robot connection on top:
//   1. process name matches a known LGO (winpharma, lgpi, pharmagest…)
//   2. remote port matches a known robot default (9876, 6100, 5000, …)
//
// Powered by `Get-NetTCPConnection`, available on Windows 8 / Server 2012+.
// Returns { ok: false, error } on Linux/macOS or when PowerShell rejects.
// ────────────────────────────────────────────────────────────
const LGO_PROCESS_HINTS = /winpharma|wpgest|wp\b|lgpi|pharmagest|leo\b|smartrx|smart_rx|leopharm/i;
const KNOWN_ROBOT_PORTS = new Set([
  9876,  // Rowa / BD Rowa
  6100, 6200, // Pharmathek
  5000, 12000, // Knapp
  8080, 9100, // Swisslog
  4444,  // Tosho
]);

ipcMain.handle("robot:discover-port", async () => {
  if (process.platform !== "win32") {
    return { ok: false, error: "Windows uniquement", candidates: [] };
  }
  // Single-quoted here-string keeps the script literal — no PowerShell-side
  // variable interpolation of $_ would otherwise happen before we even spawn.
  const psScript =
    "$ErrorActionPreference='SilentlyContinue';" +
    "$rows = Get-NetTCPConnection -State Established | " +
    "Where-Object { $_.RemoteAddress -notmatch '^(127\\.|0\\.0\\.0\\.0|::|fe80)' } | " +
    "ForEach-Object { " +
      "$proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; " +
      "[PSCustomObject]@{ " +
        "LocalPort=[int]$_.LocalPort; " +
        "RemoteAddress=[string]$_.RemoteAddress; " +
        "RemotePort=[int]$_.RemotePort; " +
        "Process=if($proc){$proc.Name}else{'unknown'}; " +
        "ProcId=[int]$_.OwningProcess " +
      "} " +
    "}; " +
    "ConvertTo-Json -InputObject @($rows) -Compress -Depth 4";

  return await new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
        { windowsHide: true },
      );
    } catch (e) {
      resolve({ ok: false, error: `spawn: ${e && e.message}`, candidates: [] });
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* noop */ }
    }, 10_000);
    child.stdout.on("data", (d) => { stdout += d.toString("utf-8"); });
    child.stderr.on("data", (d) => { stderr += d.toString("utf-8"); });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `powershell: ${err && err.message}`, candidates: [] });
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const raw = (stdout || "").trim();
        if (!raw) {
          resolve({ ok: true, candidates: [], note: "Aucune connexion TCP établie depuis ce PC." });
          return;
        }
        const parsed = JSON.parse(raw);
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        const candidates = rows
          .map((c) => {
            const proc = (c.Process || "").toString();
            const remotePort = Number(c.RemotePort) || 0;
            const isLgo = LGO_PROCESS_HINTS.test(proc);
            const isKnownRobotPort = KNOWN_ROBOT_PORTS.has(remotePort);
            return {
              process: proc,
              pid: Number(c.ProcId) || 0,
              remoteAddress: c.RemoteAddress || "",
              remotePort,
              localPort: Number(c.LocalPort) || 0,
              isLgo,
              isKnownRobotPort,
              score: (isLgo ? 2 : 0) + (isKnownRobotPort ? 1 : 0),
            };
          })
          // Drop obvious noise: browser tabs, system services on high ports.
          .filter((c) => c.remotePort > 0 && c.remotePort < 65535)
          .sort((a, b) => b.score - a.score);
        resolve({ ok: true, candidates });
      } catch (e) {
        resolve({
          ok: false,
          error: stderr.trim() || (e && e.message) || "parse error",
          candidates: [],
        });
      }
    });
    child.stdin && child.stdin.end();
  });
});

// Manual update check — surfaced in Paramètres so the pharmacist can verify
// a release went out without restarting the app.
ipcMain.handle("updater:check", async () => {
  try {
    const r = await autoUpdater.checkForUpdates();
    return {
      ok: true,
      updateAvailable: !!r && !!r.updateInfo && r.updateInfo.version !== app.getVersion(),
      currentVersion: app.getVersion(),
      latestVersion: r && r.updateInfo ? r.updateInfo.version : null,
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e), currentVersion: app.getVersion() };
  }
});

app.on("will-quit", () => {
  isQuitting = true;
  stopNativeRawInput();
  stopRawInput();
  stopSerialScan();
  try { if (uIOhook && uiohookStarted) uIOhook.stop(); } catch { /* noop */ }
  try { closeHidDevice(); } catch { /* noop */ }
  if (hidState.pollTimer) { clearInterval(hidState.pollTimer); hidState.pollTimer = null; }
  stopClipboardScanner();
  try { if (robotListener) robotListener.stop(); } catch { /* noop */ }
  try { if (robotSniffer) robotSniffer.stop(); } catch { /* noop */ }
});
