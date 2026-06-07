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

  it("extracts CIP-13 from a Data Matrix payload prefixed with ISO/IEC 15424 ]d2", () => {
    expect(parseBarcodeToCip("]d2010340093546127621ABC123456789017261231")).toBe("3400935461276");
  });

  it("strips ]C1 Code-128-GS1 symbology prefix", () => {
    expect(parseBarcodeToCip("]C1010340099912345617260131")).toBe("3400999123456");
  });
});

describe("parseGS1DataMatrix", () => {
  it("extracts CIP-13 from raw ]d2 payload", () => {
    expect(parseGS1DataMatrix("]d2010340093546127621ABC..17261231")).toBe("3400935461276");
  });

  it("extracts CIP-13 when no symbology prefix is present", () => {
    expect(parseGS1DataMatrix("010340099912345617260131101LOT123")).toBe("3400999123456");
  });

  it("returns null for plain EAN-13 input (not a Data Matrix payload)", () => {
    expect(parseGS1DataMatrix("3400999123456")).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseGS1DataMatrix("hello")).toBeNull();
  });
});
