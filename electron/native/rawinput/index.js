/**
 * JS wrapper for the native Raw Input capture addon.
 *
 * Resolves to a no-op object on non-Windows platforms or when the .node binary
 * was not built (CI, dev macOS, etc.).  Callers should always test the
 * `available` boolean before calling start().
 */
"use strict";

let addon = null;
let loadError = null;

if (process.platform === "win32") {
  try {
    addon = require("./build/Release/asclion_rawinput.node");
  } catch (e) {
    loadError = e && e.message;
  }
}

module.exports = {
  available: !!addon,
  loadError,
  /**
   * @param {(barcodeBuffer: string) => void} onBarcode
   * @returns {boolean} true if the capture started, false otherwise
   */
  start(onBarcode) {
    if (!addon) return false;
    try {
      return addon.start(onBarcode);
    } catch (e) {
      loadError = e && e.message;
      return false;
    }
  },
  stop() {
    if (!addon) return;
    try { addon.stop(); } catch (_) { /* noop */ }
  },
  isRunning() {
    if (!addon) return false;
    try { return addon.isRunning(); } catch (_) { return false; }
  },
};
