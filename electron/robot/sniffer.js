// Robot traffic sniffer + outbound trigger.
//
// Two capture strategies, picked at start():
//
// 1. Npcap passive sniff (preferred when `cap` npm is installed):
//      Reads every packet on the configured TCP port without sitting in the
//      data path. The robot keeps receiving its traffic untouched, the LGO
//      doesn't notice anything, and we just observe.
//
// 2. TCP listen fallback (always available):
//      Asclion listens on the configured port. The LGO must be reconfigured
//      to talk to THIS PC instead of the robot — Asclion forwards the bytes
//      to the real robot transparently and extracts the EAN on the fly.
//      Only used when Npcap is unavailable or the user opts out.
//
// On a successful EAN extraction we POST to
//     http://<sourceIp or configured target>:<httpPort>/trigger
// so every pharmacy PC running Asclion lights up its widget.
//
// IMPORTANT: a failure in this module must never bring down Electron.
// All async I/O is wrapped in try/catch and surfaced via getStatus().

const http = require("http");
const net = require("net");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const adapters = require("./adapters");
const { TcpReassembler, flowKeyFromMeta, parseIpv4TcpPacket } = require("./reassembler");

// Per-flow TCP reassembler shared by all three capture backends. It recombines
// segments so the adapter always sees a COMPLETE <WWKS>…</WWKS> frame, even when
// the dispense order is split across several packets. Reset on every stop().
const reassembler = new TcpReassembler();

let cap = null;
let capLoadError = null;
try {
  cap = require("cap"); // optional dep — fine if it's not installed
} catch (e) {
  capLoadError = e && e.message;
}

const state = {
  started: false,
  mode: "idle",          // idle | npcap | tcp-listen | disabled
  brand: "none",
  port: 0,
  adapter: null,
  tcpServer: null,
  npcapSession: null,
  windivertProc: null,   // child powershell.exe running the WinDivert capture
  diagnosticLogPath: null,
  lastError: null,
  lastEanAt: 0,
  lastEan: null,
  triggersSent: 0,
  forwardErrors: 0,
  packetsSeen: 0,
  captureDirection: "outbound",
  passiveOnly: true,
};

let runtimeRefs = {
  log: (..._args) => {},
  warn: (..._args) => {},
  // emitGlobalScan(code, "robot") — same pipeline as a HID scan, used by the
  // listener PC that is *also* the robot server so we don't make a useless
  // network hop to localhost.
  onLocalTrigger: (_code) => {},
  // Folder that holds robot_capture.log (DiagnosticAdapter)
  userDataDir: null,
  // Folder holding the WinDivert assets (WinDivert.dll, WinDivert64.sys) and
  // the windivert-capture.ps1 helper script. Resolved by main.js (handles the
  // app.asar → app.asar.unpacked swap in packaged builds).
  windivertDir: null,
  // Shared secret sent with every POST /trigger toward peer Asclion PCs.
  // Must match the token configured on the receiving PC.
  httpToken: "",
};

function init({ log, warn, onLocalTrigger, userDataDir, windivertDir, httpToken }) {
  runtimeRefs.log = log || runtimeRefs.log;
  runtimeRefs.warn = warn || runtimeRefs.warn;
  runtimeRefs.onLocalTrigger = onLocalTrigger || runtimeRefs.onLocalTrigger;
  runtimeRefs.userDataDir = userDataDir || runtimeRefs.userDataDir;
  if (windivertDir) runtimeRefs.windivertDir = windivertDir;
  if (typeof httpToken === "string") runtimeRefs.httpToken = httpToken;
}

function buildAdapter(brand, opts) {
  if (brand === "diagnostic") {
    const logPath = path.join(runtimeRefs.userDataDir || ".", "robot_capture.log");
    state.diagnosticLogPath = logPath;
    return adapters.createAdapter("diagnostic", { logPath });
  }
  if (brand === "generic") {
    return adapters.createAdapter("generic", { pattern: opts.regex });
  }
  return adapters.createAdapter(brand);
}

