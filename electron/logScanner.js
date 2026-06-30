// ─────────────────────────────────────────────────────────────────────────────
// Wizard générique de détection du log LGO/robot.
//
// Objectif : à chaque délivrance robot, UN fichier log d'un LGO (Léo, Winpharma,
// LGPI, Pharmaland, Smart-Rx, etc.) est mis à jour sur le PC, et contient le
// CIP13 du produit délivré. Plutôt que de coder en dur le chemin par LGO, on
// scanne tous les .log/.txt actifs sur la machine, on prend un snapshot de leur
// taille, on demande au pharmacien d'effectuer une délivrance, puis on regarde
// quels fichiers ont grossi et lesquels contiennent un CIP13 dans l'ajout.
//
// Sortie : liste classée { path, sizeDelta, appendedSample, cipMatches, score }.
// Le pharmacien valide → on enregistre le chemin dans asclion.config.json et le
// watcher principal est redémarré dessus.
//
// Zéro dépendance externe (fs + path natifs). Windows + macOS + Linux.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

// ── Réglages ─────────────────────────────────────────────────────────────────
const MAX_FILES = 1500;             // hard cap (perf)
const MAX_DEPTH = 6;                // profondeur de récurrence
const MAX_FILE_BYTES_SCAN = 64 * 1024 * 1024; // n'instrumente pas les fichiers >64 MB
const APPENDED_READ_CAP = 512 * 1024;          // lit au max 512 KB de l'ajout
const SAMPLE_SNIPPET = 400;        // taille de l'extrait renvoyé à l'UI
const RECENT_MS = 14 * 24 * 3600 * 1000;       // ignore les fichiers non modifiés depuis 14j

// Dossiers à ignorer (bruit pur, jamais un log LGO)
const SKIP_DIR_NAMES = new Set([
  "node_modules", ".git", ".svn", "$Recycle.Bin", "System Volume Information",
  "Windows", "WinSxS", "Microsoft", "Microsoft.NET", "Microsoft Shared",
  "Common Files", "DriverStore", "Drivers", "Installer", "WindowsApps",
  "Temp", "tmp", "Cache", "Caches", "ServiceProfiles", "Logs.old",
  "Asclion", "asclion-desktop", "Lovable", "Electron", "Chromium",
  "Google", "Mozilla", "Opera", "Brave",
]);

// Extensions ciblées (case-insensitive)
const LOG_EXTS = new Set([".log", ".txt"]);

// ── CIP13 français ───────────────────────────────────────────────────────────
// Forme stricte : 13 chiffres exacts. Score boost si commence par 34 (FR).
const CIP_RE = /(?<![0-9])(\d{13})(?![0-9])/g;
function isPlausibleFrCip(s) { return typeof s === "string" && /^34\d{11}$/.test(s); }

// ── Roots par défaut (Windows-first, fallbacks macOS/Linux pour tests) ───────
function defaultRoots() {
  const roots = [];
  if (process.platform === "win32") {
    const add = (p) => p && roots.push(p);
    add(process.env.ProgramData || "C:\\ProgramData");
    add(process.env["ProgramFiles"]);
    add(process.env["ProgramFiles(x86)"]);
    add(process.env.LOCALAPPDATA);
    add(process.env.APPDATA);
    // Dossiers d'install fréquents non listés dans %ProgramFiles%
    add("C:\\Asclion");
    add("C:\\Astera");
    add("C:\\Pharma");
    add("C:\\Winpharma");
    add("C:\\LGPI");
    add("C:\\Smart-Rx");
  } else {
    // tests dev
    roots.push(process.env.HOME || "/tmp");
  }
  // unique + existants
  const seen = new Set();
  return roots.filter((r) => {
    if (!r) return false;
    const k = path.resolve(r);
    if (seen.has(k)) return false;
    seen.add(k);
    try { return fs.statSync(k).isDirectory(); } catch { return false; }
  });
}

// ── Walk récursif borné ──────────────────────────────────────────────────────
function walk(root, onFile, log) {
  let count = 0;
  const dbg = typeof log === "function" ? log : () => {};
  const cutoff = Date.now() - RECENT_MS;

  function visit(dir, depth) {
    if (count >= MAX_FILES) return;
    if (depth > MAX_DEPTH) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const ent of entries) {
      if (count >= MAX_FILES) return;
      const full = path.join(dir, ent.name);
      try {
        if (ent.isDirectory()) {
          if (SKIP_DIR_NAMES.has(ent.name)) continue;
          // ignore les chemins manifestement liés à des caches de navigateur
          const lower = ent.name.toLowerCase();
          if (lower === "cache" || lower === "code cache" || lower.endsWith(".sav")) continue;
          visit(full, depth + 1);
        } else if (ent.isFile()) {
          const ext = path.extname(ent.name).toLowerCase();
          if (!LOG_EXTS.has(ext)) continue;
          let st;
          try { st = fs.statSync(full); } catch { continue; }
          if (st.size > MAX_FILE_BYTES_SCAN) continue;
          if (st.mtimeMs < cutoff) continue;
          onFile({ path: full, size: st.size, mtimeMs: st.mtimeMs });
          count++;
        }
      } catch (e) {
        dbg(`[LOG-SCAN] visit error ${full}: ${e && e.message}`);
      }
    }
  }
  visit(root, 0);
  return count;
}

// ── État du scan en cours (un seul à la fois) ────────────────────────────────
let current = null;
function isRunning() { return !!current; }

