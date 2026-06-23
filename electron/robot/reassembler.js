// Per-flow TCP reassembly for XML-over-TCP robot protocols (WWKS2 first).
//
// WHY THIS EXISTS
//   The capture backends (WinDivert / Npcap / tcp-listen) hand us individual TCP
//   segments. A single WWKS2 dispense frame `<WWKS …>…</WWKS>` can be split
//   across several segments, or several frames can share one segment. Running the
//   EAN regex on each raw segment therefore MISSES any code that lands across a
//   packet boundary — the "Reassembly TCP" gap listed in ROBOT_INTEGRATION_PLAN.md
//   (Étape 4). This module buffers bytes per TCP flow and yields only COMPLETE
//   WWKS frames, so the adapter regex always sees a whole message.
//
// DESIGN
//   - Keyed per flow (srcIp:srcPort>dstIp:dstPort). A dispense order and its
//     response are two different flows and must not be concatenated.
//   - WWKS2-aware: a flow only enters buffered mode once a segment contains
//     `<WWKS`. We then accumulate until the matching `</WWKS>` and emit each
//     complete frame; the trailing partial frame stays buffered for the next
//     segment. Multiple frames in one buffer are all emitted.
//   - Everything else is PASSTHROUGH: a flow that never shows `<WWKS` returns
//     each segment unchanged — byte-for-byte identical to the pre-reassembly
//     behaviour, so element-style adapters (Pharmathek, legacy <EAN>) and the
//     diagnostic dump are unaffected. Short non-WWKS dispense frames already fit
//     in one segment in practice, exactly like before.
//   - Safety first: per-flow byte cap, idle expiry and a max flow count. A
//     capture must never grow memory without bound, whatever the wire sends.
//
// Pure & dependency-free → unit-tested in src/test/reassembler.test.ts.

"use strict";

const DEFAULTS = Object.freeze({
  maxFlowBytes: 256 * 1024, // hard cap per flow buffer (a dispense frame is < 4 KB)
  idleMs: 30_000,           // a flow silent this long is dropped
  maxFlows: 512,            // total tracked flows (evict oldest beyond this)
});

const OPEN_RE = /<WWKS\b/i;
const CLOSE_RE = /<\/WWKS\s*>/i;
// A segment that ENDS on a proper prefix of "<WWKS" ( "<", "<W", "<WW", "<WWK" )
// may have had the open tag itself split across the TCP boundary — buffer it so
// the next segment can complete the token.
const ENDS_OPEN_PREFIX_RE = /(?:<|<W|<WW|<WWK)$/i;

function bufToText(buf) {
  if (typeof buf === "string") return buf;
  if (!Buffer.isBuffer(buf)) return "";
  try {
    return buf.toString("utf-8");
  } catch {
    try {
      return buf.toString("latin1");
    } catch {
      return "";
    }
  }
}

class TcpReassembler {
  constructor(opts = {}) {
    this.opts = { ...DEFAULTS, ...opts };
    this.flows = new Map(); // key -> { buf: string, at: number }
  }

  // Feed one captured TCP segment for `flowKey`. Returns an array of complete
  // message strings ready for adapter extraction (often empty while a frame is
  // still arriving). A non-WWKS flow returns its segment unchanged (passthrough).
  push(flowKey, payload) {
    const text = bufToText(payload);
    if (!text) return [];
    const key = flowKey || "_";
    this._sweep();

    let flow = this.flows.get(key);

    // First sight of this flow and the segment shows no WWKS frame start (nor a
    // dangling open-tag prefix at its very end) → passthrough, don't even
    // allocate a buffer. Behaviour identical to the pre-reassembly path.
    if (!flow) {
      if (!OPEN_RE.test(text) && !ENDS_OPEN_PREFIX_RE.test(text)) return [text];
      flow = { buf: "", at: Date.now() };
      this.flows.set(key, flow);
      this._evictIfNeeded();
    }

    flow.at = Date.now();
    flow.buf += text;

    // Cap: keep only the tail so a never-closing / binary stream can't OOM us.
    if (flow.buf.length > this.opts.maxFlowBytes) {
      flow.buf = flow.buf.slice(flow.buf.length - this.opts.maxFlowBytes);
    }

    const out = [];
    let frame;
    while ((frame = this._takeFrame(flow)) !== null) out.push(frame);

    // Buffer fully consumed → forget the flow so idle entries don't accumulate.
    if (flow.buf.length === 0) this.flows.delete(key);

    return out;
  }