function start(config) {
  stop(); // idempotent — restart on every config change
  const robot = (config && config.robot) || {};
  state.brand = robot.brand || "none";
  state.port = Number(robot.port) || 0;
  state.captureDirection = (robot.captureDirection || "outbound").toLowerCase();
  // Passive-only is the default and the only mode the connection wizard ever
  // saves: capture must never sit in the LGO↔robot data path. Missing on legacy
  // configs → treated as true (deepMergeDefaults backfills it anyway).
  state.passiveOnly = robot.passiveOnly !== false;
  state.lastError = null;

  if (!robot.enabled || state.brand === "none") {
    state.mode = "disabled";
    return state;
  }
  if (!state.port || state.port < 1 || state.port > 65535) {
    state.lastError = `invalid port ${robot.port}`;
    state.mode = "disabled";
    return state;
  }

  state.adapter = buildAdapter(state.brand, robot);
  if (!state.adapter) {
    state.lastError = `unknown brand "${state.brand}"`;
    state.mode = "disabled";
    return state;
  }

  // Capture backend selection. "auto" walks the list in order of preference
  // and falls through on failure, so an install with no WinDivert assets and
  // no Npcap still lands on the TCP-listen fallback exactly like before.
  //
  //   windivert  — bundled signed driver, per-till passive capture (preferred)
  //   npcap      — passive sniff, needs the separate Npcap installer
  //   tcp-listen — MITM proxy, needs the LGO repointed at this PC
  const backend = (robot.captureBackend || "auto").toLowerCase();
  const wantWinDivert = backend === "windivert" || backend === "auto";
  // Npcap historically skipped diagnostic mode (TCP-listen made the capture
  // trace cleaner). WinDivert passive capture is strictly better for
  // reverse-engineering an unknown robot (no LGO reconfig), so it is allowed
  // for diagnostic too — only the legacy Npcap path keeps the old exclusion.
  const wantNpcap = (backend === "npcap" || backend === "auto") &&
    robot.useNpcap !== false && state.brand !== "diagnostic";

  // 1. WinDivert — reads THIS PC's outbound dispense packets without an
  //    installer, without reconfiguring the LGO, and without sitting in the
  //    data path (passive SNIFF mode: the robot keeps receiving everything).
  if (wantWinDivert) {
    if (startWinDivert(robot)) {
      state.mode = "windivert";
      state.started = true;
      runtimeRefs.log(`[ROBOT] sniffer started (windivert, port ${state.port}, brand ${state.brand})`);
      return state;
    }
    // Fall through — lastError carries why (assets missing, open failed, …).
  }

  // 2. Npcap passive sniff.
  if (wantNpcap && cap) {
    const ok = startNpcap();
    if (ok) {
      state.mode = "npcap";
      state.started = true;
      runtimeRefs.log(`[ROBOT] sniffer started (npcap, port ${state.port}, brand ${state.brand})`);
      return state;
    }
    // Fall through to TCP listen on failure.
  } else if (wantNpcap && !cap) {
    runtimeRefs.warn(`[ROBOT] npcap requested but cap module unavailable: ${capLoadError || "not installed"}`);
  }

  // 3. TCP-listen MITM fallback. This is the ONE backend that sits in the data
  //    path (the LGO must be repointed at this PC and we forward to the robot),
  //    so it is gated behind passiveOnly: in the default passive-only mode we
  //    refuse it and report a clear error instead of silently becoming a relay.
  //    An explicit captureBackend:"tcp-listen" (dev/QA, see TESTING-robot.md)
  //    still opts in deliberately.
  const explicitTcp = backend === "tcp-listen";
  if (state.passiveOnly && !explicitTcp) {
    state.mode = "disabled";
    state.started = false;
    if (!state.lastError) {
      state.lastError =
        "capture passive indisponible (WinDivert/Npcap) — relais tcp-listen bloqué par le mode passif. " +
        "Lance Asclion en administrateur (driver WinDivert) ou installe Npcap.";
    }
    runtimeRefs.warn(`[ROBOT] passive-only: tcp-listen relay refused (${state.lastError})`);
    return state;
  }

  const ok = startTcpListen(robot);
  if (ok) {
    state.mode = "tcp-listen";
    state.started = true;
    runtimeRefs.log(`[ROBOT] sniffer started (tcp-listen, port ${state.port}, brand ${state.brand})`);
  } else {
    state.mode = "disabled";
  }
  return state;
}

