/**
 * Builds the native N-API rawinput addon against the Electron ABI, Windows only.
 *
 * Invoked as `postinstall` of electron/package.json so that
 * `cd electron && npm install` produces a ready-to-run project.
 *
 * IMPORTANT — why node-gyp and not @electron/rebuild:
 *   @electron/rebuild walks `<module-dir>/node_modules` looking for native
 *   dependencies to rebuild. Our addon is a STANDALONE module living at
 *   native/rawinput (not inside any node_modules), so electron-rebuild silently
 *   rebuilt nothing and asclion_rawinput.node was never produced — the N-API
 *   Raw Input path (the preferred, focus-independent capture) was dead on every
 *   install. We invoke node-gyp directly against the Electron headers instead.
 *
 * On macOS/Linux this is a no-op (the addon is Windows-only).
 * On Windows, a build failure is FATAL in CI (process.env.CI) so we never ship
 * an EXE whose primary scanner path is missing; locally it only warns.
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
  log("non-Windows platform → skipping native addon build (addon is Windows-only)");
  process.exit(0);
}

const here = path.resolve(__dirname, "..");
const isCI = !!process.env.CI;

const electronVersion = (() => {
  try {
    const pkg = require(path.join(here, "package.json"));
    return (pkg.devDependencies?.electron || "33.3.1").replace(/^[^0-9]+/, "");
  } catch {
    return "33.3.1";
  }
})();

const moduleDir = path.join(here, "native", "rawinput");
const outFile = path.join(moduleDir, "build", "Release", "asclion_rawinput.node");

function fail(msg) {
  log(`ERROR: ${msg}`);
  if (isCI) {
    log(
      "Refusing to continue in CI: the N-API Raw Input capture is the PRIMARY " +
        "focus-independent scanner path. Shipping without it produces an EXE that " +
        "cannot read douchette scans while the LGO is focused. Fix the build " +
        "toolchain (VS Build Tools + Python 3.11) and retry.",
    );
    process.exit(1);
  }
  log("Continuing (local dev): runtime will fall back to PowerShell / uiohook / node-hid.");
  process.exit(0);
}

if (!fs.existsSync(moduleDir)) {
  fail(`native module dir not found: ${moduleDir}`);
}

// Resolve node-gyp's JS entrypoint from the hoisted electron/node_modules and run
// it via `node` directly — avoids the Windows .cmd-spawn restriction (Node 20+
// refuses to spawn .cmd/.bat without shell:true) and is robust to spaces in paths.
let nodeGypJs;
try {
  nodeGypJs = require.resolve("node-gyp/bin/node-gyp.js", { paths: [here, __dirname] });
} catch (e) {
  fail(`cannot resolve node-gyp (is it installed?): ${e && e.message}`);
}

log(`building asclion_rawinput against Electron ${electronVersion} (x64)…`);

const res = spawnSync(
  process.execPath,
  [
    nodeGypJs,
    "rebuild",
    `--target=${electronVersion}`,
    "--arch=x64",
    "--dist-url=https://electronjs.org/headers",
  ],
  { cwd: moduleDir, stdio: "inherit", env: process.env },
);

if (res.error) {
  fail(`could not spawn node-gyp: ${res.error.message}`);
}
if (res.status !== 0) {
  fail(`node-gyp exited with code ${res.status}`);
}
if (!fs.existsSync(outFile)) {
  fail(`node-gyp reported success but output is missing: ${outFile}`);
}

log(`OK: built ${path.relative(here, outFile)}`);
