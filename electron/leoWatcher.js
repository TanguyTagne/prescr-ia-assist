// ─────────────────────────────────────────────────────────────────────────────
// Leo (Astera / Leo 2.0) robot dispense watcher.
//
// Tails LeoAutomateCommunicationLog.txt and emits a CIP13 every time the LGO
// log records an OutputMessage with Status="Completed" + an ArticleId.
//
// Zero external deps (fs + path), zero network. The pharmacist just launches
// Asclion and dispenses normally — each robot drop is forwarded to the
// renderer through the `robot-dispensed` IPC channel.
//
// Config: `asclion.config.json` (next to the exe, fallback userData).
//   { "leoLogPath": "C:\\ProgramData\\Astera\\Leo2.0\\Logs\\ServiceWindows\\LeoAutomateCommunicationLog.txt" }
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

const DEFAULT_LEO_LOG_PATH =
  "C:\\ProgramData\\Astera\\Leo2.0\\Logs\\ServiceWindows\\LeoAutomateCommunicationLog.txt";

const CONFIG_FILENAME = "asclion.config.json";

// Detect "Completed OutputMessage with ArticleId" on a single line.
// Lines that don't contain "Completed" are skipped before we run the regex.
const ARTICLE_ID_RE = /ArticleId="(\d+)"/i;
const OUTPUT_MESSAGE_ID_RE = /OutputMessage\s+[^>]*\bId="(\d+)"/i;
const COMPLETED_HINT = "Completed";
const OUTPUT_HINT = "OutputMessage";
const OUTPUT_REQUEST_HINT = "OutputRequest";
const KEEPALIVE_REQUEST_RE = /KeepAliveRequest[^>]*\bSource="(\d+)"/gi;

// Size of the circular line buffer used to retrieve the matching OutputRequest
// (and therefore its WWKS2 Source = till id) when an OutputMessage Completed
// arrives a few lines later.
const RING_BUFFER_SIZE = 100;

// Dedup window — the Leo service occasionally writes the same Completed line
// twice (retry / mirrored log). Without dedup the renderer would re-analyze.
const DEDUP_MS = 1500;

function resolveConfigPaths(app) {
  const out = [];
  try {
    if (app) {
      out.push(path.join(path.dirname(app.getPath("exe")), CONFIG_FILENAME));
      out.push(path.join(app.getPath("userData"), CONFIG_FILENAME));
    }
  } catch {}
  try {
    out.push(path.join(process.cwd(), CONFIG_FILENAME));
  } catch {}
  return out;
}

function readConfig(app) {
  for (const p of resolveConfigPaths(app)) {
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return { config: parsed, path: p };
    } catch {
      /* missing/invalid → try next candidate */
    }
  }
  return { config: {}, path: null };
}

function resolveLeoLogPath(app) {
  const { config } = readConfig(app);
  const v = config && typeof config.leoLogPath === "string" && config.leoLogPath.trim();
  return v || DEFAULT_LEO_LOG_PATH;
}

/**
 * Start tailing the Leo log file. Returns a stop() function.
 *
 * @param {object} opts
 * @param {string} opts.filePath        Absolute path to the Leo log file.
 * @param {(cip: string) => void} opts.onDispense  Called for each Completed ArticleId.
 * @param {(msg: string) => void} [opts.log]       Optional debug logger.
 */