function stop() {
  if (state.tcpServer) {
    try { state.tcpServer.close(); } catch { /* ignore */ }
    state.tcpServer = null;
  }
  if (state.npcapSession) {
    try { state.npcapSession.close(); } catch { /* ignore */ }
    state.npcapSession = null;
  }
  if (state.windivertProc) {
    // SIGKILL the helper: WinDivert releases its driver handle on process exit,
    // so a hard kill is clean. (The blocking WinDivertRecv() in the script
    // can't be interrupted politely from here anyway.)
    try { state.windivertProc.kill(); } catch { /* ignore */ }
    state.windivertProc = null;
  }
  state.started = false;
  state.mode = "idle";
  // Drop any half-assembled frames so a restart never glues bytes from the old
  // session onto the new one.
  reassembler.reset();
}

function getStatus() {
  return {
    started: state.started,
    mode: state.mode,
    brand: state.brand,
    port: state.port,
    lastError: state.lastError,
    lastEan: state.lastEan,
    lastEanAt: state.lastEanAt || null,
    triggersSent: state.triggersSent,
    forwardErrors: state.forwardErrors,
    packetsSeen: state.packetsSeen,
    captureDirection: state.captureDirection,
    passiveOnly: state.passiveOnly,
    npcapAvailable: !!cap,
    npcapLoadError: capLoadError,
    windivertAvailable: windivertAssetsPresent(),
    windivertRunning: !!state.windivertProc,
    diagnosticLogPath: state.diagnosticLogPath,
  };
}

// Are the bundled WinDivert binaries present? Used by getStatus() so the
// Paramètres UI can tell "driver missing" apart from "driver failed to open".
function windivertAssetsPresent() {
  const dir = runtimeRefs.windivertDir;
  if (!dir) return false;
  try {
    return fs.existsSync(path.join(dir, "WinDivert.dll")) &&
      fs.existsSync(path.join(dir, "windivert-capture.ps1"));
  } catch {
    return false;
  }
}

// ───── Npcap passive sniff ───────────────────────────────────────────
function startNpcap() {
  try {
    const { Cap, decoders } = cap;
    const PROTOCOL = decoders.PROTOCOL;
    const session = new Cap();
    // Pick the first IPv4 device that is up — keep it simple. The pharmacist
    // can override later if multi-NIC scenarios appear in the field.
    const devices = Cap.deviceList() || [];
    const iface = devices.find((d) => (d.addresses || []).some((a) => a.addr && /\d+\.\d+\.\d+\.\d+/.test(a.addr)));
    if (!iface) {
      state.lastError = "npcap: no usable network interface";
      return false;
    }
    const filter = `tcp dst port ${state.port}`;
    const bufSize = 10 * 1024 * 1024;
    const buffer = Buffer.alloc(65535);
    const linkType = session.open(iface.name, filter, bufSize, buffer);

    session.on("packet", (nbytes /*, trunc */) => {
      state.packetsSeen++;
      try {
        if (linkType !== "ETHERNET") return;
        const ret = decoders.Ethernet(buffer);
        if (ret.info.type !== PROTOCOL.ETHERNET.IPV4) return;
        const ipv4 = decoders.IPV4(buffer, ret.offset);
        if (ipv4.info.protocol !== PROTOCOL.IP.TCP) return;
        const tcp = decoders.TCP(buffer, ipv4.offset);
        const payloadLen = ipv4.info.totallen - (ipv4.hdrlen + tcp.hdrlen);
        if (payloadLen <= 0) return;
        const payload = buffer.slice(tcp.offset, tcp.offset + payloadLen);
        const flowKey = `${ipv4.info.srcaddr}:${tcp.info.srcport}>${ipv4.info.dstaddr}:${tcp.info.dstport}`;
        handlePayload(payload, ipv4.info.srcaddr, flowKey);
      } catch (e) {
        state.lastError = `npcap packet decode: ${e && e.message}`;
      }
    });

    state.npcapSession = session;
    return true;
  } catch (e) {
    state.lastError = `npcap start: ${e && e.message}`;
    return false;
  }
}

