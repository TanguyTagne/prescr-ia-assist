// Robot adapter system.
//
// Each adapter knows how to inspect a raw TCP payload coming from the LGO
// → robot link and extract the EAN/CIP of the product being dispensed.
//
// Add a new brand by subclassing RobotAdapter and registering it in the
// `BUILTIN` map at the bottom of this file. No other file needs to change.

const fs = require("fs");
const path = require("path");

class RobotAdapter {
  constructor({ name, defaultPort }) {
    this.name = name;
    this.defaultPort = defaultPort;
  }

  // Returns the EAN/CIP string, or null if the payload is not a dispense order.
  // raw is a Buffer.
  // eslint-disable-next-line no-unused-vars
  extractEan(raw) {
    return null;
  }
}

// ───── Rowa / BD Rowa ────────────────────────────────────────────────
// Rowa speaks an XML-over-TCP protocol. Different firmware versions tag the
// barcode under different element names — we match a few common variants and
// pick the first one that looks like an EAN/CIP code (7–14 digits).
class RowaAdapter extends RobotAdapter {
  constructor() {
    super({ name: "rowa", defaultPort: 9876 });
  }

  extractEan(raw) {
    const text = bufferToText(raw);
    if (!text) return null;
    const patterns = [
      /<EAN[^>]*>(\d{7,14})<\/EAN>/i,
      /<Barcode[^>]*>(\d{7,14})<\/Barcode>/i,
      /<Article[^>]*Code="(\d{7,14})"/i,
      /<Article[^>]*>(\d{7,14})<\/Article>/i,
      /<GTIN[^>]*>(\d{7,14})<\/GTIN>/i,
      /<PZN[^>]*>(\d{6,8})<\/PZN>/i,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) return m[1];
    }
    return null;
  }
}

// ───── Pharmathek ────────────────────────────────────────────────────
// Pharmathek uses a similar XML structure but ships under several aliases.
// Default port left to the configured value because Pharmathek deployments
// vary widely — the customer must set the right port from the UI.
class PharmathekAdapter extends RobotAdapter {
  constructor() {
    super({ name: "pharmathek", defaultPort: 0 });
  }

  extractEan(raw) {
    const text = bufferToText(raw);
    if (!text) return null;
    const patterns = [
      /<ean[^>]*>(\d{7,14})<\/ean>/i,
      /<code[^>]*>(\d{7,14})<\/code>/i,
      /<product[^>]*ean="(\d{7,14})"/i,
      /<dispense[^>]*barcode="(\d{7,14})"/i,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) return m[1];
    }
    return null;
  }
}

// ───── Generic ───────────────────────────────────────────────────────
// User-supplied regex. The first capture group must isolate the EAN.
// Pattern is compiled lazily and cached. An invalid pattern is logged
// once then ignored (the adapter returns null instead of throwing — we
// never want the sniffer to crash on bad config).
class GenericAdapter extends RobotAdapter {
  constructor({ pattern }) {
    super({ name: "generic", defaultPort: 0 });
    this.patternSource = pattern || "";
    this._compiled = null;
    this._compileError = null;
    try {
      // Default flag set: case-insensitive — most XML/JSON tags don't care.
      this._compiled = new RegExp(pattern, "i");
    } catch (e) {
      this._compileError = e && e.message;
    }
  }

  extractEan(raw) {
    if (!this._compiled) return null;
    const text = bufferToText(raw);
    if (!text) return null;
    const m = text.match(this._compiled);
    return m && m[1] ? m[1] : null;
  }
}

// ───── Diagnostic ────────────────────────────────────────────────────
// Captures every raw packet to robot_capture.log with rotation. Used to
// reverse-engineer the protocol of an unknown robot brand: enable it for
// a few minutes, scan a couple of items at the till, send the log to
// support, and a new adapter can be written from the captured samples.
class DiagnosticAdapter extends RobotAdapter {
  constructor({ logPath, maxBytes }) {
    super({ name: "diagnostic", defaultPort: 0 });
    this.logPath = logPath;
    this.maxBytes = maxBytes || 5 * 1024 * 1024; // 5 MB
    this._writeError = null;
    this._lastRotateAt = 0;
  }

  // Always returns null — diagnostic mode never triggers /trigger by design.
  // Its only job is to dump packets so a real adapter can be authored.
  extractEan(raw) {
    this._capture(raw);
    return null;
  }

