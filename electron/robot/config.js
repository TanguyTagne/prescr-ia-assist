// Persisted configuration for the robot interception subsystem & HTTP listener.
// Stored in app.getPath("userData") so the file survives auto-updates and is
// writable by the user account that runs Asclion (no admin needed).
//
// Schema (asclion-robot-config.json):
//   {
//     "httpPort":      5150,             // POST /trigger + GET /health
//     "robot": {
//       "enabled":       false,          // is robot capture on for this PC?
//       "brand":         "none",         // none|rowa|pharmathek|generic|diagnostic
//       "port":          9876,           // TCP port the LGO talks to
//       "regex":         "EAN>(\\d{8,14})<", // GenericAdapter pattern (1st group = EAN)
//       "captureBackend":"auto",         // auto|windivert|npcap|tcp-listen
//       "passiveOnly":   true,           // never fall back to the tcp-listen relay (no MITM, never disrupts LGO↔robot)
//       "robotServerIp": null,           // optional: pin WinDivert filter to this dst IP
//       "captureDirection":"outbound",   // WinDivert capture direction (per-till = outbound)
//       "useNpcap":      true,           // try Npcap (passive sniff) before TCP listen
//       "targetIp":      null            // optional override: where to POST /trigger (default = packet source IP)
//     }
//   }

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_CONFIG = Object.freeze({
  httpPort: 5150,
  // Shared secret used by the HTTP listener to authenticate POST /trigger.
  // Auto-generated on first launch in ensureSecret(). Other Asclion PCs in
  // the same officine must send `X-Asclion-Token: <secret>` to get a 200.
  // Stays inside `userData` (per-user, only this Windows account can read).
  httpToken: "",
  // bindHost is computed at runtime: 127.0.0.1 unless the user explicitly
  // enables `serveLan` (mode "ce PC est le serveur robot" + LAN listener).
  // Keeping the flag opt-in makes the default install non-listening on the LAN.
  serveLan: false,
  robot: {
    enabled: false,
    brand: "none",
    port: 9876,
    regex: "EAN>(\\d{8,14})<",
    // Capture backend. "auto" prefers WinDivert (bundled signed driver, no
    // installer), then Npcap, then the TCP-listen proxy — see sniffer.start().
    captureBackend: "auto",
    // Passive-only safety switch. When true, the sniffer NEVER falls back to the
    // tcp-listen relay (man-in-the-middle): WinDivert/Npcap observe the traffic
    // without ever sitting in the data path, so a crash or a misconfig can never
    // interrupt the LGO ↔ robot dispense chain. The connection wizard always
    // saves with this on. An explicit captureBackend:"tcp-listen" (dev/QA) still
    // overrides it — see sniffer.start().
    passiveOnly: true,
    // Optional: restrict the WinDivert filter to the robot server's IP so we
    // never capture unrelated traffic that happens to use the same port. Empty
    // = capture every connection to robot.port. Prefillable from the "remote
    // address" returned by robot:discover-port.
    robotServerIp: null,
    // WinDivert capture direction. Per-till self-capture watches THIS PC's
    // outbound dispense orders; "outbound" also covers loopback for desk tests.
    captureDirection: "outbound",
    useNpcap: true,
    targetIp: null,
    // IPs allowed to drive the TCP-listen fallback. Empty = accept any LAN
    // peer (legacy behaviour). Setting at least one IP locks the listener
    // down to the LGO's machine — recommended in production.
    allowedClientIps: [],
  },
});

let cached = null;
let configPath = null;

function setConfigPath(p) {
  configPath = p;
  cached = null;
}

function resolveConfigPath() {
  if (configPath) return configPath;
  throw new Error("robot/config: setConfigPath() must be called once at boot");
}

function deepMergeDefaults(value, fallback) {
  if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback.slice();
  if (fallback && typeof fallback === "object") {
    const out = {};
    for (const key of Object.keys(fallback)) {
      out[key] = deepMergeDefaults(value ? value[key] : undefined, fallback[key]);
    }
    return out;
  }
  return value === undefined || value === null ? fallback : value;
}

function load() {
  if (cached) return cached;
  const p = resolveConfigPath();
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    cached = deepMergeDefaults(parsed, DEFAULT_CONFIG);
  } catch {
    cached = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  return cached;
}

function save(patch) {
  const current = load();
  // Merge ALL top-level keys from current state, then overlay the patch.
  // Without this, any field not explicitly listed (serveLan, httpToken, …)
  // was reset to its default on every save — e.g. the "mode serveur robot"
  // toggle never persisted across restarts.
  const merged = {
    ...current,
    ...patch,
    robot: { ...current.robot, ...(patch && patch.robot ? patch.robot : {}) },
  };
  const next = deepMergeDefaults(merged, DEFAULT_CONFIG);
  const p = resolveConfigPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(next, null, 2), "utf-8");
    cached = next;
  } catch (e) {
    // Surface the error to the caller — they decide whether to bubble to renderer.
    throw new Error(`robot/config: save failed (${e && e.message})`);
  }
  return next;
}

function get() {
  return load();
}

// Lazy-generate the shared secret on first call. Stored on disk so all PCs
// can be configured with the SAME token (the pharmacist copies it across
// machines via Paramètres → Robot › "Jeton partagé").
function ensureSecret() {
  const cfg = load();
  if (cfg.httpToken && cfg.httpToken.length >= 24) return cfg.httpToken;
  const token = crypto.randomBytes(32).toString("base64url");
  save({ httpToken: token });
  return token;
}

module.exports = {
  DEFAULT_CONFIG,
  setConfigPath,
  load,
  save,
  get,
  ensureSecret,
};