// ───── WinDivert passive capture (bundled signed driver) ─────────────
// Spawns a PowerShell helper that P/Invokes WinDivert.dll and streams each
// captured packet back as one JSON line on stdout: {"b64":"<base64>","len":N}.
// We pick PowerShell + P/Invoke (not a node-gyp native addon) so there is NO
// compiler / SDK / Electron-ABI dependency — only the two bundled WinDivert
// binaries. The helper is a child process, so a driver fault can never take
// down Electron. Returns true if the helper was spawned, false otherwise
// (assets missing, wrong platform, spawn error) so start() can fall through.
function startWinDivert(robot) {
  if (process.platform !== "win32") {
    state.lastError = "windivert: Windows only";
    return false;
  }
  const dir = runtimeRefs.windivertDir;
  if (!dir) {
    state.lastError = "windivert: asset directory not configured";
    return false;
  }
  const dll = path.join(dir, "WinDivert.dll");
  const script = path.join(dir, "windivert-capture.ps1");
  if (!fs.existsSync(dll)) {
    // Most common first-run case: binaries not downloaded yet. Quiet warn —
    // start() will fall through to npcap / tcp-listen.
    state.lastError = `windivert: WinDivert.dll not found in ${dir} (vendored binary missing — see native/windivert/README.md)`;
    return false;
  }
  if (!fs.existsSync(script)) {
    state.lastError = `windivert: capture script not found in ${dir}`;
    return false;
  }

  try {
    const args = [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", script,
      "-DllPath", dll,
      "-Port", String(state.port),
      // Per-till model: capture the dispense order this PC SENDS to the robot
      // server. "outbound" is also how WinDivert reports loopback traffic, so
      // the local desk-test harness works too. Overridable for the rare site
      // where the link runs the other way.
      "-Direction", robot.captureDirection || "outbound",
    ];
    // Optional: pin the filter to the robot server's IP so we never capture
    // unrelated traffic that happens to share the port.
    if (robot.robotServerIp) args.push("-DstIp", String(robot.robotServerIp));

    const child = spawn("powershell.exe", args, { windowsHide: true });
    state.windivertProc = child;

    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d.toString("utf-8");
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) handleWinDivertLine(line);
      }
    });
    child.stderr.on("data", (d) => {
      const msg = d.toString("utf-8").trim();
      if (!msg) return;
      state.lastError = `windivert: ${msg.slice(0, 200)}`;
      runtimeRefs.warn(`[ROBOT] windivert stderr: ${msg}`);
    });
    child.on("error", (err) => {
      state.lastError = `windivert spawn: ${err && err.message}`;
      runtimeRefs.warn(`[ROBOT] windivert spawn error: ${err && err.message}`);
    });
    child.on("exit", (code, signal) => {
      if (state.windivertProc === child) state.windivertProc = null;
      // code 0 / SIGTERM (our own stop()) is expected; anything else is a fault.
      if (code && code !== 0) {
        state.lastError = `windivert helper exited with code ${code}`;
        runtimeRefs.warn(`[ROBOT] windivert helper exited code=${code} signal=${signal || "-"}`);
      }
    });

    return true;
  } catch (e) {
    state.lastError = `windivert start: ${e && e.message}`;
    return false;
  }
}

