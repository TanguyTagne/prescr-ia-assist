import { describe, it, expect } from "vitest";
import { code128ToSvg } from "@/lib/code128";

describe("code128ToSvg", () => {
  it("returns a self-contained SVG with the input text in the aria-label", () => {
    const svg = code128ToSvg("HELLO");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("HELLO");
  });

  it("includes a <text> node with the human-readable value by default", () => {
    const svg = code128ToSvg("PAP130.");
    expect(svg).toMatch(/<text[^>]*>PAP130\.<\/text>/);
  });

  it("omits human-readable text when showText is false", () => {
    const svg = code128ToSvg("PAP130.", { showText: false });
    expect(svg).not.toMatch(/<text/);
  });

  it("escapes XML special characters in the aria-label", () => {
    const svg = code128ToSvg("A&B");
    expect(svg).toContain("A&amp;B");
  });

  it("throws on out-of-range characters", () => {
    expect(() => code128ToSvg("a\x1Fb")).toThrow(/unsupported char/);
  });

  it("produces longer barcodes for longer payloads", () => {
    const short = code128ToSvg("A");
    const long = code128ToSvg("ABCDEFGHIJ");
    // Compare viewBox widths to verify a longer payload → wider barcode.
    const widthOf = (svg: string) => Number(svg.match(/viewBox="0 0 ([\d.]+)/)?.[1] ?? 0);
    expect(widthOf(long)).toBeGreaterThan(widthOf(short));
  });
});
