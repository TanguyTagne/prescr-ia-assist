import { describe, it, expect } from "vitest";
import { createRequire } from "module";

// adapters.js is Electron main-process CommonJS — load it exactly like Node does
// so we exercise the real extraction code (not a copy).
const require = createRequire(import.meta.url);
const adapters = require("../../electron/robot/adapters");
const { RowaAdapter, extractAnyEan } = adapters as {
  RowaAdapter: new () => { extractEan: (b: Buffer) => string | null };
  extractAnyEan: (raw: Buffer | string) => string | null;
};

// Exact frame emitted by electron/scripts/dev-fake-lgo.js --format wwks2 — the
// realistic Omnicell / modern-Rowa WWKS2 OutputMessage the integration plan
// targets. The article code lives in the Article Id / Pack ScanCode ATTRIBUTES.
const WWKS2_OUTPUT_MESSAGE =
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<WWKS Version="2.0" TimeStamp="2026-06-18T10:30:00Z" Id="1" Source="100" Destination="1">` +
  `<OutputMessage Id="42" Source="100" Destination="1" Priority="Normal">` +
  `<Criteria><Article Id="3400936081349" Quantity="1">` +
  `<Pack DeliveryNumber="1" ScanCode="3400936081349" StockLocationId="A1"/>` +
  `</Article></Criteria></OutputMessage></WWKS>`;

// The compact <Criteria ArticleId="..."> form shown in ROBOT_INTEGRATION_PLAN.md.
const WWKS2_OUTPUT_REQUEST =
  `<WWKS Version="2.0"><OutputRequest Id="1004" Source="100" Destination="999">` +
  `<Details Priority="Normal" OutputDestination="1"/>` +
  `<Criteria ArticleId="3400936543217" Quantity="1"/></OutputRequest></WWKS>`;

describe("RowaAdapter — WWKS2 / Omnicell", () => {
  const rowa = new RowaAdapter();

  it("extracts the article code from a WWKS2 <Article Id=...> attribute", () => {
    expect(rowa.extractEan(Buffer.from(WWKS2_OUTPUT_MESSAGE))).toBe("3400936081349");
  });

  it("extracts the plan's compact <Criteria ArticleId=...> form", () => {
    expect(rowa.extractEan(Buffer.from(WWKS2_OUTPUT_REQUEST))).toBe("3400936543217");
  });

  it("still matches legacy <EAN> element frames", () => {
    const legacy = `<Dispense><Article Name="X"><EAN>3400936081349</EAN></Article></Dispense>`;
    expect(rowa.extractEan(Buffer.from(legacy))).toBe("3400936081349");
  });

  it("returns null on a non-dispense WWKS2 status frame", () => {
    expect(rowa.extractEan(Buffer.from(`<WWKS><StatusResponse State="Ready"/></WWKS>`))).toBeNull();
  });
});

describe("extractAnyEan — brand-agnostic probe extractor", () => {
  it("finds the code in a full WWKS2 OutputMessage", () => {
    expect(extractAnyEan(WWKS2_OUTPUT_MESSAGE)).toBe("3400936081349");
  });

  it("accepts a Buffer as well as a string", () => {
    expect(extractAnyEan(Buffer.from(WWKS2_OUTPUT_REQUEST))).toBe("3400936543217");
  });

  it("returns null when no code is present", () => {
    expect(extractAnyEan("<WWKS><KeepAlive/></WWKS>")).toBeNull();
  });
});