function handleWinDivertLine(line) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    // The helper only ever emits JSON on stdout; ignore stray text.
    return;
  }
  if (obj.status) {
    runtimeRefs.log(`[ROBOT] windivert: ${obj.status}`);
    return;
  }
  if (typeof obj.b64 !== "string") return;
  let payload;
  try {
    payload = Buffer.from(obj.b64, "base64");
  } catch {
    return;
  }
  if (!payload.length) return;
  // The helper hands us the WHOLE captured packet (IP + TCP headers + payload).
  // For inbound capture on the robot-server PC, preserve the source till IP so
  // fanoutTrigger() can notify that checkout PC. For per-till outbound capture,
  // keep loopback to avoid POSTing a duplicate trigger back to ourselves.
  const meta = parseIpv4TcpPacket(payload);
  const sourceIp = state.captureDirection === "inbound" && meta?.dstPort === state.port
    ? meta.srcAddress
    : "127.0.0.1";
  // Feed the TCP application bytes (not the IP/TCP headers) to the reassembler so
  // multi-packet WWKS2 frames glue back together cleanly. Headerless packets
  // (pure ACKs) carry no payload — skip them. Fall back to the whole packet only
  // if the parser couldn't read the headers.
  if (meta) {
    if (!meta.payload || meta.payload.length === 0) return;
    handlePayload(meta.payload, sourceIp, flowKeyFromMeta(meta));
  } else {
    handlePayload(payload, sourceIp, "_");
  }
}

// parseIpv4TcpPacket now lives in ./reassembler (returns the payload slice too)
// and is imported at the top of this file.

// ───── TCP listen fallback ───────────────────────────────────────────
function startTcpListen(robot) {
  try {
    const allowed = Array.isArray(robot.allowedClientIps)
      ? robot.allowedClientIps.filter((s) => typeof s === "string" && s.length > 0)
      : [];
    // Trailing safety net: if the operator listed a targetIp (forward mode),
    // implicitly trust that IP too — it's the only peer that should ever talk
    // to this socket under normal operation.
    if (robot.targetIp && !allowed.includes(robot.targetIp)) allowed.push(robot.targetIp);

    const server = net.createServer((socket) => {
      const peerIp = normalizeIp(socket.remoteAddress);
      // Whitelist enforcement: if `allowedClientIps` is non-empty, drop any
      // socket from an IP that doesn't appear in the list. This is what
      // prevents a hostile LAN peer (or guest Wi-Fi user) from injecting
      // fake dispense orders straight into the local robot pipeline.
      if (allowed.length > 0 && !allowed.includes(peerIp)) {
        runtimeRefs.warn(`[ROBOT] rejected TCP connection from ${peerIp} (not in allow-list)`);
        try { socket.destroy(); } catch { /* noop */ }
        return;
      }

      // If a targetIp is configured, we forward bytes to the real robot so
      // the LGO never notices the man-in-the-middle. Without targetIp we
      // simply absorb the data (useful for the diagnostic adapter).
      let upstream = null;
      const upstreamHost = robot.targetIp || null;
      const upstreamPort = robot.targetPort || state.port;
      if (upstreamHost) {
        upstream = net.connect({ host: upstreamHost, port: upstreamPort });
        upstream.on("error", (err) => {
          state.forwardErrors++;
          runtimeRefs.warn(`[ROBOT] upstream error: ${err && err.message}`);
        });
        socket.pipe(upstream);
        upstream.pipe(socket);
      }
      const flowKey = `${peerIp}:${socket.remotePort || 0}>local:${socket.localPort || 0}`;
      socket.on("data", (chunk) => {
        state.packetsSeen++;
        handlePayload(chunk, peerIp, flowKey);
      });
      socket.on("close", () => {
        // Flush any buffered (non-WWKS-delimited) trailing bytes so a document
        // that closes without a tracked end-tag still gets one extraction pass.
        if (state.brand !== "diagnostic") {
          for (const msg of reassembler.flush(flowKey)) triggerFromMessage(msg, peerIp);
        }
      });
      socket.on("error", (err) => {
        state.lastError = `tcp socket: ${err && err.message}`;
      });
    });
    server.on("error", (err) => {
      state.lastError = `tcp listen: ${err && err.message}`;
      runtimeRefs.warn(`[ROBOT] TCP listen error: ${err && err.message}`);
    });
    server.listen(state.port, "0.0.0.0", () => {
      runtimeRefs.log(
        `[ROBOT] TCP listen on 0.0.0.0:${state.port}` +
        (allowed.length > 0 ? ` (allowed peers: ${allowed.join(", ")})` : " (no peer allow-list — accept all LAN)")
      );
    });
    state.tcpServer = server;
    return true;
  } catch (e) {
    state.lastError = `tcp listen start: ${e && e.message}`;
    return false;
  }
}

