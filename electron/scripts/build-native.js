/**
 * Builds the native N-API rawinput addon against the Electron Node ABI,
 * on Windows only.
 *
 * Invoked automatically as `postinstall` of electron/package.json so that
 * `cd electron && npm install` produces a ready-to-run project.
 *
 * On macOS/Linux this is a silent no-op: the addon is Windows-only.
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[asclion-native] ${msg}`);
}

if (process.platform !== "win32") {
  log("non-Windows platform → skipping native addon build (degrades to fallback paths)");
  process.exit(0);
}

const here = path.resolve(__dirname, "..");
const electronVersion = (() => {
  try {
    const pkg = require(path.join(here, "package.json"));
    return pkg.devDependencies?.electron?.replace(/^[^0-9]+/, "") || "33.3.1";
  } catch {
    return "33.3.1";
  }
})();

const modules = [
  path.join(here, "native", "rawinput"),
];

for (const mod of modules) {
  if (!fs.existsSync(mod)) {
    log(`skip: ${mod} not present`);
    continue;
  }
  log(`building ${path.basename(mod)} against Electron ${electronVersion}...`);

  // Use @electron/rebuild to compile against the right ABI/headers.
  const rebuildBin = path.join(here, "node_modules", ".bin",
    process.platform === "win32" ? "electron-rebuild.cmd" : "electron-rebuild");

  const args = [
    "--version", electronVersion,
    "--module-dir", mod,
    "--force",
  ];

  const res = spawnSync(rebuildBin, args, { stdio: "inherit", cwd: mod });
  if (res.status !== 0) {
    log(`WARN: ${path.basename(mod)} build failed (exit ${res.status}). ` +
        `The addon will be unavailable at runtime; Asclion will fall back to ` +
        `the PowerShell / uiohook / node-hid paths.`);
    // Do NOT fail the install — fallback paths cover the case.
  } else {
    log(`OK: ${path.basename(mod)} built`);
  }
}
