const { contextBridge } = require("electron");

// Expose a minimal API to the renderer
contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  platform: process.platform,
});
