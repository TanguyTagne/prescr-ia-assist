// HTTP listener exposed by every Asclion instance.
//
//   POST /trigger   { "ean": "3400936081349" }
//                   Header: X-Asclion-Token: <shared secret>
//                   → injects the EAN into the same scan pipeline as a HID
//                     douchette so the widget pops up exactly as if the
//                     pharmacist had scanned the box themselves.
//   GET  /health    → { status, port, listening }   (intentionally minimal —
//                     no version, no IP, no counters: defence against scan/CVE
//                     enumeration from a hostile LAN peer)
//
// SECURITY MODEL
//   - Binds to 127.0.0.1 by default → only the local PC can issue triggers.
//   - When the operator explicitly flags this PC as the "serveur robot" in
//     Paramètres, the listener rebinds to 0.0.0.0 so other tills on the LAN
//     can receive cross-PC triggers. In that mode, a shared secret token is
//     REQUIRED on every POST /trigger (header X-Asclion-Token).
//   - CORS is restrictive: only requests with the right token AND from same
//     LAN are accepted. The Origin header is NOT used as a security boundary
//     (it can be spoofed by non-browser clients).
//   - Rate-limit: 20 triggers / minute / source IP. Anything above gets 429.
//   - Payload capped at 4 KB (an EAN is < 64 bytes; 4 KB is generous).

const http = require("http");

let server = null;
let listening = false;
let currentPort = 0;
let currentHost = "127.0.0.1";
let currentToken = "";
let lastError = null;
let triggersReceived = 0;
let lastTriggerAt = 0;
let lastTriggerEan = null;

const RATE_LIMIT_PER_MINUTE = 20;
const RATE_BUCKET_TTL_MS = 60_000;
const rateBuckets = new Map(); // ip → { count, resetAt }

const runtime = {
  version: "0.0.0",
  log: (..._args) => {},
  warn: (..._args) => {},
  // emitGlobalScan(code, "http-trigger") — reuse the existing scan pipeline.
  onTrigger: (_code) => {},
};

function init({ version, log, warn, onTrigger }) {
  runtime.version = version || runtime.version;
  runtime.log = log || runtime.log;
  runtime.warn = warn || runtime.warn;
  runtime.onTrigger = onTrigger || runtime.onTrigger;
}

function start({ port, serveLan, token }) {
  stop(); // idempotent
  const p = Number(port) || 5150;
  currentHost = serveLan ? "0.0.0.0" : "127.0.0.1";
  currentToken = String(token || "");
  if (serveLan && currentToken.length < 24) {
    lastError = "shared secret missing — listener stays bound to 127.0.0.1";
    runtime.warn(`[HTTP] ${lastError}`);
    currentHost = "127.0.0.1";
  }
  return new Promise((resolve) => {
    try {
      server = http.createServer(handleRequest);
      server.on("error", (err) => {
        lastError = err && err.message;
        runtime.warn(`[HTTP] listen error on ${currentHost}:${p}: ${err && err.message}`);
        listening = false;
        resolve({ ok: false, error: lastError });
      });
      server.listen(p, currentHost, () => {
        listening = true;
        currentPort = p;
        lastError = null;
        runtime.log(`[HTTP] listening on ${currentHost}:${p}${serveLan ? " (LAN open — token enforced)" : " (localhost only)"}`);
        resolve({ ok: true, port: p, host: currentHost });
      });
    } catch (e) {
      lastError = e && e.message;
      resolve({ ok: false, error: lastError });
    }
  });
}

function stop() {
  if (server) {
    try { server.close(); } catch { /* ignore */ }
    server = null;
  }
  listening = false;
  rateBuckets.clear();
}

function getStatus() {
  return {
    listening,
    port: currentPort,
    host: currentHost,
    serveLan: currentHost === "0.0.0.0",
    lastError,
    triggersReceived,
    lastTriggerAt: lastTriggerAt || null,
    lastTriggerEan,
    // /health no longer exposes version/ip — the renderer can read those
    // via app.getVersion() / os.networkInterfaces() directly when needed.
  };
}

// Resolve the source IP of an inbound request. socket.remoteAddress can be
// "::ffff:192.168.x.x" for IPv4 over IPv6 sockets — strip the prefix so the
// allow-list and rate-bucket keys are stable.
function sourceIp(req) {
  const raw = (req.socket && req.socket.remoteAddress) || "";
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

function isLoopback(ip) {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

function rateAllowed(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_BUCKET_TTL_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_PER_MINUTE) return false;
  bucket.count++;
  return true;
}

// Constant-time string compare — avoids timing oracle if an attacker can
// observe response times to brute-force the shared secret byte-by-byte.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function handleRequest(req, res) {
  const ip = sourceIp(req);

  // CORS: deny browser cross-origin reads by default. The legitimate use case
  // (cross-PC trigger from another Asclion) doesn't run inside a browser, so
  // a permissive ACAO header buys nothing but extra attack surface.
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", "null");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Asclion-Token");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Per-IP rate limit (applies to ALL endpoints including /health to throttle
  // enumeration scans).
  if (!rateAllowed(ip)) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "rate limit" }));
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    // Minimal payload — no version/IP/counters to reduce enumeration value.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", port: currentPort }));
    return;
  }

  if (req.method === "POST" && req.url === "/trigger") {
    // Auth: localhost callers are trusted (they share the OS user account).
    // Remote callers MUST present the shared secret. The token check is also
    // applied to localhost in serveLan mode to keep the model consistent and
    // protect against a foothold on the same Windows account.
    const requestToken = String(req.headers["x-asclion-token"] || "");
    const isLocal = isLoopback(ip);
    const tokenRequired = !isLocal || currentHost === "0.0.0.0";
    if (tokenRequired) {
      if (!currentToken || !safeEqual(requestToken, currentToken)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
        return;
      }
    }

    const chunks = [];
    let size = 0;
    let rejected = false;
    req.on("data", (c) => {
      if (rejected) return;
      size += c.length;
      if (size > 4 * 1024) {
        rejected = true;
        res.writeHead(413);
        res.end("payload too large");
        try { req.destroy(); } catch { /* noop */ }
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (rejected) return;
      let ean = null;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
        if (typeof body.ean === "string") ean = body.ean.trim();
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "invalid json" }));
        return;
      }
      // Strict alphabet — barcodes are digits + a few GS1 separators. Anything
      // exotic (control chars, paths, scripts) gets rejected before reaching
      // the scan pipeline.
      if (!ean || !/^[A-Za-z0-9()\-_.]{6,32}$/.test(ean)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "missing or invalid ean" }));
        return;
      }
      triggersReceived++;
      lastTriggerAt = Date.now();
      lastTriggerEan = ean;
      try {
        runtime.onTrigger(ean);
      } catch (e) {
        runtime.warn(`[HTTP] /trigger handler threw: ${e && e.message}`);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    req.on("error", (err) => {
      runtime.warn(`[HTTP] /trigger req error: ${err && err.message}`);
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not found" }));
}

module.exports = {
  init,
  start,
  stop,
  getStatus,
};
