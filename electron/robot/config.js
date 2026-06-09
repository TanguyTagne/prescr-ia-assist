// Persisted configuration for the robot interception subsystem & HTTP listener.
// Stored in app.getPath("userData") so the file survives auto-updates and is
// writable by the user account that runs Asclion (no admin needed).
//
// Schema (asclion-robot-config.json):
//   {
//     "httpPort":      5150,             // POST /trigger + GET /health
//     "robot": {
//       "enabled":     false,            // is this PC the robot-server PC?
//       "brand":       "none",           // none|rowa|pharmathek|generic|diagnostic
//       "port":        9876,             // TCP port the LGO talks to
//       "regex":       "EAN>(\\d{8,14})<", // GenericAdapter pattern (1st group = EAN)
//       "useNpcap":    true,             // try Npcap (passive sniff) before TCP listen
//       "targetIp":    null              // optional override: where to POST /trigger (default = packet source IP)
//     }
//   }

const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG = Object.freeze({
  httpPort: 5150,
  robot: {
    enabled: false,
    brand: "none",
    port: 9876,
    regex: "EAN>(\\d{8,14})<",
    useNpcap: true,
    targetIp: null,
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
  const next = deepMergeDefaults(
    {
      httpPort: patch.httpPort ?? current.httpPort,
      robot: { ...current.robot, ...(patch.robot || {}) },
    },
    DEFAULT_CONFIG,
  );
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

module.exports = {
  DEFAULT_CONFIG,
  setConfigPath,
  load,
  save,
  get,
};
