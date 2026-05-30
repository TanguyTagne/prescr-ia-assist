/**
 * JS wrapper for the native UI Automation watcher.
 *
 * Loads LGO field selectors from electron/lgo-mappings.json and starts polling
 * via the C++ addon.  Resolves to a no-op on non-Windows or when the .node
 * binary failed to build.
 */
"use strict";

const path = require("path");
const fs   = require("fs");

let addon = null;
let loadError = null;

if (process.platform === "win32") {
  try {
    addon = require("./build/Release/asclion_uiawatcher.node");
  } catch (e) {
    loadError = e && e.message;
  }
}

function loadDefaultMappings() {
  try {
    const p = path.join(__dirname, "..", "..", "lgo-mappings.json");
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf-8");
    const json = JSON.parse(raw);
    if (!Array.isArray(json)) return [];
    return json.filter((s) => s && s.processName);
  } catch (e) {
    return [];
  }
}

module.exports = {
  available: !!addon,
  loadError,
  /**
   * @param {(payload: {lgoId: string, barcode: string}) => void} onBarcode
   * @param {Array<object>} [selectors] - if omitted, loaded from lgo-mappings.json
   * @returns {boolean}
   */
  start(onBarcode, selectors) {
    if (!addon) return false;
    const sel = Array.isArray(selectors) && selectors.length > 0
      ? selectors
      : loadDefaultMappings();
    if (sel.length === 0) {
      loadError = "no LGO selectors configured (electron/lgo-mappings.json is empty)";
      return false;
    }
    try { return addon.start(sel, onBarcode); }
    catch (e) { loadError = e && e.message; return false; }
  },
  stop()       { if (addon) try { addon.stop(); } catch (_) {} },
  isRunning()  { return addon ? !!addon.isRunning() : false; },
  fieldCount() { return addon ? Number(addon.fieldCount()) : 0; },
  loadDefaultMappings,
};
