// ─────────────────────────────────────────────────────────────────────────────
// LGO communication-log watcher
//
// Tails the LGO's OWN dispense/communication log (LEO writes
//   C:\ProgramData\Astera\Leo2.0\Logs\ServiceWindows\LeoAutomateCommunicationLog.txt
// ) and extracts the CIP of every dispensed pack from lines containing
//   ArticleId="3400xxxxxxxxx"
// Each code is handed to the SAME pipeline as a scan / sniffer hit
// (main.js → emitGlobalScan), so the conseil fires with zero pharmacist action.
//
// Why this beats packet capture: a log line is written by the LGO AFTER it has
// decrypted/parsed the robot exchange, so it is in clear text and identical
// whatever the transport (TCP WWKS2, serial COM, or an IPv6 back-office server).
// No driver, no admin, no Npcap/WinDivert, no TLS problem.
//
// HARD CONSTRAINTS
//   - 100% passive & read-only. We only READ a file the LGO already writes; we
//     never open the robot link, never write, never hold an exclusive lock.
//   - Must NEVER crash the app. Every fs call is guarded. A missing, locked or
//     unreadable file simply means "no dispense seen yet", never a thrown error.
//   - No history replay. On start we record the current file size as the offset
//     and only parse bytes appended AFTER launch.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");

// Default location of the LEO automate communication log. Overridable per-site
// via config (robot.leoLogPath) for other LGOs / non-standard installs.
const DEFAULT_LEO_LOG_PATH =
  "C:\\ProgramData\\Astera\\Leo2.0\\Logs\\ServiceWindows\\LeoAutomateCommunicationLog.txt";

// CIP/EAN inside a WWKS2 frame: ArticleId="3400930001234". 7–14 digits covers
// CIP7 / CIP13 / EAN13; the downstream pipeline normalises. Global flag: one log
// write can carry several packs (multi-line order).
const ARTICLE_ID_RE = /ArticleId="(\d{7,14})"/g;

// Never read more than this in one pass (guards against a pathological backlog
// after a truncation/rotation — we only ever care about the most recent slice).
const MAX_READ_BYTES = 5 * 1024 * 1024;
const TAIL_SLICE_BYTES = 1 * 1024 * 1024;

