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

  // Picture-in-Picture (always-on-top + compact mode)
  pip: {
    getState: () => ipcRenderer.invoke("pip:get-state"),
    toggle: () => ipcRenderer.invoke("pip:toggle"),
    setCompact: (compact) => ipcRenderer.invoke("pip:set-compact", compact),
  },
});
