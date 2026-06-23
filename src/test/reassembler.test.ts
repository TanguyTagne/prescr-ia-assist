import { describe, it, expect } from "vitest";
import { createRequire } from "module";

// reassembler.js and adapters.js are Electron main-process CommonJS — load them
// exactly like Node does so we exercise the real code, not a copy.
const require = createRequire(import.meta.url);
const { TcpReassembler, parseIpv4TcpPacket, flowKeyFromMeta } = require("../../electron/robot/reassembler") as {
  TcpReassembler: new (opts?: any) => {
    push: (k: string, b: Buffer | string) => string[];
    flush: (k: string) => string[];
    size: () => number;
    reset: () => void;
  };
  parseIpv4TcpPacket: (b: Buffer) => any;
  flowKeyFromMeta: (m: any) => string;
};
const { extractAnyEan } = require("../../electron/robot/adapters") as {
  extractAnyEan: (raw: Buffer | string) => string | null;
};

// Realistic WWKS2 frames (article code in the ATTRIBUTES — the Omnicell form).
const FRAME_A =
  `<WWKS Version="2.0"><OutputMessage><Criteria>` +
  `<Article Id="3400936081349" Quantity="1"><Pack ScanCode="3400936081349"/></Article>` +
  `</Criteria></OutputMessage></WWKS>`;
const FRAME_B =
  `<WWKS Version="2.0"><OutputRequest><Criteria ArticleId="3400936543217" Quantity="1"/></OutputRequest></WWKS>`;

describe("TcpReassembler — WWKS2 framing", () => {
  it("rejoins a frame split across two segments (the core gap)", () => {
    const r = new TcpReassembler();
    const mid = Math.floor(FRAME_A.length / 2);
    expect(r.push("f1", Buffer.from(FRAME_A.slice(0, mid)))).toEqual([]); // still arriving
    const out = r.push("f1", Buffer.from(FRAME_A.slice(mid)));
    expect(out).toHaveLength(1);
    expect(extractAnyEan(out[0])).toBe("3400936081349");
  });

  it("handles the literal <WWKS token being split across the boundary", () => {
    const r = new TcpReassembler();
    expect(r.push("f", Buffer.from("<WW"))).toEqual([]);
    const out = r.push(
      "f",
      Buffer.from(`KS Version="2.0"><OutputRequest><Criteria ArticleId="3400936543217"/></OutputRequest></WWKS>`),
    );
    expect(out).toHaveLength(1);
    expect(extractAnyEan(out[0])).toBe("3400936543217");
  });

  it("emits multiple frames packed into a single segment", () => {
    const r = new TcpReassembler();
    const out = r.push("f", Buffer.from(FRAME_A + FRAME_B));
    expect(out).toHaveLength(2);
    expect(extractAnyEan(out[0])).toBe("3400936081349");
    expect(extractAnyEan(out[1])).toBe("3400936543217");
  });

  it("keeps a trailing partial frame buffered until its closing tag arrives", () => {
    const r = new TcpReassembler();
    const out1 = r.push("f", Buffer.from(FRAME_A + `<WWKS><OutputRequest><Criteria ArticleId="3400936543217"/>`));
    expect(out1).toHaveLength(1); // only the first, complete frame
    const out2 = r.push("f", Buffer.from(`</OutputRequest></WWKS>`));
    expect(out2).toHaveLength(1);
    expect(extractAnyEan(out2[0])).toBe("3400936543217");
  });

  it("passes non-WWKS segments straight through without buffering (no regression)", () => {
    const r = new TcpReassembler();
    const legacy = `<Dispense><Article><EAN>3400936081349</EAN></Article></Dispense>`;
    expect(r.push("f", Buffer.from(legacy))).toEqual([legacy]);
    expect(r.size()).toBe(0);
  });

  it("never glues two distinct flows together", () => {
    const r = new TcpReassembler();
    const mid = Math.floor(FRAME_A.length / 2);
    r.push("flowA", Buffer.from(FRAME_A.slice(0, mid)));
    const outB = r.push("flowB", Buffer.from(FRAME_B)); // completes independently
    expect(outB).toHaveLength(1);
    expect(extractAnyEan(outB[0])).toBe("3400936543217");
    const outA = r.push("flowA", Buffer.from(FRAME_A.slice(mid)));
    expect(extractAnyEan(outA[0])).toBe("3400936081349");
  });

  it("flush() returns buffered bytes of a never-closed document", () => {
    const r = new TcpReassembler();
    expect(r.push("f", Buffer.from("<WWKS><Partial>"))).toEqual([]);
    const flushed = r.flush("f");
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toContain("<WWKS>");
    expect(r.size()).toBe(0);
  });

  it("caps a runaway flow buffer instead of growing without bound", () => {
    const r = new TcpReassembler({ maxFlowBytes: 1024 });
    // 50 KB of an open-but-never-closed frame must NOT be retained in full.
    expect(r.push("f", Buffer.from("<WWKS>" + "A".repeat(50_000)))).toEqual([]);
    expect(r.size()).toBe(1); // one flow, bounded — no OOM
    // a later self-contained frame on the same flow still parses cleanly
    const out = r.push("f", Buffer.from(FRAME_B));
    expect(out).toHaveLength(1);
    expect(extractAnyEan(out[0])).toBe("3400936543217");
  });
});

describe("parseIpv4TcpPacket / flowKeyFromMeta", () => {
  it("returns null on a buffer that is not IPv4+TCP", () => {
    expect(parseIpv4TcpPacket(Buffer.alloc(10))).toBeNull();
  });

  it("parses a hand-built IPv4/TCP packet and exposes the payload + flow key", () => {
    const pkt = Buffer.alloc(44);
    pkt[0] = 0x45; // IPv4, IHL=5 (20 bytes)
    pkt[9] = 6; // protocol = TCP
    pkt.set([192, 168, 1, 10], 12); // src
    pkt.set([192, 168, 1, 2], 16); // dst
    pkt.writeUInt16BE(5000, 20); // src port
    pkt.writeUInt16BE(9876, 22); // dst port
    pkt[32] = 5 << 4; // TCP data offset = 5 (20 bytes) at byte ihl+12
    pkt.write("PING", 40, "ascii");
    const meta = parseIpv4TcpPacket(pkt);
    expect(meta).not.toBeNull();
    expect(meta.srcAddress).toBe("192.168.1.10");
    expect(meta.dstAddress).toBe("192.168.1.2");
    expect(meta.srcPort).toBe(5000);
    expect(meta.dstPort).toBe(9876);
    expect(meta.payload.toString()).toBe("PING");
    expect(flowKeyFromMeta(meta)).toBe("192.168.1.10:5000>192.168.1.2:9876");
  });
});
