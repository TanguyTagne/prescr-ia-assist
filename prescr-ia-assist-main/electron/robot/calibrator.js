// Robot calibration subsystem.
//
// Détecte COMMENT le LGO communique avec le robot automate sur CE PC, sans
// rien supposer a priori (TCP, RS232/COM, named pipe, fichier…).
//
// Deux phases :
//   1. Snapshot  (robot:calibrate-snapshot)
//        Lit d'un coup : processus LGO, ports COM occupés, connexions TCP,
//        named pipes, fichiers récemment modifiés dans le répertoire d'install.
//        Retourne un objet JSON au renderer.
//
//   2. Capture   (robot:calibrate-start / robot:calibrate-stop)
//        Lance un FileSystemWatcher sur le répertoire d'install du LGO pendant
//        N secondes. Dès qu'un fichier change, l'événement est streamé en temps
//        réel vers le renderer via win.webContents.send("robot:calibrate-event").
//        Arrêt propre via robot:calibrate-stop ou à l'expiration du timeout.
//
// Ces handlers sont enregistrés dans main.js via calibrator.registerHandlers(ipcMain, getWin).
// getWin() doit retourner la BrowserWindow principale (pour send()).

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Résout le chemin des scripts PS même dans un build empaqueté (asar.unpacked).
function diagDir() {
  return path
    .join(__dirname, "..", "native", "diag")
    .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}

function scriptPath(name) {
  return path.join(diagDir(), name);
}

// Lance un script PS et retourne { ok, data } ou { ok: false, error }.
// stdout est attendu comme une unique ligne JSON (ou vide).
function runPsScript(scriptFile, args, timeoutMs) {
  return new Promise((resolve) => {
    const script = scriptPath(scriptFile);
    if (!fs.existsSync(script)) {
      resolve({ ok: false, error: `Script introuvable : ${script}` });
      return;
    }

    const psArgs = [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", script,
      ...(args || []),
    ];

    let child;
    try {
      child = spawn("powershell.exe", psArgs, { windowsHide: true });
    } catch (e) {
      resolve({ ok: false, error: `spawn: ${e && e.message}` });
      return;
    }

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* noop */ }
      resolve({ ok: false, error: "timeout" });
    }, timeoutMs || 30_000);

    child.stdout.on("data", (d) => { stdout += d.toString("utf-8"); });
    child.stderr.on("data", (d) => { stderr += d.toString("utf-8"); });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `powershell: ${err && err.message}` });
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const line = stdout.trim().split("\n").filter(Boolean).pop() || "";
        if (!line) {
          resolve({ ok: false, error: stderr.trim() || "Aucune sortie du script" });
          return;
        }
        const data = JSON.parse(line);
        resolve({ ok: true, data });
      } catch (e) {
        resolve({ ok: false, error: `JSON parse: ${e && e.message} — stdout: ${stdout.slice(0, 300)}` });
      }
    });
  });
}

// État interne de la capture en cours
let captureProc = null;

function stopCapture() {
  if (captureProc) {
    try { captureProc.kill(); } catch { /* noop */ }
    captureProc = null;
  }
}

// Lance lgo-capture.ps1 en mode stream : chaque ligne JSON est émise vers
// le renderer via win.webContents.send("robot:calibrate-event", payload).
function startCapture({ watchDir, duration, getWin }) {
  stopCapture(); // idempotent

  const script = scriptPath("lgo-capture.ps1");
  if (!fs.existsSync(script)) {
    return { ok: false, error: `Script introuvable : ${script}` };
  }

  const dur = Math.min(Math.max(Number(duration) || 35, 10), 120);
  const psArgs = [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", script,
    "-Duration", String(dur),
  ];
  if (watchDir) psArgs.push("-WatchDir", String(watchDir));

  let child;
  try {
    child = spawn("powershell.exe", psArgs, { windowsHide: true });
  } catch (e) {
    return { ok: false, error: `spawn: ${e && e.message}` };
  }

  captureProc = child;

  let buf = "";
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString("utf-8");
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;

      let payload;
      if (line === "READY") {
        payload = { type: "ready" };
      } else {
        try {
          const obj = JSON.parse(line);
          payload = { type: obj.event || "change", ...obj };
        } catch {
          continue; // ignorer les lignes non-JSON
        }
      }

      const win = getWin && getWin();
      if (win && !win.isDestroyed()) {
        try { win.webContents.send("robot:calibrate-event", payload); } catch { /* noop */ }
      }
    }
  });

  child.stderr.on("data", (d) => {
    const msg = d.toString("utf-8").trim();
    if (!msg) return;
    const win = getWin && getWin();
    if (win && !win.isDestroyed()) {
      try { win.webContents.send("robot:calibrate-event", { type: "error", message: msg }); } catch { /* noop */ }
    }
  });

  child.on("close", () => {
    if (captureProc === child) captureProc = null;
  });

  return { ok: true };
}

// Enregistre les handlers IPC dans main.js
function registerHandlers(ipcMain, getWin) {
  // Snapshot : liste toutes les ressources du LGO sur ce PC
  ipcMain.handle("robot:calibrate-snapshot", async () => {
    if (process.platform !== "win32") return { ok: false, error: "Windows uniquement" };
    const result = await runPsScript("lgo-process-diagnostic.ps1", [], 25_000);
    return result;
  });

  // Démarrage de la capture en temps réel
  ipcMain.handle("robot:calibrate-start", (_e, { watchDir, duration } = {}) => {
    if (process.platform !== "win32") return { ok: false, error: "Windows uniquement" };
    return startCapture({ watchDir, duration, getWin });
  });

  // Arrêt propre de la capture
  ipcMain.handle("robot:calibrate-stop", () => {
    stopCapture();
    return { ok: true };
  });
}

module.exports = { registerHandlers };
