// ─────────────────────────────────────────────────────────────────────────────
// Architecture validée le 29/06/2026 :
// Chaque caisse Léo écrit son CIP13 dans son propre LeoClientAppLog.txt
// via la ligne "SerialisationHelper.VerifyAsync:0XXXXXXXXXXXXX-..."
// → routing 100% local, pas de réseau, pas de Supabase pour le robot.
// → fonctionne pour tous types de médicaments (RX, OTC, génériques).
//
// Ce module tail le log LOCAL de la caisse (LeoClientAppLog.txt) et émet
// `robot-dispensed` { cip13, source:'lgo_robot', timestamp } à chaque
// délivrance détectée. Zéro dépendance externe, Node natif (fs+path).
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

const DEFAULT_LEO_CLIENT_LOG_PATH =
  "C:\\ProgramData\\Astera\\Leo2.0\\Logs\\Client\\LeoClientAppLog.txt";

const CONFIG_FILENAME = "asclion.config.json";

// Extrait le CIP13 dans une ligne du log Léo client. Le préfixe "0" devant les
// 13 chiffres correspond à l'octet de remplissage GS1 (data-matrix robot).
const CIP13_RE = /SerialisationHelper\.VerifyAsync:0(\d{13})-/;
const CIP13_HINT = "SerialisationHelper.VerifyAsync";

// Fenêtre de déduplication : Léo écrit Request + Response pour le même CIP13
// à quelques ms d'intervalle. 3s couvre largement, sans bloquer les vrais
// re-scans manuels (qui sont espacés de >>3s en pratique).
const DEDUP_MS = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Config (asclion.config.json sous userData)
// ─────────────────────────────────────────────────────────────────────────────
function configPath(app) {
  return path.join(app.getPath("userData"), CONFIG_FILENAME);
}

function readConfigFile(app) {
  try {
    const raw = fs.readFileSync(configPath(app), "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* missing/invalid */ }
  return {};
}

function getConfig(app) {
  return readConfigFile(app);
}

function setConfigValues(app, patch) {
  const current = readConfigFile(app);
  const next = { ...current, ...(patch || {}) };
  const p = configPath(app);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(next, null, 2), "utf-8");
  } catch (e) {
    return { ok: false, error: e && e.message, config: current, path: p };
  }
  return { ok: true, config: next, path: p };
}

function resolveLeoClientLogPath(app) {
  const cfg = readConfigFile(app);
  const v = typeof cfg.leoClientLogPath === "string" && cfg.leoClientLogPath.trim();
  return v || DEFAULT_LEO_CLIENT_LOG_PATH;
}

function checkClientLog(filePath) {
  try {
    const st = fs.statSync(filePath);
    return { exists: true, path: filePath, lastModified: st.mtime, size: st.size };
  } catch {
    return { exists: false, path: filePath, lastModified: null, size: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Watcher (tail) — démarre au lancement d'Asclion, mode dégradé si le fichier
// n'existe pas (re-tente périodiquement, ne crashe jamais).
// ─────────────────────────────────────────────────────────────────────────────
function startLeoClientWatcher({ filePath, onDispense, log }) {
  if (!filePath || typeof onDispense !== "function") {
    throw new Error("startLeoClientWatcher: filePath and onDispense are required");
  }
  const dbg = typeof log === "function" ? log : () => {};

  let offset = 0;
  let pending = "";
  let reading = false;
  let pendingRead = false;
  let watcher = null;
  let pollTimer = null;
  let stopped = false;
  const lastEmit = new Map(); // cip13 → ts

  function emit(cip13) {
    const now = Date.now();
    const prev = lastEmit.get(cip13);
    if (prev && now - prev < DEDUP_MS) {
      dbg(`[LEO-CLIENT-WATCHER] dedup CIP13=${cip13}`);
      return;
    }
    lastEmit.set(cip13, now);
    if (lastEmit.size > 500) {
      for (const [k, ts] of lastEmit) if (now - ts > 60_000) lastEmit.delete(k);
    }
    dbg(`[LEO-CLIENT-WATCHER] CIP13 détecté : ${cip13}`);
    try { onDispense({ cip13, source: "lgo_robot", timestamp: now }); }
    catch (e) { dbg(`[LEO-CLIENT-WATCHER] onDispense threw: ${e && e.message}`); }
  }

  function processLine(line) {
    if (!line || line.indexOf(CIP13_HINT) === -1) return;
    const m = line.match(CIP13_RE);
    if (m && m[1]) emit(m[1]);
  }

  function processChunk(chunk) {
    const text = pending + chunk;
    const lines = text.split(/\r?\n/);
    pending = lines.pop() || "";
    for (const line of lines) processLine(line);
  }

  function readNew() {
    if (stopped) return;
    if (reading) { pendingRead = true; return; }
    reading = true;
    fs.stat(filePath, (err, st) => {
      if (stopped) { reading = false; return; }
      if (err) {
        reading = false;
        if (pendingRead) { pendingRead = false; setImmediate(readNew); }
        return;
      }
      if (st.size < offset) {
        dbg(`[LEO-CLIENT-WATCHER] rotation (size=${st.size} < offset=${offset}) — restart`);
        offset = 0;
        pending = "";
      }
      if (st.size === offset) {
        reading = false;
        if (pendingRead) { pendingRead = false; setImmediate(readNew); }
        return;
      }
      fs.open(filePath, "r", (err2, fd) => {
        if (err2) {
          reading = false;
          if (pendingRead) { pendingRead = false; setImmediate(readNew); }
          return;
        }
        const len = st.size - offset;
        const buf = Buffer.allocUnsafe(len);
        fs.read(fd, buf, 0, len, offset, (err3, bytesRead) => {
          fs.close(fd, () => {});
          if (!err3 && bytesRead > 0) {
            offset += bytesRead;
            try { processChunk(buf.slice(0, bytesRead).toString("utf-8")); }
            catch (e) { dbg(`[LEO-CLIENT-WATCHER] processChunk failed: ${e && e.message}`); }
          }
          reading = false;
          if (pendingRead) { pendingRead = false; setImmediate(readNew); }
        });
      });
    });
  }

  function attachWatcher() {
    try { watcher && watcher.close(); } catch {}
    watcher = null;
    try {
      const dir = path.dirname(filePath);
      const base = path.basename(filePath);
      // Si le dossier n'existe pas encore on retombe sur le polling pur.
      if (!fs.existsSync(dir)) return;
      watcher = fs.watch(dir, { persistent: false }, (_event, fn) => {
        if (!fn || fn === base) readNew();
      });
      watcher.on("error", (e) => dbg(`[LEO-CLIENT-WATCHER] watcher error: ${e && e.message}`));
    } catch (e) {
      dbg(`[LEO-CLIENT-WATCHER] fs.watch failed (${e && e.message}) — polling only`);
    }
  }

  fs.stat(filePath, (err, st) => {
    offset = err ? 0 : st.size; // commence à EOF — on ne réagit qu'aux NOUVELLES lignes
    dbg(`[LEO-CLIENT-WATCHER] watching "${filePath}" from offset=${offset}`);
    if (stopped) return;
    attachWatcher();
    pollTimer = setInterval(readNew, 1500);
  });

  return function stop() {
    stopped = true;
    try { watcher && watcher.close(); } catch {}
    watcher = null;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };
}

module.exports = {
  DEFAULT_LEO_CLIENT_LOG_PATH,
  CONFIG_FILENAME,
  resolveLeoClientLogPath,
  startLeoClientWatcher,
  getConfig,
  setConfigValues,
  configPath,
  checkClientLog,
};
