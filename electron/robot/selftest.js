// One-click robot self-test orchestrator.
//
// Goal: the pharmacist presses ONE button and gets a single, unambiguous verdict:
//   ✅  the caisse↔serveur flux was found, capture is armed, and Asclion will read
//       the next dispense of this till   (status "ok", working:true)
//   ❌  it does not work — with a plain-language reason and what to do next
//       (status "no_capture" | "no_traffic" | "traffic_no_ean" | "error")
//
// HOW IT WORKS (100 % passive — never inserts itself in the LGO↔robot path):
//   1. Capability check — Windows + bundled WinDivert + admin rights.
//   2. Quick netstat pre-scan (robot:discover-port) to surface an existing
//      caisse↔serveur TCP link early ("flux candidat trouvé").
//   3. A single passive WinDivert capture window (windivert-port-scan.ps1). The
//      pharmacist triggers one real dispense; every TCP segment is reassembled
//      per flow (electron/robot/reassembler.js) and run through the brand-agnostic
//      WWKS2 extractor. The FIRST flow that yields a code wins.
//   4. Classify the outcome and return the verdict. main.js persists the winning
//      {port, serverIp, direction} so production capture is armed immediately.
//
// This module owns NO config and NO Electron objects — main.js injects every
// dependency (paths, helpers, an emit callback). That keeps it unit-testable and
// impossible to crash Electron from here.

"use strict";

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const { TcpReassembler, parseIpv4TcpPacket, flowKeyFromMeta } = require("./reassembler");

const KNOWN_ROBOT_PORTS = new Set([9876, 6100, 6200, 5000, 12000, 8080, 9100, 4444]);
const NOISE_PORTS = new Set([53, 80, 123, 135, 137, 138, 139, 389, 443, 445, 3389, 5353, 5355]);

function isRobotPortCandidate(port) {
  return port > 1024 && port < 20000 && !NOISE_PORTS.has(port);
}

