/**
 * fetch-windivert.js — download the official WinDivert binaries into
 * electron/native/windivert/ so the WinDivert capture backend can run.
 *
 *   cd electron && npm run fetch:windivert
 *
 * Pulls the signed x64 release from the official GitHub release, extracts it to
 * a temp folder, and copies WinDivert.dll + WinDivert64.sys next to
 * windivert-capture.ps1. Windows-only (the .sys is a Windows kernel driver).
 *
 * These two files are intentionally git-ignored (large signed binaries). Run
 * this once after cloning, and wire it into CI before electron-builder so the
 * packaged app ships them under app.asar.unpacked/native/windivert/.
 *
 * Override the release with WINDIVERT_URL if the default ever 404s:
 *   $env:WINDIVERT_URL="https://.../WinDivert-X.Y.Z-A.zip"; npm run fetch:windivert
 *
 * WinDivert is LGPLv3 / GPLv3 (https://reqrypt.org/windivert.html). Shipping
 * the DLL as a separate, replaceable file keeps Asclion LGPL-compliant without
 * open-sourcing app code. Keep the attribution in the app's About/Legal screen.
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

function log(m) {
  // eslint-disable-next-line no-console
  console.log(`[fetch-windivert] ${m}`);
}

if (process.platform !== "win32") {
  log("non-Windows platform → skipping (WinDivert is Windows-only).");
  process.exit(0);
}

const DEST_DIR = path.resolve(__dirname, "..", "native", "windivert");
const URL =
  process.env.WINDIVERT_URL ||
  "https://github.com/basil00/WinDivert/releases/download/v2.2.2/WinDivert-2.2.2-A.zip";

const dll = path.join(DEST_DIR, "WinDivert.dll");
const sys = path.join(DEST_DIR, "WinDivert64.sys");
if (fs.existsSync(dll) && fs.existsSync(sys)) {
  log(`already present in ${DEST_DIR} — nothing to do.`);
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "windivert-"));
const zip = path.join(tmp, "windivert.zip");

// PowerShell does the download + unzip (no npm deps needed). Then we search the
// extracted tree for the x64 binaries rather than hard-coding the inner layout,
// so a different release structure still works.
const ps = [
  "$ErrorActionPreference='Stop';",
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;",
  `Invoke-WebRequest -Uri '${URL}' -OutFile '${zip}';`,
  `Expand-Archive -Path '${zip}' -DestinationPath '${tmp}' -Force;`,
  // Prefer an explicit x64 folder; fall back to any matching file found.
  `$dll=Get-ChildItem -Path '${tmp}' -Recurse -Filter 'WinDivert.dll' | Where-Object { $_.FullName -match 'x64|amd64|64' } | Select-Object -First 1;`,
  `if(-not $dll){ $dll=Get-ChildItem -Path '${tmp}' -Recurse -Filter 'WinDivert.dll' | Select-Object -First 1 }`,
  `$sys=Get-ChildItem -Path '${tmp}' -Recurse -Filter 'WinDivert64.sys' | Select-Object -First 1;`,
  "if(-not $dll){ Write-Error 'WinDivert.dll not found in archive' };",
  "if(-not $sys){ Write-Error 'WinDivert64.sys not found in archive' };",
  `Copy-Item $dll.FullName '${dll}' -Force;`,
  `Copy-Item $sys.FullName '${sys}' -Force;`,
  "Write-Output 'OK';",
].join(" ");

log(`downloading ${URL} …`);
const res = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
  { stdio: "inherit" },
);

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }

if (res.status !== 0) {
  log("FAILED. Download manually from https://reqrypt.org/windivert.html");
  log(`and place WinDivert.dll + WinDivert64.sys (x64) into:\n  ${DEST_DIR}`);
  process.exit(1);
}

if (!fs.existsSync(dll) || !fs.existsSync(sys)) {
  log(`ERROR: expected files missing after extract in ${DEST_DIR}`);
  process.exit(1);
}
log(`OK: WinDivert.dll + WinDivert64.sys ready in ${DEST_DIR}`);