function startLeoWatcher({ filePath, onDispense, log }) {
  if (!filePath || typeof onDispense !== "function") {
    throw new Error("startLeoWatcher: filePath and onDispense are required");
  }
  const dbg = typeof log === "function" ? log : () => {};

  let offset = 0;
  let pending = ""; // buffer for partial trailing line
  let reading = false;
  let pendingRead = false;
  let watcher = null;
  let pollTimer = null;
  let stopped = false;
  const lastEmit = new Map(); // cip → ts

  // Circular buffer of the most recent N parsed lines, used to look up the
  // OutputRequest (with its Source attribute = WWKS2 till id) when a matching
  // OutputMessage Completed arrives.
  const ring = new Array(RING_BUFFER_SIZE);
  let ringIdx = 0;
  function pushRing(line) {
    ring[ringIdx] = line;
    ringIdx = (ringIdx + 1) % RING_BUFFER_SIZE;
  }
  function findSourceForMessageId(id) {
    if (!id) return null;
    const re = new RegExp(
      `${OUTPUT_REQUEST_HINT}[^>]*\\bId="${id}"[^>]*\\bSource="(\\d+)"|` +
      `${OUTPUT_REQUEST_HINT}[^>]*\\bSource="(\\d+)"[^>]*\\bId="${id}"`,
      "i",
    );
    // Walk newest → oldest.
    for (let i = 0; i < RING_BUFFER_SIZE; i++) {
      const idx = (ringIdx - 1 - i + RING_BUFFER_SIZE) % RING_BUFFER_SIZE;
      const l = ring[idx];
      if (!l) continue;
      if (l.indexOf(OUTPUT_REQUEST_HINT) === -1) continue;
      const m = l.match(re);
      if (m) {
        const v = m[1] || m[2];
        if (v) return Number(v);
      }
    }
    return null;
  }

  function emit(payload) {
    const { cip } = payload;
    const now = Date.now();
    const prev = lastEmit.get(cip);
    if (prev && now - prev < DEDUP_MS) {
      dbg(`[LEO] dedup cip=${cip}`);
      return;
    }
    lastEmit.set(cip, now);
    // Cheap GC on the dedup map.
    if (lastEmit.size > 500) {
      for (const [k, ts] of lastEmit) if (now - ts > 60_000) lastEmit.delete(k);
    }
    dbg(`[LEO] dispense cip=${cip} wwks2Source=${payload.wwks2SourceId ?? "?"}`);
    try { onDispense(payload); } catch (e) { dbg(`[LEO] onDispense threw: ${e && e.message}`); }
  }

  function processLine(line) {
    if (!line) return;
    pushRing(line);
    if (line.indexOf(COMPLETED_HINT) === -1) return;
    if (line.indexOf(OUTPUT_HINT) === -1) return;
    const m = line.match(ARTICLE_ID_RE);
    if (!m) return;
    const cip = m[1];
    if (!cip) return;
    const idMatch = line.match(OUTPUT_MESSAGE_ID_RE);
    const messageId = idMatch ? idMatch[1] : null;
    const wwks2SourceId = findSourceForMessageId(messageId);
    emit({ cip, wwks2SourceId, messageId });
  }

  function processChunk(chunk) {
    const text = pending + chunk;
    const lines = text.split(/\r?\n/);
    pending = lines.pop() || ""; // last partial line stays buffered
    for (const line of lines) processLine(line);
  }

  function readNew() {
    if (stopped) return;
    if (reading) { pendingRead = true; return; }
    reading = true;
    fs.stat(filePath, (err, st) => {
      if (stopped) { reading = false; return; }
      if (err) {
        // File doesn't exist yet — keep polling, it may appear later.
        reading = false;
        if (pendingRead) { pendingRead = false; setImmediate(readNew); }
        return;
      }
      // Detect truncation / rotation: file shrank → restart from 0.
      if (st.size < offset) {
        dbg(`[LEO] rotation detected (size=${st.size} < offset=${offset}) — restarting`);
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
            catch (e) { dbg(`[LEO] processChunk failed: ${e && e.message}`); }
          }
          reading = false;
          if (pendingRead) { pendingRead = false; setImmediate(readNew); }
        });
      });
    });
  }

  function primeOffset(cb) {
    fs.stat(filePath, (err, st) => {
      offset = err ? 0 : st.size; // start at EOF — we only react to NEW lines
      dbg(`[LEO] watching "${filePath}" from offset=${offset}`);
      cb && cb();
    });
  }

  function attachWatcher() {
    try { watcher && watcher.close(); } catch {}
    watcher = null;
    try {
      // Watch the directory rather than the file: fs.watch on a file that gets
      // rotated/recreated stops firing on Windows. Directory watch survives
      // rename/replace cycles common in Windows service log rotation.
      const dir = path.dirname(filePath);
      const base = path.basename(filePath);
      watcher = fs.watch(dir, { persistent: false }, (_event, fn) => {
        if (!fn || fn === base) readNew();
      });
      watcher.on("error", (e) => dbg(`[LEO] watcher error: ${e && e.message}`));
    } catch (e) {
      dbg(`[LEO] fs.watch failed (${e && e.message}) — falling back to polling only`);
    }
  }

  primeOffset(() => {
    if (stopped) return;
    attachWatcher();
    // Belt-and-suspenders polling — some filesystems / network shares don't
    // fire fs.watch events reliably.
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

// ─────────────────────────────────────────────────────────────────────────────
// Config helpers shared with main.js (asclion.config.json under userData).
// ─────────────────────────────────────────────────────────────────────────────
function configPath(app) {
  // Always write to userData — exe directory may be read-only on Windows.
  return path.join(app.getPath("userData"), CONFIG_FILENAME);
}

function getConfig(app) {
  return readConfig(app).config || {};
}

function setConfigValues(app, patch) {
  const current = readConfig(app).config || {};
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

/**
 * Synchronously read the last N lines of the Leo log (best-effort, never throws).
 * Used by the WWKS2 detection wizard to spot the most frequent KeepAliveRequest Source.
 */
function readLogTail(filePath, maxLines = 50) {
  try {
    const st = fs.statSync(filePath);
    // Read up to last 256 KiB — enough for ~thousands of short XML lines.
    const chunk = Math.min(st.size, 256 * 1024);
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.allocUnsafe(chunk);
    fs.readSync(fd, buf, 0, chunk, Math.max(0, st.size - chunk));
    fs.closeSync(fd);
    const lines = buf.toString("utf-8").split(/\r?\n/);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function detectSourceFromKeepAlive(filePath) {
  const lines = readLogTail(filePath, 200);
  if (!lines.length) return null;
  const counts = new Map();
  for (const l of lines) {
    if (l.indexOf("KeepAlive") === -1) continue;
    let m;
    KEEPALIVE_REQUEST_RE.lastIndex = 0;
    while ((m = KEEPALIVE_REQUEST_RE.exec(l)) !== null) {
      const v = Number(m[1]);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
  }
  if (!counts.size) return null;
  let best = null;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return best;
}

module.exports = {
  DEFAULT_LEO_LOG_PATH,
  CONFIG_FILENAME,
  resolveLeoLogPath,
  startLeoWatcher,
  readConfig,
  getConfig,
  setConfigValues,
  configPath,
  readLogTail,
  detectSourceFromKeepAlive,
};