function normalizeIp(raw) {
  if (!raw) return "";
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

// ───── Common payload handler ────────────────────────────────────────
// Same code seen again within this window is treated as a retransmit/echo of the
// same dispense, not a new one, so the widget pops exactly once.
const DEDUP_WINDOW_MS = 1200;

function handlePayload(payload, sourceIp, flowKey) {
  if (!state.adapter) return;
  // Diagnostic mode must see every raw byte (its whole job is to dump the wire),
  // so it bypasses reassembly. Real adapters receive complete WWKS2 frames.
  const messages = state.brand === "diagnostic"
    ? [payload]
    : reassembler.push(flowKey || "_", payload);
  for (const msg of messages) triggerFromMessage(msg, sourceIp);
}

// Extract a code from ONE already-complete message (raw packet in diagnostic
// mode, or a reassembled WWKS2 frame) and fire the trigger once. Kept separate
// from handlePayload so the tcp-listen close-flush can feed pre-reassembled
// frames without pushing them back through the reassembler.
function triggerFromMessage(msg, sourceIp) {
  let ean = null;
  try {
    ean = state.adapter.extractEan(msg);
  } catch (e) {
    state.lastError = `adapter ${state.brand} threw: ${e && e.message}`;
    return;
  }
  if (!ean) return;
  const now = Date.now();
  if (ean === state.lastEan && now - state.lastEanAt < DEDUP_WINDOW_MS) {
    state.lastEanAt = now; // refresh so a burst stays collapsed
    return;
  }
  state.lastEan = ean;
  state.lastEanAt = now;
  state.triggersSent++;
  runtimeRefs.log(`[ROBOT] EAN extracted: ${ean} (source ${sourceIp || "?"})`);
  fanoutTrigger(ean, sourceIp);
}

function fanoutTrigger(ean, sourceIp) {
  // Always feed the local pipeline so this PC (which is most often the only
  // one in the officine) sees the recommendation without needing the network.
  try { runtimeRefs.onLocalTrigger(ean); } catch (e) {
    runtimeRefs.warn(`[ROBOT] local trigger failed: ${e && e.message}`);
  }
  // Then notify the source IP (the PC that sent the dispense order) — that's
  // the pharmacist's till in pharmacies with several POS. Localhost / unknown
  // sources are skipped because the local trigger already fired.
  if (!sourceIp || sourceIp === "127.0.0.1" || sourceIp === "::1") return;
  postTrigger(sourceIp, ean);
}

function postTrigger(ip, ean) {
  const body = JSON.stringify({ ean });
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "X-Asclion-Source": "robot",
  };
  // Shared secret — peer listener REJECTS the trigger with 401 if missing or
  // mismatched. Acts as a soft authentication boundary on top of the LAN
  // perimeter (which is the only network the listener should ever see).
  if (runtimeRefs.httpToken) headers["X-Asclion-Token"] = runtimeRefs.httpToken;

  const req = http.request(
    {
      host: ip,
      port: 5150, // fixed listener port (other PCs may use a different one, but 5150 is the default)
      path: "/trigger",
      method: "POST",
      headers,
      timeout: 1500,
    },
    (res) => {
      // Drain the response so the socket is freed.
      res.on("data", () => {});
      res.on("end", () => {});
    },
  );
  req.on("error", (err) => {
    state.forwardErrors++;
    runtimeRefs.warn(`[ROBOT] POST /trigger ${ip} failed: ${err && err.message}`);
  });
  req.on("timeout", () => req.destroy(new Error("timeout")));
  req.write(body);
  req.end();
}

module.exports = {
  init,
  start,
  stop,
  getStatus,
};
