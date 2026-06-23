// Pure helpers for the robot connection wizard.
//
// The Electron side exposes three discovery probes, each returning raw rows:
//   - robot.autoDetectPort()  → live WinDivert capture (authoritative: it only
//     reports ports that actually carried traffic, with a payloadHit flag when
//     the bytes looked like a dispense order)
//   - robot.discoverPort()    → instant Get-NetTCPConnection snapshot of every
//     established TCP link (good even when no capture driver is available)
//   - robot.discoverPipes()   → local Named Pipes whose name evokes a robot
//
// This module merges those into a single, de-duplicated, confidence-ranked list
// the wizard renders. It is intentionally free of any Electron/DOM dependency so
// it can be unit-tested in isolation (see src/test/robotDiscovery.test.ts).

export type CaptureDirection = "inbound" | "outbound" | "both";

// Loose shape covering the rows from both TCP probes. Fields are optional
// because discoverPort and autoDetectPort don't populate exactly the same set.
export interface RawTcpCandidate {
  process?: string;
  pid?: number;
  remoteAddress?: string;
  remotePort?: number;
  localPort?: number;
  robotServerIp?: string;
  captureDirection?: CaptureDirection;
  isLgo?: boolean;
  isKnownRobotPort?: boolean;
  score?: number;
  packets?: number;
  payloadBytes?: number;
  payloadHits?: number;
}

export interface RawPipeCandidate {
  kind?: "pipe";
  pipeName: string;
  score?: number;
}

