// HTTP listener exposed by every Asclion instance on the LAN.
//
//   POST /trigger   { "ean": "3400936081349" }
//                   → injects the EAN into the same scan pipeline as a HID
//                     douchette so the widget pops up exactly as if the
//                     pharmacist had scanned the box themselves.
//   GET  /health    → { status, ip, version, port }
//
// Runs in the Electron main process. If port 5150 is already taken (e.g. the
// pharmacist runs a dev server on the same port) we log it and back off —
// the rest of the app keeps working, only the cross-PC trigger is unavailable.

const http = require("http");
const os = require("os");

let server = null;
let listening = false;
let currentPort = 0;
let lastError = null;
let triggersReceived = 0;
let lastTriggerAt = 0;
let lastTriggerEan = null;

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

function localIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const addr of ifaces[name] || []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return "127.0.0.1";
}

function start(port) {
  stop(); // idempotent
  const p = Number(port) || 5150;
  return new Promise((resolve) => {
    try {
      server = http.createServer(handleRequest);
      server.on("error", (err) => {
        lastError = err && err.message;
        runtime.warn(`[HTTP] listen error on ${p}: ${err && err.message}`);
        listening = false;
        resolve({ ok: false, error: lastError });
      });
      server.listen(p, "0.0.0.0", () => {
        listening = true;
        currentPort = p;
        lastError = null;
        runtime.log(`[HTTP] listening on 0.0.0.0:${p}`);
        resolve({ ok: true, port: p });
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
}

function getStatus() {
  return {
    listening,
    port: currentPort,
    lastError,
    triggersReceived,
    lastTriggerAt: lastTriggerAt || null,
    lastTriggerEan,
    ip: localIp(),
    version: runtime.version,
  };
}

function handleRequest(req, res) {
  // CORS so a renderer on a different origin (dev mode) can also POST /trigger.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Asclion-Source");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      ip: localIp(),
      version: runtime.version,
      port: currentPort,
      triggersReceived,
    }));
    return;
  }

  if (req.method === "POST" && req.url === "/trigger") {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        // 64 KB is two orders of magnitude more than we ever expect — anything
        // larger is a misconfigured client (or worse). Reject cleanly.
        res.writeHead(413);
        res.end("payload too large");
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      let ean = null;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
        if (typeof body.ean === "string") ean = body.ean.trim();
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "invalid json" }));
        return;
      }
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
      res.end(JSON.stringify({ ok: true, ean }));
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