  _capture(raw) {
    if (!this.logPath) return;
    try {
      this._rotateIfNeeded();
      const ts = new Date().toISOString();
      const hex = Buffer.isBuffer(raw) ? raw.toString("hex") : "";
      const printable = redactPotentialPii(bufferToText(raw))
        .replace(/[\r\n\t]/g, " ")
        .slice(0, 500);
      const line = `[${ts}] len=${raw.length} hex=${hex.slice(0, 200)}... text="${printable}"\n`;
      fs.appendFileSync(this.logPath, line, "utf-8");
      this._writeError = null;
    } catch (e) {
      this._writeError = e && e.message;
    }
  }

  _rotateIfNeeded() {
    // Daily rotation OR size-based rotation, whichever fires first.
    const now = Date.now();
    if (now - this._lastRotateAt < 60_000) {
      // Don't stat the file on every packet — once per minute is enough.
      return;
    }
    this._lastRotateAt = now;
    try {
      const st = fs.statSync(this.logPath);
      const sameDay =
        new Date(st.mtimeMs).toISOString().slice(0, 10) ===
        new Date(now).toISOString().slice(0, 10);
      if (st.size > this.maxBytes || !sameDay) {
        const dir = path.dirname(this.logPath);
        const base = path.basename(this.logPath, ".log");
        const stamp = new Date(st.mtimeMs).toISOString().slice(0, 19).replace(/[:T]/g, "-");
        fs.renameSync(this.logPath, path.join(dir, `${base}.${stamp}.log`));
      }
    } catch (e) {
      // File doesn't exist yet → nothing to rotate. Anything else → ignore;
      // appendFileSync will surface the next failure via _writeError.
      if (e && e.code !== "ENOENT") this._writeError = e.message;
    }
  }
}

// Best-effort PII redaction for the diagnostic log. We don't need to be
// perfect — the log is meant to be sent to support to reverse-engineer the
// protocol, not to leak patient data. We scrub the obvious GDPR landmines
// (French NIR, IBAN, emails, phone numbers) and the common XML/JSON tags
// known to carry patient identifiers in robot protocols. EAN/CIP codes
// (8–14 digits) stay readable on purpose — they're the whole point of the
// capture.
const PII_PATTERNS = [
  // French NIR (sécu sociale) — 13 or 15 consecutive digits, not a CIP/EAN
  [/\b\d{15}\b/g, "[REDACTED_NIR]"],
  [/\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/g, "[REDACTED_NIR]"],
  // IBAN
  [/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, "[REDACTED_IBAN]"],
  // Email
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[REDACTED_EMAIL]"],
  // French phone (+33 or 0X with 9 digits)
  [/\b(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}\b/g, "[REDACTED_PHONE]"],
  // Common patient/name tags found in robot XML
  [/<(patient|patientName|nom|firstName|lastName|prenom|surname|adresse|address)\b[^>]*>[^<]+<\//gi, "<$1>[REDACTED]</"],
  [/(patient|patient_name|nom|prenom|first_name|last_name|address|adresse)\s*[:=]\s*"[^"]*"/gi, "$1=\"[REDACTED]\""],
];

function redactPotentialPii(text) {
  if (!text) return "";
  let out = text;
  for (const [re, repl] of PII_PATTERNS) {
    out = out.replace(re, repl);
  }
  return out;
}

// Best-effort decode: most robot protocols are XML-over-TCP (UTF-8) or
// plain ASCII. Latin-1 fallback covers older Pharmathek deployments.
function bufferToText(raw) {
  if (!Buffer.isBuffer(raw)) return "";
  try {
    return raw.toString("utf-8");
  } catch {
    try {
      return raw.toString("latin1");
    } catch {
      return "";
    }
  }
}

const BUILTIN = {
  rowa: () => new RowaAdapter(),
  pharmathek: () => new PharmathekAdapter(),
  generic: ({ pattern }) => new GenericAdapter({ pattern }),
  diagnostic: ({ logPath }) => new DiagnosticAdapter({ logPath }),
};

function createAdapter(brand, opts = {}) {
  const factory = BUILTIN[brand];
  if (!factory) return null;
  return factory(opts);
}

module.exports = {
  RobotAdapter,
  RowaAdapter,
  PharmathekAdapter,
  GenericAdapter,
  DiagnosticAdapter,
  createAdapter,
};
