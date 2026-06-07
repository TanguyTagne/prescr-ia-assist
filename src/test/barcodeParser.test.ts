import { describe, it, expect } from "vitest";
import { parseBarcodeToCip, parseGS1DataMatrix } from "@/lib/barcodeParser";

describe("parseBarcodeToCip", () => {
  it("returns null for empty input", () => {
    expect(parseBarcodeToCip("")).toBeNull();
  });

  it("returns a 13-digit CIP/EAN-13 as-is", () => {
    expect(parseBarcodeToCip("3400999123456")).toBe("3400999123456");
  });

  it("returns a 7-digit CIP-7 as-is", () => {
    expect(parseBarcodeToCip("1234567")).toBe("1234567");
  });

  it("extracts CIP-13 from GS1 DataMatrix payload (AI 01 + GTIN-14)", () => {
    expect(parseBarcodeToCip("010340099912345617260131101LOT123")).toBe("3400999123456");
  });

  it("handles GS1 payload with parentheses notation", () => {
    expect(parseBarcodeToCip("(01)03400999123456(17)260131(10)LOT")).toBe("3400999123456");
  });

  it("strips FNC1 (GS / 0x1d) separators", () => {
    expect(parseBarcodeToCip("01034009991234561D17260131".replace("1D", "\x1d"))).toBe("3400999123456");
  });

  it("returns null for non-digit garbage", () => {
    expect(parseBarcodeToCip("hello world")).toBeNull();
  });

  it("returns null for too-short codes", () => {
    expect(parseBarcodeToCip("123")).toBeNull();
  });

  it("rejects RPPS / ADELI / other non-product IDs (8-12 or 14 digits)", () => {
    expect(parseBarcodeToCip("10003475943")).toBeNull(); // RPPS 11 digits
    expect(parseBarcodeToCip("11260401")).toBeNull();    // 8 digits
    expect(parseBarcodeToCip("123456789012")).toBeNull(); // 12 digits
  });

});
