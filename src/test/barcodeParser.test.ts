import { describe, it, expect } from "vitest";
import { parseBarcodeToCip } from "@/lib/barcodeParser";

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

  it("accepts 8-14 digit fallback codes", () => {
    expect(parseBarcodeToCip("12345678")).toBe("12345678");
  });
});
