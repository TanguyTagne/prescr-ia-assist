/**
 * dev-fake-lgo.js — pretends to be the LGO sending a dispense order to the
 * robot, for testing WinDivert capture with no real LGO.
 *
 *   node electron/scripts/dev-fake-lgo.js [host] [port] [cip]
 *
 * Defaults: host 127.0.0.1, port 9876, cip 3400936081349 (a real-looking CIP13).
 * Sends a Rowa-style XML payload that the RowaAdapter knows how to parse, then
 * disconnects. Run dev-fake-robot.js first so there's something to connect to.
 *
 * Expected result while Asclion is running with the robot enabled
 * (brand=rowa, port=9876, captureBackend=windivert): the widget pops with the
 * product + its complementary recommendations, exactly as if it were scanned.
 */
"use strict";

const net = require("net");

const host = process.argv[2] || "127.0.0.1";
const port = Number(process.argv[3]) || 9876;
const cip = process.argv[4] || "3400936081349";

// Matches one of RowaAdapter's patterns: <EAN>...</EAN>.
const payload =
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<Dispense><Article Name="TEST"><EAN>${cip}</EAN></Article></Dispense>\n`;

const socket = net.connect({ host, port }, () => {
  console.log(`[fake-lgo] connected to ${host}:${port}, sending CIP ${cip}…`);
  socket.write(payload, () => {
    console.log(`[fake-lgo] sent ${Buffer.byteLength(payload)} bytes`);
    socket.end();
  });
});

socket.on("close", () => console.log("[fake-lgo] done"));
socket.on("error", (e) => {
  console.error(`[fake-lgo] error: ${e.message} (is dev-fake-robot.js running on ${host}:${port}?)`);
  process.exit(1);
});
