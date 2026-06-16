const { contextBridge, ipcRenderer } = require("electron");

Object.defineProperty(window, "__ASCLION_DESKTOP__", {
  value: true,
  enumerable: false,
  configurable: false,
});

// Expose a minimal API to the renderer
contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  platform: process.platform,

  // Show a native OS notification (fires on background scans, etc.)
  notify: (payload) => ipcRenderer.invoke("notify", payload),

  // Receive a click on a previously shown notification
  onNotificationClick: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("notification-clicked", handler);
    return () => ipcRenderer.removeListener("notification-clicked", handler);
  },

  // Receive an LGO auto-detection event from the main process
  onLgoDetected: (callback) => {
    const handler = (_e, payload) => callback(payload);
    ipcRenderer.on("lgo-detected", handler);
    return () => ipcRenderer.removeListener("lgo-detected", handler);
  },

  // Receive a globally captured HID barcode scan (system-wide, no focus required)
  onGlobalBarcode: (callback) => {
    const handler = (_e, payload) => callback(payload);
    ipcRenderer.on("global-barcode", handler);
    return () => ipcRenderer.removeListener("global-barcode", handler);
  },

  // Picture-in-Picture (always-on-top + compact mode)
  pip: {
    getState: () => ipcRenderer.invoke("pip:get-state"),
    toggle: () => ipcRenderer.invoke("pip:toggle"),
    setCompact: (compact) => ipcRenderer.invoke("pip:set-compact", compact),
  },

  // Attention / notifications (flash taskbar icon + bring to front)
  attention: {
    flash: () => ipcRenderer.invoke("attention:flash"),
    bringToFront: () => ipcRenderer.invoke("attention:bring-to-front"),
    isFocused: () => ipcRenderer.invoke("attention:is-focused"),
  },

  // Robust auto-launch (Windows Task Scheduler)
  autolaunch: {
    status: () => ipcRenderer.invoke("autolaunch:status"),
    reinstall: () => ipcRenderer.invoke("autolaunch:reinstall"),
  },

  // System privileges — admin/user integrity level detection + admin relaunch.
  // Utilisé par le diag admin pour identifier les postes où la capture
  // scan en background est garantie (elevated=true) vs. fragile (elevated=false).
  system: {
    isElevated: () => ipcRenderer.invoke("system:is-elevated"),
    // Relance Asclion en admin immédiatement (déclenche UAC). Si l'utilisateur
    // accepte, la nouvelle instance démarre en admin et celle-ci se quitte.
    // À utiliser depuis un bouton "Activer le mode admin" côté UI.
    relaunchAsAdmin: () => ipcRenderer.invoke("system:relaunch-as-admin"),
  },

  // Robot interception subsystem (sniffer + HTTP listener)
  robot: {
    getConfig: () => ipcRenderer.invoke("robot:get-config"),
    setConfig: (patch) => ipcRenderer.invoke("robot:set-config", patch),
    status: () => ipcRenderer.invoke("robot:status"),
    // Lists current TCP connections so the UI can offer a "Rechercher le port"
    // shortcut. Returns { ok, candidates: [{ process, remoteAddress, remotePort,
    // isLgo, isKnownRobotPort, score }], note? }.
    discoverPort: () => ipcRenderer.invoke("robot:discover-port"),
    // Passive live capture for 20s: asks the pharmacist to trigger a real sale,
    // then returns likely robot ports/IPs even when no TCP connection stays open.
    autoDetectPort: (durationMs) => ipcRenderer.invoke("robot:auto-detect-port", { durationMs }),
    // Lance, SUR CE PC, le diagnostic réseau dans une fenêtre PowerShell élevée :
    // trouve le port / l'IP / le sens de la liaison LGO↔robot et écrit un journal
    // sur le Bureau. À utiliser sur le PC serveur du robot.
    runServerDiagnostic: (seconds) => ipcRenderer.invoke("robot:run-server-diagnostic", { seconds }),
    // Shared secret used to authenticate cross-PC /trigger calls. Surfaced in
    // Paramètres so the pharmacist can copy it to other Asclion installs in
    // the same officine. Distinct from getConfig so this exposure is
    // explicit and easy to audit.
    getToken: () => ipcRenderer.invoke("robot:get-token"),
    // Paste a token received from the robot-server PC. Validates length +
    // charset before persisting and restarting the listener.
    setToken: (token) => ipcRenderer.invoke("robot:set-token", token),
    // Generate a fresh token. The pharmacist then re-copies it to all other
    // PCs in the officine.
    regenerateToken: () => ipcRenderer.invoke("robot:regenerate-token"),
  },

  // Manual update trigger — surfaced in Paramètres
  updater: {
    check: () => ipcRenderer.invoke("updater:check"),
  },

  // Direct HID scanner control (node-hid based, antivirus-friendly)
  scanner: {
    list: () => ipcRenderer.invoke("scanner:list"),
    status: () => ipcRenderer.invoke("scanner:status"),
    bind: (devicePath) => ipcRenderer.invoke("scanner:bind", devicePath),
    unbind: () => ipcRenderer.invoke("scanner:unbind"),
    testCapture: (ms) => ipcRenderer.invoke("scanner:test-capture", ms),
    // Test any device for N ms without binding — returns raw reports + decoded chars
    testDevice: (devicePath, ms) => ipcRenderer.invoke("scanner:test-device", { devicePath, ms }),
    // Enable/disable auto-bind to generic keyboard-class HID devices (opt-in)
    setAllowGeneric: (allow) => ipcRenderer.invoke("scanner:set-allow-generic", allow),
    reload: () => ipcRenderer.invoke("scanner:reload"),
    // WebHID: trigger navigator.hid.requestDevice() from the admin panel.
    // Main process executes it with userGesture:true so no click is required.
    requestWebHID: () => ipcRenderer.invoke("scanner:webhid-request"),
    // Clipboard scanner (opt-in fallback for scanners in "keyboard wedge" mode)
    clipboardStart: () => ipcRenderer.invoke("scanner:clipboard-start"),
    clipboardStop: () => ipcRenderer.invoke("scanner:clipboard-stop"),
    // Internal: called by the WEBHID_INIT_SCRIPT (injected by main via executeJavaScript)
    // to forward detected barcodes back to the main process scanner stack.
    _reportWebHIDBarcode: (raw) => ipcRenderer.invoke("scanner:webhid-barcode", raw),
    // Dev only (disabled in production builds): inject a barcode directly into
    // the scan pipeline without any hardware. Use from DevTools console:
    //   electronAPI.scanner.injectScan("3400936081349")
    injectScan: (code) => ipcRenderer.invoke("scanner:inject", { code }),
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// WebHID passive listener — runs in the preload context (renderer-side) and
// connects to HID POS barcode scanners (usage page 0x8C) without requiring any
// user interaction.
//
// HOW IT WORKS:
//   1. On load, call navigator.hid.getDevices() — returns devices the user has
//      already granted in a previous session.  No user gesture required.
//   2. Listen for navigator.hid 'connect' events so hot-plugged scanners are
//      picked up automatically.
//   3. When a report arrives, decode it and send to main via IPC.
//
// This path is completely antivirus-safe: it uses the browser's HID API, not a
// low-level keyboard hook.  Focus is irrelevant — HID reports arrive regardless
// of which window is active.
//
// LIMITATION: Only works when the scanner is in "HID POS" (usage page 0x8C) mode.
// Most cheap scanners ship in "USB Keyboard" mode by default.  The pharmacist
// must scan a configuration barcode from the manufacturer manual to switch modes.
// The admin panel shows per-brand instructions for common scanner models.
// ─────────────────────────────────────────────────────────────────────────────
(async function initWebHIDScanner() {
  if (typeof navigator === "undefined" || !navigator.hid) return;

  const HID_POS_PAGE = 0x8c;
  const MIN_LEN = 7;
  const RESET_MS = 800;
  let buf = "";
  let lastAt = 0;

  function flush(source) {
    const code = buf.trim();
    buf = "";
    if (code.length >= MIN_LEN) {
      ipcRenderer.invoke("scanner:webhid-barcode", code).catch(() => {});
    }
  }

  function onInputReport(ev) {
    const now = Date.now();
    if (now - lastAt > RESET_MS && buf.length > 0) buf = "";
    lastAt = now;

    const view = new DataView(ev.data.buffer);
    for (let i = 0; i < view.byteLength; i++) {
      const b = view.getUint8(i);
      if (b === 0) continue;
      if (b === 0x0d || b === 0x0a) {
        flush("crlf");
        return;
      }
      if (b > 0x1f && b < 0x7f) buf += String.fromCharCode(b);
    }
    // Auto-flush after inactivity (some HID POS devices send the full code in
    // one report with no explicit terminator)
    clearTimeout(onInputReport._timer);
    if (buf.length >= MIN_LEN) {
      onInputReport._timer = setTimeout(() => flush("timeout"), RESET_MS);
    }
  }

  async function openDevice(dev) {
    if (!dev.opened) {
      try {
        await dev.open();
      } catch (_) {
        return;
      }
    }
    dev.removeEventListener("inputreport", onInputReport);
    dev.addEventListener("inputreport", onInputReport);
  }

  function isPosScanner(dev) {
    return dev.collections && dev.collections.some((c) => c.usagePage === HID_POS_PAGE);
  }

  // 1. Open already-granted devices (persisted from previous sessions)
  try {
    const granted = await navigator.hid.getDevices();
    for (const d of granted) {
      if (isPosScanner(d)) await openDevice(d);
    }
  } catch (_) {}

  // 2. Hot-plug: automatically open new POS scanners when connected
  navigator.hid.addEventListener("connect", async ({ device }) => {
    if (isPosScanner(device)) await openDevice(device);
  });
  navigator.hid.addEventListener("disconnect", ({ device }) => {
    try {
      if (device.opened) device.close();
    } catch (_) {}
    buf = "";
  });
})();
