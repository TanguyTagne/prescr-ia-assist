const { contextBridge, ipcRenderer } = require("electron");

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
});