function createLgoLogWatcher({ log = () => {}, warn = () => {}, onDispense } = {}) {
  let logPath = null;
  let offset = 0;          // bytes already consumed
  let carry = "";          // partial trailing line carried between reads
  let fileWatcher = null;  // fs.FSWatcher (efficient, on the file itself)
  let polling = false;     // true while fs.watchFile waits for the file to appear
  let reading = false;     // re-entrancy guard
  let pendingReread = false;
  let started = false;

  function safeSize(p) {
    try {
      return fs.statSync(p).size;
    } catch {
      return null; // missing / locked / unreadable
    }
  }

  // Read everything appended since `offset`, parse complete lines, emit CIPs.
  // Fully synchronous and fully guarded: it can fail silently but never throw.
  function drain() {
    if (!logPath) return;
    if (reading) {
      pendingReread = true;
      return;
    }

    const size = safeSize(logPath);
    if (size === null) return;            // vanished — wait for it to come back
    if (size < offset) {                  // truncated / rotated in place → resync
      log(`[LGO-LOG] truncation detected (size=${size} < offset=${offset}) — resync from 0`);
      offset = 0;
      carry = "";
    }
    if (size <= offset) return;           // nothing new

    let readFrom = offset;
    let length = size - readFrom;
    if (length > MAX_READ_BYTES) {        // skip a giant backlog, keep the tail
      readFrom = size - TAIL_SLICE_BYTES;
      length = size - readFrom;
      carry = "";
      log(`[LGO-LOG] large backlog (${size - offset} bytes) — only parsing last ${length}`);
    }

    reading = true;
    let fd = null;
    try {
      fd = fs.openSync(logPath, "r");
      const buf = Buffer.allocUnsafe(length);
      const bytesRead = fs.readSync(fd, buf, 0, length, readFrom);
      offset = readFrom + bytesRead;

      const chunk = carry + buf.toString("utf8", 0, bytesRead);
      const lines = chunk.split(/\r?\n/);
      carry = lines.pop();                // last item = partial line (no newline yet)
      for (const line of lines) parseLine(line);
    } catch (e) {
      // EBUSY / EACCES while the LGO writes, or the file disappeared mid-read.
      // Leave offset untouched and retry on the next change event.
      warn("[LGO-LOG] read skipped:", (e && e.message) || e);
    } finally {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch { /* noop */ }
      }
      reading = false;
    }

    if (pendingReread) {
      pendingReread = false;
      drain();
    }
  }

  function parseLine(line) {
    if (!line || line.indexOf("ArticleId") === -1) return;
    ARTICLE_ID_RE.lastIndex = 0;
    const seen = new Set();
    let m;
    while ((m = ARTICLE_ID_RE.exec(line)) !== null) {
      const cip = m[1];
      if (seen.has(cip)) continue;        // same code twice in one line
      seen.add(cip);
      log(`[LGO-LOG] dispense detected cip=${cip}`);
      try {
        if (typeof onDispense === "function") onDispense(cip);
      } catch (e) {
        warn("[LGO-LOG] onDispense handler threw:", (e && e.message) || e);
      }
    }
  }

  function detachFileWatch() {
    if (fileWatcher) {
      try { fileWatcher.close(); } catch { /* noop */ }
      fileWatcher = null;
    }
  }

  function attachFileWatch() {
    detachFileWatch();
    try {
      // persistent:false → never keeps the process alive / never blocks quit.
      fileWatcher = fs.watch(logPath, { persistent: false }, (evt) => {
        if (evt === "rename") {
          // File rotated / replaced: the handle is now stale. Resync + rewatch.
          log("[LGO-LOG] file renamed/rotated — reattaching");
          reattachAfterRotate();
        } else {
          drain();
        }
      });
      fileWatcher.on("error", (e) => {
        warn("[LGO-LOG] watch error — falling back to polling:", (e && e.message) || e);
        detachFileWatch();
        startPollForCreation();
      });
      log(`[LGO-LOG] watching ${logPath} (offset=${offset})`);
    } catch (e) {
      warn("[LGO-LOG] fs.watch failed — falling back to polling:", (e && e.message) || e);
      startPollForCreation();
    }
  }

  function reattachAfterRotate() {
    detachFileWatch();
    const size = safeSize(logPath);
    if (size === null) {
      // The new file is not there yet — wait for it to be (re)created.
      offset = 0;
      carry = "";
      startPollForCreation();
      return;
    }
    // Fresh file: start at its current end so we don't replay its history dump.
    offset = size;
    carry = "";
    attachFileWatch();
    drain();
  }

  // Poll (1s) until the log file exists, then switch to the efficient fs.watch.
  // fs.watchFile tolerates a path that does not exist yet and fires when it
  // appears, so this also covers a PC that has no LGO log at all (it just waits
  // forever, harmlessly).
  function startPollForCreation() {
    if (polling) return;
    polling = true;
    log(`[LGO-LOG] file absent — polling for creation: ${logPath}`);
    try {
      fs.watchFile(logPath, { interval: 1000, persistent: false }, () => {
        const size = safeSize(logPath);
        if (size === null) return;        // still not there
        try { fs.unwatchFile(logPath); } catch { /* noop */ }
        polling = false;
        // Brand-new file → begin at its current end (skip any pre-existing dump).
        offset = size;
        carry = "";
        log(`[LGO-LOG] file appeared (offset=${offset}) — switching to fs.watch`);
        attachFileWatch();
      });
    } catch (e) {
      // Even watchFile can throw on a bad path/drive — stay silent and idle.
      polling = false;
      warn("[LGO-LOG] watchFile failed:", (e && e.message) || e);
    }
  }

  // Start the watcher. `resolvedLogPath` falls back to the LEO default.
  function start(resolvedLogPath) {
    if (started) return;
    started = true;
    logPath = (resolvedLogPath && String(resolvedLogPath).trim()) || DEFAULT_LEO_LOG_PATH;
    offset = 0;
    carry = "";

    const size = safeSize(logPath);
    if (size === null) {
      // Not present yet (non-LEO PC, or the LGO service is not running). Wait.
      startPollForCreation();
      return;
    }
    // Present: skip the existing history, only react to NEW dispenses.
    offset = size;
    attachFileWatch();
  }

  function stop() {
    started = false;
    detachFileWatch();
    if (polling) {
      try { fs.unwatchFile(logPath); } catch { /* noop */ }
      polling = false;
    }
  }

  function status() {
    return {
      logPath,
      offset,
      watching: !!fileWatcher,
      pollingForCreation: polling,
      started,
    };
  }

  return { start, stop, status, get path() { return logPath; } };
}

module.exports = { createLgoLogWatcher, DEFAULT_LEO_LOG_PATH };