export interface DiscoveryCandidate {
  id: string;
  kind: "tcp" | "pipe";
  label: string;
  sublabel: string;
  confidence: number; // 0..100
  reasons: string[];
  // TCP-only
  robotServerIp?: string;
  port?: number;
  captureDirection?: CaptureDirection;
  process?: string;
  // Pipe-only
  pipeName?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Did the live capture flag a dispense-looking payload on this candidate?
// autoDetectPort reports it as a payloadHits counter; treat any positive as a hit.
function hasPayloadHit(c: RawTcpCandidate): boolean {
  return (Number(c.payloadHits) || 0) > 0;
}

// Map the raw signals of a TCP candidate to a 0..100 confidence. Deterministic
// and additive so it is easy to reason about and to test. The three strongest
// signals — a captured dispense payload, a recognised LGO process, and a known
// robot port — can stack toward near-certainty.
export function tcpConfidence(c: RawTcpCandidate): number {
  let s = 28;
  if (hasPayloadHit(c)) s += 38; // capture saw an actual dispense-shaped frame
  if (c.isLgo) s += 26; // owning process matches a known LGO
  if (c.isKnownRobotPort) s += 22; // remote port is a documented robot port
  if ((Number(c.packets) || 0) >= 2) s += 8; // sustained, not a one-off SYN
  if ((Number(c.payloadBytes) || 0) > 0) s += 6; // carried application data
  return clamp(Math.round(s), 5, 99);
}

function tcpReasons(c: RawTcpCandidate): string[] {
  const reasons: string[] = [];
  if (hasPayloadHit(c)) reasons.push("Trame de délivrance détectée");
  if (c.isLgo) reasons.push(`Processus LGO reconnu${c.process ? ` (${c.process})` : ""}`);
  if (c.isKnownRobotPort && c.remotePort) reasons.push(`Port robot connu (${c.remotePort})`);
  if ((Number(c.packets) || 0) > 0) reasons.push(`${c.packets} paquet(s) observé(s)`);
  if (reasons.length === 0) reasons.push("Connexion TCP active");
  return reasons;
}

function dirLabel(d?: CaptureDirection): string {
  if (d === "inbound") return "entrant (ce PC = serveur robot)";
  if (d === "outbound") return "sortant (ce PC = caisse)";
  if (d === "both") return "bidirectionnel";
  return "";
}

// Stable de-dup key for a TCP candidate: the robot endpoint it points at.
export function tcpKey(c: RawTcpCandidate): string {
  const ip = (c.robotServerIp || c.remoteAddress || "?").trim();
  const port = Number(c.remotePort) || 0;
  return `${ip}:${port}`;
}

// Merge the live capture rows and the connection-table rows on their robot
// endpoint, keeping the richest signal from each and unioning their reasons.
function mergeTcp(live: RawTcpCandidate[], conns: RawTcpCandidate[]): DiscoveryCandidate[] {
  const byKey = new Map<string, { merged: RawTcpCandidate; reasons: Set<string> }>();

  const absorb = (rows: RawTcpCandidate[]) => {
    for (const row of rows || []) {
      const port = Number(row.remotePort) || 0;
      if (!port || port < 1 || port > 65535) continue;
      const key = tcpKey(row);
      const entry = byKey.get(key);
      if (!entry) {
        byKey.set(key, { merged: { ...row }, reasons: new Set(tcpReasons(row)) });
        continue;
      }
      // Union the boolean/numeric signals so a candidate seen by BOTH probes
      // (active connection AND captured payload) scores as high as it deserves.
      const m = entry.merged;
      m.isLgo = m.isLgo || row.isLgo;
      m.isKnownRobotPort = m.isKnownRobotPort || row.isKnownRobotPort;
      m.packets = Math.max(Number(m.packets) || 0, Number(row.packets) || 0);
      m.payloadBytes = Math.max(Number(m.payloadBytes) || 0, Number(row.payloadBytes) || 0);
      m.payloadHits = Math.max(Number(m.payloadHits) || 0, Number(row.payloadHits) || 0);
      if (!m.robotServerIp && row.robotServerIp) m.robotServerIp = row.robotServerIp;
      if (!m.captureDirection && row.captureDirection) m.captureDirection = row.captureDirection;
      if (!m.process || m.process === "capture-live") m.process = row.process || m.process;
      for (const r of tcpReasons(row)) entry.reasons.add(r);
    }
  };
  absorb(live);
  absorb(conns);

  return Array.from(byKey.values()).map(({ merged, reasons }) => {
    const ip = (merged.robotServerIp || merged.remoteAddress || "").trim();
    const port = Number(merged.remotePort) || 0;
    const dir = dirLabel(merged.captureDirection);
    return {
      id: `tcp:${tcpKey(merged)}`,
      kind: "tcp" as const,
      label: `TCP ${ip || "?"} : ${port}`,
      sublabel: [merged.process && merged.process !== "capture-live" ? merged.process : null, dir || null]
        .filter(Boolean)
        .join(" · "),
      confidence: tcpConfidence(merged),
      reasons: Array.from(reasons),
      robotServerIp: ip || undefined,
      port,
      captureDirection: merged.captureDirection,
      process: merged.process,
    };
  });
}

function mapPipes(pipes: RawPipeCandidate[]): DiscoveryCandidate[] {
  const seen = new Set<string>();
  const out: DiscoveryCandidate[] = [];
  for (const p of pipes || []) {
    const name = String(p?.pipeName || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `pipe:${key}`,
      kind: "pipe",
      label: `Pipe \\\\.\\pipe\\${name}`,
      sublabel: "Named Pipe local — piste (la capture reste sur le flux TCP)",
      // Pipes are a weak, informational signal: the dispense link is virtually
      // always TCP, so we cap them below any real TCP candidate.
      confidence: 30,
      reasons: ["Nom de pipe évoquant un robot"],
      pipeName: name,
    });
  }
  return out;
}

export interface MergeInput {
  live?: RawTcpCandidate[];
  conns?: RawTcpCandidate[];
  pipes?: RawPipeCandidate[];
}

// Produce the final ranked candidate list for the wizard. TCP candidates always
// sort above pipes; within a kind, higher confidence first, then a stable
// tie-break on the label so the order is deterministic across runs (and tests).
export function mergeDiscoveryResults(input: MergeInput, limit = 6): DiscoveryCandidate[] {
  const tcp = mergeTcp(input.live || [], input.conns || []);
  const pipes = mapPipes(input.pipes || []);
  const all = [...tcp, ...pipes];
  all.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "tcp" ? -1 : 1;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.label.localeCompare(b.label);
  });
  return all.slice(0, Math.max(1, limit));
}

export function confidenceTone(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 80) return "high";
  if (confidence >= 55) return "medium";
  return "low";
}