function discoverCandidates({ extraRoots, log } = {}) {
  const dbg = typeof log === "function" ? log : () => {};
  const roots = defaultRoots();
  for (const r of (Array.isArray(extraRoots) ? extraRoots : [])) {
    try {
      const rr = path.resolve(String(r));
      if (fs.statSync(rr).isDirectory() && !roots.includes(rr)) roots.push(rr);
    } catch { /* ignore */ }
  }
  const snapshot = new Map(); // path → { size, mtimeMs }
  for (const r of roots) {
    walk(r, ({ path: p, size, mtimeMs }) => {
      // garde le plus récent si doublon (peu probable)
      const prev = snapshot.get(p);
      if (!prev || prev.size !== size) snapshot.set(p, { size, mtimeMs });
    }, dbg);
    if (snapshot.size >= MAX_FILES) break;
  }
  dbg(`[LOG-SCAN] discovered ${snapshot.size} log files across ${roots.length} roots`);
  return { snapshot, roots };
}

function startScan({ durationMs, extraRoots, onEvent, log } = {}) {
  if (current) return { ok: false, error: "scan already running" };
  const dbg = typeof log === "function" ? log : () => {};
  const emit = (payload) => { try { onEvent && onEvent(payload); } catch { /* noop */ } };

  emit({ phase: "discover" });
  const { snapshot, roots } = discoverCandidates({ extraRoots, log: dbg });
  const dur = Math.max(5_000, Math.min(120_000, Number(durationMs) || 30_000));
  const deadline = Date.now() + dur;

  current = {
    startedAt: Date.now(),
    deadline,
    snapshot,
    roots,
    finalized: false,
    onEvent,
    timer: null,
  };

  emit({ phase: "ready", deadlineMs: deadline, fileCount: snapshot.size, rootCount: roots.length });

  current.timer = setTimeout(() => { finalizeScan({ reason: "deadline" }); }, dur + 10);
  return { ok: true, deadlineMs: deadline, fileCount: snapshot.size, rootCount: roots.length };
}

function readAppended(filePath, fromOffset, toOffset) {
  const len = Math.min(APPENDED_READ_CAP, Math.max(0, toOffset - fromOffset));
  if (len === 0) return "";
  // Si l'ajout est > cap, on lit la queue (souvent l'écriture concerne la fin).
  const start = toOffset - len;
  let fd = null;
  try {
    fd = fs.openSync(filePath, "r");
    const buf = Buffer.allocUnsafe(len);
    const bytes = fs.readSync(fd, buf, 0, len, start);
    return buf.slice(0, bytes).toString("utf-8");
  } catch { return ""; }
  finally { if (fd !== null) { try { fs.closeSync(fd); } catch { /* noop */ } } }
}

function rankFiles(snapshot) {
  const out = [];
  for (const [p, prev] of snapshot.entries()) {
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    const sizeDelta = st.size - prev.size;
    if (sizeDelta <= 0 && st.mtimeMs <= prev.mtimeMs) continue;
    const appended = sizeDelta > 0 ? readAppended(p, prev.size, st.size) : "";
    const cipMatches = [];
    if (appended) {
      const seen = new Set();
      let m;
      CIP_RE.lastIndex = 0;
      while ((m = CIP_RE.exec(appended)) !== null) {
        const cip = m[1];
        if (!seen.has(cip)) { seen.add(cip); cipMatches.push(cip); }
        if (cipMatches.length >= 20) break;
      }
    }
    const frCips = cipMatches.filter(isPlausibleFrCip);
    const score =
      frCips.length * 100 +
      cipMatches.length * 10 +
      Math.min(50, Math.round(Math.max(0, sizeDelta) / 1024)); // 1pt/Ko jusqu'à 50
    out.push({
      path: p,
      sizeBefore: prev.size,
      sizeAfter: st.size,
      sizeDelta,
      mtimeMs: st.mtimeMs,
      cipMatches,
      frCipMatches: frCips,
      snippet: appended.slice(-SAMPLE_SNIPPET),
      score,
    });
  }
  out.sort((a, b) => b.score - a.score || b.sizeDelta - a.sizeDelta);
  return out;
}

function finalizeScan({ reason } = {}) {
  if (!current || current.finalized) return null;
  current.finalized = true;
  if (current.timer) { clearTimeout(current.timer); current.timer = null; }
  const ranked = rankFiles(current.snapshot);
  const result = {
    phase: "done",
    reason: reason || "manual",
    fileCount: current.snapshot.size,
    rootCount: current.roots.length,
    roots: current.roots,
    candidates: ranked.slice(0, 30),
    candidatesWithCip: ranked.filter((r) => r.frCipMatches.length > 0).length,
  };
  try { current.onEvent && current.onEvent(result); } catch { /* noop */ }
  current = null;
  return result;
}

function stopScan() {
  if (!current) return { ok: false, error: "no scan running" };
  const r = finalizeScan({ reason: "manual" });
  return { ok: true, result: r };
}

function statusScan() {
  if (!current) return { running: false };
  return {
    running: true,
    startedAt: current.startedAt,
    deadlineMs: current.deadline,
    fileCount: current.snapshot.size,
    rootCount: current.roots.length,
  };
}

module.exports = {
  startScan,
  stopScan,
  statusScan,
  isRunning,
  // exposé pour tests
  rankFiles,
  defaultRoots,
};
