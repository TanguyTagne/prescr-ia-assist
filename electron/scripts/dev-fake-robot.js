/**
 * dev-fake-robot.js — a stand-in for the pharmacy robot's TCP server, for
 * testing WinDivert capture on your own PC with no real robot.
 *
 *   node electron/scripts/dev-fake-robot.js [port]
 *
 * Listens on 127.0.0.1:<port> (default 9876) and logs whatever bytes it
 * receives. Pair it with dev-fake-lgo.js, which connects and sends a fake
 * dispense order. While both run, start Asclion with the robot enabled
 * (brand=rowa, port=9876, captureBackend=windivert) and WinDivert should
 * capture the outbound packet and pop the recommendation widget.
 */
"use strict";

const net = require("net");

const port = Number(process.argv[2]) || 9876;

const server = net.createServer((socket) => {
  const peer = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[fake-robot] connection from ${peer}`);
  socket.on("data", (chunk) => {
    console.log(`[fake-robot] received ${chunk.length} bytes: ${chunk.toString("utf-8").replace(/[\r\n]+/g, " ")}`);
  });
  socket.on("close", () => console.log(`[fake-robot] ${peer} closed`));
  socket.on("error", (e) => console.log(`[fake-robot] socket error: ${e.message}`));
});

server.on("error", (e) => {
  console.error(`[fake-robot] listen error: ${e.message}`);
  process.exit(1);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[fake-robot] listening on 0.0.0.0:${port} — Ctrl+C to stop`);
});
