/**
 * dev-fake-robot.js — a stand-in for the pharmacy robot's TCP server, for
 * testing the robot diagnostic + capture on your own PC with no real robot.
 *
 *   node electron/scripts/dev-fake-robot.js [--port 9876] [--host 0.0.0.0] [--reply]
 *   (legacy positional form still works:  node dev-fake-robot.js 6050)
 *
 * Listens on <host>:<port> and logs whatever bytes it receives. Pair it with
 * dev-fake-lgo.js. See TESTING-robot.md for the full scenario matrix.
 *
 *   --host   interface to bind. 0.0.0.0 = all (default), 127.0.0.1 = loopback
 *            only, or your LAN IP (e.g. 192.168.1.50) to mimic a real server.
 *   --port   TCP port to listen on (default 9876; WWKS2 installs often use 6050).
 *   --reply  send back a small WWKS2-style acknowledgement so the robot's source
 *            port also carries a payload (exercises the src-port path of
 *            robot:auto-detect-port and the request/response shape of WWKS2).
 */
"use strict";

const net = require("net");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) {
    const v = process.argv[i + 1];
    if (v && !v.startsWith("--")) return v;
  }
  return fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

// Backward-compat: with no --flags, the first bare numeric arg is the port.
const usingFlags = process.argv.slice(2).some((a) => a.startsWith("--"));
const positionalPort = usingFlags ? undefined : process.argv.slice(2).find((a) => /^\d+$/.test(a));
const port = Number(arg("port", positionalPort || 9876));
const host = arg("host", "0.0.0.0");
const reply = hasFlag("reply");

const server = net.createServer((socket) => {
  const peer = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[fake-robot] connection from ${peer}`);
  socket.on("data", (chunk) => {
    const text = chunk.toString("utf-8").replace(/[\r\n]+/g, " ").slice(0, 300);
    console.log(`[fake-robot] received ${chunk.length} bytes: ${text}`);
    if (reply) {
      const ack =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<WWKS Version="2.0"><OutputResponse Status="Completed"/></WWKS>\n`;
      try { socket.write(ack); } catch { /* ignore */ }
    }
  });
  socket.on("close", () => console.log(`[fake-robot] ${peer} closed`));
  socket.on("error", (e) => console.log(`[fake-robot] socket error: ${e.message}`));
});

server.on("error", (e) => {
  console.error(`[fake-robot] listen error: ${e.message}`);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`[fake-robot] listening on ${host}:${port}${reply ? " (reply on)" : ""} — Ctrl+C to stop`);
});