  // Extract the first complete `<WWKS …>…</WWKS>` frame, consuming it (and any
  // leading bytes before the open tag) from the buffer. Returns null if no
  // complete frame is buffered yet.
  _takeFrame(flow) {
    const s = flow.buf;
    const open = s.search(OPEN_RE);
    if (open < 0) {
      // No frame start in the buffer. Keep only a tiny tail in case the literal
      // "<WWKS" token was itself split across this and the next segment.
      if (s.length > 8) flow.buf = s.slice(-8);
      return null;
    }
    const tail = open > 0 ? s.slice(open) : s;
    const m = tail.match(CLOSE_RE);
    if (!m) {
      // Incomplete frame: drop pre-open garbage, keep the partial frame buffered.
      if (open > 0) flow.buf = tail;
      return null;
    }
    const end = m.index + m[0].length;
    const frame = tail.slice(0, end);
    flow.buf = tail.slice(end); // keep remainder (next frame / partial)
    return frame;
  }

  // Force-flush a flow's buffered bytes as one message. Used on a tcp-listen
  // socket close so a dangling (non-WWKS-delimited) document still gets one
  // extraction pass. Returns [] when nothing is buffered.
  flush(flowKey) {
    const key = flowKey || "_";
    const flow = this.flows.get(key);
    this.flows.delete(key);
    return flow && flow.buf ? [flow.buf] : [];
  }

  reset() {
    this.flows.clear();
  }

  size() {
    return this.flows.size;
  }

  _sweep() {
    const now = Date.now();
    const ttl = this.opts.idleMs;
    for (const [k, f] of this.flows) {
      if (now - f.at > ttl) this.flows.delete(k);
    }
  }

  _evictIfNeeded() {
    // Map preserves insertion order → the first key is the oldest-inserted.
    while (this.flows.size > this.opts.maxFlows) {
      const oldest = this.flows.keys().next().value;
      if (oldest === undefined) break;
      this.flows.delete(oldest);
    }
  }
}

// Stable, direction-aware flow key from packet meta (see parseIpv4TcpPacket).
function flowKeyFromMeta(meta) {
  if (!meta) return "_";
  return `${meta.srcAddress || "?"}:${meta.srcPort || 0}>${meta.dstAddress || "?"}:${meta.dstPort || 0}`;
}

// Shared IPv4/TCP parser (same shape main.js uses): returns addresses, ports and
// the TCP payload slice, or null if the buffer isn't a plain IPv4+TCP packet.
function parseIpv4TcpPacket(packet) {
  if (!Buffer.isBuffer(packet) || packet.length < 40) return null;
  if ((packet[0] >> 4) !== 4 || packet[9] !== 6) return null; // IPv4 + TCP only
  const ihl = (packet[0] & 0x0f) * 4;
  if (packet.length < ihl + 20) return null;
  const srcPort = packet.readUInt16BE(ihl);
  const dstPort = packet.readUInt16BE(ihl + 2);
  const tcpHeaderLen = ((packet[ihl + 12] >> 4) & 0x0f) * 4;
  const payloadOffset = ihl + tcpHeaderLen;
  const payload = payloadOffset < packet.length ? packet.slice(payloadOffset) : Buffer.alloc(0);
  const ip = (off) => `${packet[off]}.${packet[off + 1]}.${packet[off + 2]}.${packet[off + 3]}`;
  return { srcAddress: ip(12), dstAddress: ip(16), srcPort, dstPort, payload };
}

module.exports = {
  TcpReassembler,
  flowKeyFromMeta,
  parseIpv4TcpPacket,
  bufToText,
  DEFAULTS,
};
