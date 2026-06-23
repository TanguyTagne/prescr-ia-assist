import { describe, it, expect } from "vitest";
import {
  tcpConfidence,
  mergeDiscoveryResults,
  confidenceTone,
} from "@/lib/robotDiscovery";

describe("tcpConfidence", () => {
  it("ranks a captured-payload LGO link on a known robot port near certainty", () => {
    const c = tcpConfidence({ isLgo: true, isKnownRobotPort: true, payloadHits: 3, packets: 5, payloadBytes: 200 });
    expect(c).toBeGreaterThanOrEqual(95);
    expect(c).toBeLessThanOrEqual(99);
  });

  it("gives a bare active connection a low-ish score", () => {
    expect(tcpConfidence({ remotePort: 1234 })).toBeLessThan(40);
  });

  it("clamps to the 5..99 range", () => {
    expect(tcpConfidence({})).toBeGreaterThanOrEqual(5);
    expect(
      tcpConfidence({ isLgo: true, isKnownRobotPort: true, payloadHits: 99, packets: 99, payloadBytes: 99999 }),
    ).toBeLessThanOrEqual(99);
  });
});

describe("mergeDiscoveryResults", () => {
  it("merges one endpoint seen by both probes and unions their signals", () => {
    const live = [
      {
        remoteAddress: "192.168.16.2",
        robotServerIp: "192.168.16.2",
        remotePort: 6050,
        payloadHits: 2,
        packets: 4,
        payloadBytes: 120,
        captureDirection: "inbound" as const,
      },
    ];
    const conns = [
      { process: "winpharma.exe", remoteAddress: "192.168.16.2", remotePort: 6050, isLgo: true },
    ];
    const out = mergeDiscoveryResults({ live, conns, pipes: [] });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("tcp");
    expect(out[0].port).toBe(6050);
    expect(out[0].robotServerIp).toBe("192.168.16.2");
    expect(out[0].confidence).toBeGreaterThanOrEqual(80);
    expect(out[0].reasons.join(" ")).toMatch(/LGO|délivrance/i);
  });

  it("sorts TCP above pipes and orders TCP by confidence", () => {
    const live = [
      { remoteAddress: "10.0.0.5", remotePort: 9999, packets: 1 },
      { remoteAddress: "10.0.0.9", remotePort: 9876, isKnownRobotPort: true, payloadHits: 1, packets: 3, payloadBytes: 80 },
    ];
    const pipes = [{ pipeName: "OmnicellPipe" }];
    const out = mergeDiscoveryResults({ live, conns: [], pipes });
    expect(out[0].port).toBe(9876); // strongest signal first
    expect(out[out.length - 1].kind).toBe("pipe"); // pipes always last
  });

  it("dedupes pipes case-insensitively and keeps them below any TCP candidate", () => {
    const out = mergeDiscoveryResults({ pipes: [{ pipeName: "Rowa" }, { pipeName: "rowa" }] });
    const pipeCands = out.filter((c) => c.kind === "pipe");
    expect(pipeCands).toHaveLength(1);
    expect(pipeCands[0].confidence).toBeLessThan(55);
  });
});

describe("confidenceTone", () => {
  it("buckets confidence by threshold", () => {
    expect(confidenceTone(90)).toBe("high");
    expect(confidenceTone(60)).toBe("medium");
    expect(confidenceTone(20)).toBe("low");
  });
});