// RFC1918 + loopback. A public IP is never the robot (it's background Internet
// traffic), so we never classify or report it as a candidate.
function isLanOrLoopback(ip) {
  if (typeof ip !== "string" || !ip) return false;
  if (ip === "::1" || ip.startsWith("127.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) { const o = Number(m[1]); return o >= 16 && o <= 31; }
  return false;
}

function classifyFrame(text) {
  if (/<WWKS|OutputMessage|OutputRequest/i.test(text)) return "wwks2";
  if (/<\?xml|<[A-Za-z]/.test(text)) return "xml";
  return "raw";
}

// Map a raw WinDivert/PowerShell failure to a friendly message + admin hint.
function friendlyCaptureError(err) {
  const e = (err || "").toLowerCase();
  if (e.includes("win32=5") || e.includes("access") || e.includes("denied") || e.includes("administrat")) {
    return { message: "Le driver de capture WinDivert n'a pas pu démarrer (droits administrateur requis).", needsAdmin: true };
  }
  if (e.includes("win32=2") || e.includes(".sys") || e.includes(".dll") || e.includes("loadlibrary")) {
    return { message: "Les binaires WinDivert sont absents ou bloqués. Réinstalle Asclion depuis l'installeur le plus récent.", needsAdmin: false };
  }
  return { message: err ? String(err).slice(0, 200) : "Erreur inconnue pendant la capture.", needsAdmin: false };
}

// Normalise a verdict object with safe defaults so the renderer can rely on the
// shape regardless of which branch produced it.
function verdict(v) {
  return Object.assign({
    ok: false,
    working: false,
    status: "error",
    ean: null,
    frame: null,
    port: null,
    serverIp: null,
    captureDirection: null,
    packets: 0,
    payloadBytes: 0,
    sawWwks: false,
    needsAdmin: false,
    reason: "",
    advice: "",
  }, v);
}

async function safe(fn, fallback) {
  try { return await fn(); } catch { return fallback; }
}

// Run the passive capture window. Resolves on the first extracted code, on
// timeout, or on a spawn/driver error. Never rejects.
function captureLoop({ dll, script, captureMs, localIps, extractAnyEan, emit, warn }) {
  return new Promise((resolve) => {
    const reasm = new TcpReassembler();
    const flows = new Map(); // `${serverIp}:${serverPort}` -> { port, serverIp, captureDirection, packets, payloadBytes, sawWwks }
    let totalPackets = 0;
    let totalPayload = 0;
    let resolved = false;
    let child;

    const done = (extra) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try { child && child.kill(); } catch { /* noop */ }
      resolve(Object.assign({ totalPackets, totalPayload, flows }, extra));
    };

    try {
      child = spawn("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
        "-File", script,
        "-DllPath", dll,
        "-DurationSec", String(Math.ceil(captureMs / 1000)),
      ], { windowsHide: true });
    } catch (e) {
      resolve({ totalPackets: 0, totalPayload: 0, flows, error: `spawn: ${e && e.message}` });
      return;
    }

    const timer = setTimeout(() => done({}), captureMs + 6000);
    let stderr = "";
    let buf = "";

    child.stdout.on("data", (d) => {
      buf += d.toString("utf-8");
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;

        let obj;
        try { obj = JSON.parse(line); } catch { continue; }
        if (obj.status) continue;        // {"status":"open filter=..."}
        if (!obj.b64) continue;

        const meta = parseIpv4TcpPacket(Buffer.from(obj.b64, "base64"));
        if (!meta || !meta.payload || meta.payload.length === 0) continue;
        // Stay on the local network: a WWKS dispense never rides a public IP.
        if (!isLanOrLoopback(meta.srcAddress) && !isLanOrLoopback(meta.dstAddress)) continue;

        totalPackets += 1;
        totalPayload += meta.payload.length;

        // Aggregate per robot endpoint (the side carrying a robot-ish port).
        const serverIsDst = isRobotPortCandidate(meta.dstPort);
        const serverIsSrc = isRobotPortCandidate(meta.srcPort);
        if (serverIsDst || serverIsSrc) {
          const serverIp = serverIsDst ? meta.dstAddress : meta.srcAddress;
          const serverPort = serverIsDst ? meta.dstPort : meta.srcPort;
          const key = `${serverIp}:${serverPort}`;
          const f = flows.get(key) || {
            port: serverPort, serverIp,
            captureDirection: localIps.has(meta.dstAddress) ? "inbound" : "outbound",
            packets: 0, payloadBytes: 0, sawWwks: false,
          };
          f.packets += 1;
          f.payloadBytes += meta.payload.length;
          flows.set(key, f);
          if ((totalPackets % 5) === 1) emit && emit("packet", { packets: totalPackets, payloadBytes: totalPayload });
        }

        // Reassemble this flow and try to read a code from each complete frame.
        let ean = null;
        let frameText = "";
        for (const frame of reasm.push(flowKeyFromMeta(meta), meta.payload)) {
          frameText = frame;
          if (/<WWKS|OutputMessage|OutputRequest/i.test(frame)) {
            const serverIp = serverIsDst ? meta.dstAddress : (serverIsSrc ? meta.srcAddress : meta.dstAddress);
            const serverPort = serverIsDst ? meta.dstPort : (serverIsSrc ? meta.srcPort : meta.dstPort);
            const fk = `${serverIp}:${serverPort}`;
            const f = flows.get(fk);
            if (f) f.sawWwks = true;
          }
          let code = null;
          try { code = extractAnyEan(frame); } catch { code = null; }
          if (code) { ean = code; break; }
        }

        if (ean) {
          done({ ean, frame: classifyFrame(frameText), meta });
          return;
        }
      }
    });

    child.stderr.on("data", (d) => { stderr += d.toString("utf-8"); });
    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve({ totalPackets, totalPayload, flows, error: `powershell: ${err && err.message}` });
    });
    child.on("close", () => {
      // Normal end of the capture window with nothing found, or an early driver
      // exit. Surface stderr only when we captured nothing at all.
      if (resolved) return;
      done(totalPackets === 0 && stderr.trim() ? { error: stderr.trim() } : {});
    });
  });
}

