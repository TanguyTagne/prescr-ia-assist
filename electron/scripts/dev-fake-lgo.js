/**
 * dev-fake-lgo.js — pretends to be the LGO sending dispense orders to the
 * robot, for testing the diagnostic + capture with no real LGO.
 *
 *   node electron/scripts/dev-fake-lgo.js [--host 127.0.0.1] [--port 9876]
 *        [--cip 3400936081349] [--format ean] [--repeat 1] [--interval 0] [--persist]
 *   (legacy positional form still works:  node dev-fake-lgo.js 127.0.0.1 9876 3400936081349)
 *
 *   --format  payload shape sent to the robot. Lets you test the RowaAdapter
 *             regex against each tag variant:
 *               ean          <EAN>cip</EAN>                  (matches)
 *               barcode      <Barcode>cip</Barcode>          (matches)
 *               article-code <Article Code="cip">            (matches)
 *               gtin         <GTIN>cip</GTIN>                (matches)
 *               pzn          <PZN>12345678</PZN>             (matches, German)
 *               wwks2        realistic WWKS2 OutputMessage — the code lives in
 *                            Article Id / Pack ScanCode ATTRIBUTES, NOT in an
 *                            <EAN> element, so the current RowaAdapter does NOT
 *                            match it. Use this to prove the regex gap.
 *               raw          bare digits, no XML             (negative test)
 *   --repeat n     number of dispense orders to send (default 1)
 *   --interval ms  delay between orders (default 0)
 *   --persist      keep ONE connection open for all orders (simulates a
 *                  permanent LGO<->robot link). Without it, each order opens a
 *                  fresh connection (simulates a per-dispense connection).
 *
 * See TESTING-robot.md for the full scenario matrix.
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

// With no --flags, fall back to legacy positional [host] [port] [cip].
const usingFlags = process.argv.slice(2).some((a) => a.startsWith("--"));
const positional = usingFlags ? [] : process.argv.slice(2);
const host = arg("host", positional[0] || "127.0.0.1");
const port = Number(arg("port", positional[1] || 9876));
const cip = arg("cip", positional[2] || "3400936081349");
const format = String(arg("format", "ean")).toLowerCase();
const repeat = Math.max(1, Number(arg("repeat", 1)) || 1);
const interval = Math.max(0, Number(arg("interval", 0)) || 0);
const persist = hasFlag("persist");

function buildPayload(fmt, code) {
  switch (fmt) {
    case "barcode":
      return `<?xml version="1.0"?><Dispense><Article><Barcode>${code}</Barcode></Article></Dispense>\n`;
    case "article-code":
      return `<?xml version="1.0"?><Dispense><Article Code="${code}" Name="TEST"/></Dispense>\n`;
    case "gtin":
      return `<?xml version="1.0"?><Dispense><Article><GTIN>${code}</GTIN></Article></Dispense>\n`;
    case "pzn": {
      const pzn = (code || "").replace(/\D/g, "").slice(0, 8) || "12345678";
      return `<?xml version="1.0"?><Dispense><Article><PZN>${pzn}</PZN></Article></Dispense>\n`;
    }
    case "wwks2":
      // Realistic WWKS2 OutputMessage. The article code is carried in the
      // Article Id and Pack ScanCode ATTRIBUTES — the current RowaAdapter has
      // no pattern for those, so extraction returns null on purpose. Capture a
      // real robot payload (-Capture in the diagnostic) before widening it.
      return (
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<WWKS Version="2.0" TimeStamp="${new Date().toISOString()}" Id="1" Source="100" Destination="1">` +
        `<OutputMessage Id="42" Source="100" Destination="1" Priority="Normal">` +
        `<Criteria><Article Id="${code}" Quantity="1">` +
        `<Pack DeliveryNumber="1" ScanCode="${code}" StockLocationId="A1"/>` +
        `</Article></Criteria></OutputMessage></WWKS>\n`
      );
    case "raw":
      return `${code}\r\n`;
    case "ean":
    default:
      return `<?xml version="1.0" encoding="UTF-8"?><Dispense><Article Name="TEST"><EAN>${code}</EAN></Article></Dispense>\n`;
  }
}

const payload = buildPayload(format, cip);
let sent = 0;

function logSent() {
  console.log(`[fake-lgo] (${format}) order ${sent}/${repeat} -> ${host}:${port}, ${Buffer.byteLength(payload)} bytes (cip ${cip})`);
}
function onError(e) {
  console.error(`[fake-lgo] error: ${e.message} (is dev-fake-robot.js running on ${host}:${port}?)`);
  process.exit(1);
}

if (persist) {
  // One long-lived connection; send `repeat` orders spaced by `interval`.
  const socket = net.connect({ host, port }, () => {
    console.log(`[fake-lgo] connected (persistent) to ${host}:${port}`);
    const tick = () => {
      if (sent >= repeat) { socket.end(); return; }
      socket.write(payload, () => { sent++; logSent(); setTimeout(tick, interval || 50); });
    };
    tick();
  });
  socket.on("data", (d) => console.log(`[fake-lgo] robot replied ${d.length} bytes`));
  socket.on("close", () => console.log("[fake-lgo] done (connection closed)"));
  socket.on("error", onError);
} else {
  // A fresh connection per order (simulates per-dispense connections).
  const sendOne = () => {
    const socket = net.connect({ host, port }, () => {
      socket.write(payload, () => {
        sent++; logSent();
        socket.end();
        if (sent < repeat) setTimeout(sendOne, interval || 50);
      });
    });
    socket.on("data", (d) => console.log(`[fake-lgo] robot replied ${d.length} bytes`));
    socket.on("error", onError);
  };
  sendOne();
}