// opts = { windivertDir, extractAnyEan, detectElevation, discoverPort, localIps,
//          durationMs, emit(phase,extra), log, warn }
async function run(opts) {
  const {
    windivertDir, extractAnyEan, detectElevation, discoverPort,
    localIps, durationMs, emit, warn,
  } = opts || {};
  const send = (phase, extra = {}) => { try { emit && emit(phase, extra); } catch { /* noop */ } };

  if (process.platform !== "win32") {
    return verdict({ status: "no_capture", reason: "La capture passive n'est disponible que dans l'application Asclion sur Windows." });
  }
  if (typeof extractAnyEan !== "function") {
    return verdict({ status: "error", reason: "Extracteur d'adaptateurs robot indisponible." });
  }

  send("capability", { message: "Vérification des prérequis (driver, droits admin)…" });
  const dll = path.join(windivertDir || "", "WinDivert.dll");
  const script = path.join(windivertDir || "", "windivert-port-scan.ps1");
  if (!windivertDir || !fs.existsSync(dll) || !fs.existsSync(script)) {
    return verdict({
      status: "no_capture",
      reason: "Les binaires de capture passive (WinDivert) sont absents de l'installation.",
      advice: "Réinstalle Asclion depuis l'installeur le plus récent, puis relance le test.",
    });
  }

  const elevated = await safe(() => detectElevation(), false);
  if (!elevated) {
    return verdict({
      status: "no_capture",
      needsAdmin: true,
      reason: "Asclion n'est pas lancé en administrateur : le driver de capture passive ne peut pas démarrer.",
      advice: "Clique sur « Relancer en administrateur », puis recommence le test.",
    });
  }

  // Best-effort pre-scan: surface an existing caisse↔serveur TCP link so the UI
  // can say "flux candidat trouvé" before the pharmacist even dispenses.
  let preCandidate = null;
  if (typeof discoverPort === "function") {
    send("discover", { message: "Recherche du flux caisse ↔ serveur…" });
    const d = await safe(() => discoverPort(), { candidates: [] });
    const rows = (d && Array.isArray(d.candidates) ? d.candidates : [])
      .filter((c) => c && isLanOrLoopback(c.remoteAddress) && isRobotPortCandidate(Number(c.remotePort) || 0))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    if (rows[0]) {
      preCandidate = {
        port: Number(rows[0].remotePort) || 0,
        serverIp: rows[0].robotServerIp || rows[0].remoteAddress || null,
        process: rows[0].process || null,
        isLgo: !!rows[0].isLgo,
        isKnownRobotPort: !!rows[0].isKnownRobotPort,
      };
    }
  }

  const captureMs = Math.min(Math.max(Number(durationMs) || 60_000, 15_000), 90_000);
  send("waiting", {
    message: preCandidate
      ? `Flux candidat trouvé (${preCandidate.serverIp}:${preCandidate.port}). Déclenche une délivrance sur cette caisse…`
      : "En attente d'une délivrance sur cette caisse… déclenche une vraie sortie robot depuis le LGO.",
    deadlineMs: captureMs,
    preCandidate,
  });

  const cap = await captureLoop({ dll, script, captureMs, localIps: localIps || new Set(), extractAnyEan, emit: send, warn });
  send("done", { packets: cap.totalPackets, payloadBytes: cap.totalPayload });

  // ── Verdict ────────────────────────────────────────────────────────
  if (cap.ean) {
    const meta = cap.meta;
    const serverIsDst = isRobotPortCandidate(meta.dstPort);
    const serverIp = serverIsDst ? meta.dstAddress : meta.srcAddress;
    const port = serverIsDst ? meta.dstPort : meta.srcPort;
    const captureDirection = (localIps || new Set()).has(meta.dstAddress) ? "inbound" : "outbound";
    return verdict({
      ok: true,
      working: true,
      status: "ok",
      ean: cap.ean,
      frame: cap.frame,
      port,
      serverIp,
      captureDirection,
      packets: cap.totalPackets,
      payloadBytes: cap.totalPayload,
      sawWwks: cap.frame === "wwks2",
      reason: `Délivrance captée sur ${serverIp}:${port} et code médicament lu (${cap.ean}).`,
      advice: "Capture passive armée : Asclion lira automatiquement les prochaines délivrances de cette caisse.",
    });
  }

  if (cap.error) {
    const f = friendlyCaptureError(cap.error);
    return verdict({ status: "error", reason: f.message, needsAdmin: f.needsAdmin, packets: cap.totalPackets, payloadBytes: cap.totalPayload });
  }

  const robotFlows = Array.from(cap.flows.values()).filter((f) => f.payloadBytes > 0);
  if (robotFlows.length > 0) {
    const best = robotFlows.sort((a, b) => b.payloadBytes - a.payloadBytes)[0];
    const sawWwks = robotFlows.some((f) => f.sawWwks);
    return verdict({
      status: "traffic_no_ean",
      port: best.port,
      serverIp: best.serverIp,
      captureDirection: best.captureDirection,
      packets: cap.totalPackets,
      payloadBytes: cap.totalPayload,
      sawWwks,
      reason: `Du trafic a été observé sur ${best.serverIp}:${best.port}${sawWwks ? " (trames WWKS2 détectées)" : ""}, mais aucun code médicament n'a pu être lu pendant le test.`,
      advice: sawWwks
        ? "Soit aucune délivrance n'a été déclenchée pendant la fenêtre, soit le code n'est porté que sur la jambe serveur↔robot (pas caisse↔serveur), soit le tag d'article diffère. Active le mode Diagnostic pour journaliser les trames brutes, puis recommence."
        : "Le port répond mais sans trame de délivrance lisible. Déclenche une vraie sortie robot pendant le test, ou active le mode Diagnostic pour capturer un échantillon à analyser.",
    });
  }

  return verdict({
    status: "no_traffic",
    packets: cap.totalPackets,
    payloadBytes: cap.totalPayload,
    port: preCandidate ? preCandidate.port : null,
    serverIp: preCandidate ? preCandidate.serverIp : null,
    reason: preCandidate
      ? `Une connexion vers ${preCandidate.serverIp}:${preCandidate.port} existe, mais aucune trame n'a été captée pendant le test.`
      : "Aucun flux TCP robot n'a été capté pendant la fenêtre de test.",
    advice: "Lance ce test SUR le PC caisse, déclenche une vraie délivrance pendant la fenêtre, et vérifie que la liaison caisse↔serveur passe bien par TCP (un named pipe ou du loopback non routé n'est pas visible en capture réseau).",
  });
}

module.exports = { run, isLanOrLoopback, isRobotPortCandidate, classifyFrame, friendlyCaptureError, verdict };
