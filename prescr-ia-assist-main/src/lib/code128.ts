/**
 * Minimal Code 128 (subset B) → SVG generator.
 *
 * Implements the ISO/IEC 15417 Code 128B encoding, which covers ASCII 32-127
 * — enough for every Honeywell PAP-format configuration command (uppercase
 * letters, digits, ".", "*", "!"). The renderer outputs a self-contained SVG
 * string that can be embedded directly in React.
 *
 * NOT supported here intentionally:
 *   - Code 128A (uppercase + control chars)
 *   - Code 128C (numeric pairs, denser but irrelevant for our commands)
 *   - GS1-128 with FNC1 — also irrelevant for scanner config menus.
 *
 * Why no external library: Code 128B is ~50 lines and our use-case is narrow.
 * Pulling jsbarcode/bwip-js (200+ kB) for a few admin barcodes is overkill.
 */

// 107 patterns total. Values 0..102 cover ASCII 32..127 (subset B) plus special codes,
// 103..105 are START_A/B/C, 106 is STOP. Each pattern is 11 modules wide; STOP is 13.
// Source: ISO/IEC 15417:2007 Annex A.
const PATTERNS: string[] = [
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
  "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
  "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
  "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
  "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
  "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
  "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
  "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
  "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
  "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
  "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
  "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
  "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
  "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
  "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110",
  // 103 = START_A, 104 = START_B, 105 = START_C
  "11010000100", "11010010000", "11010011100",
  // 106 = STOP (13 modules wide)
  "1100011101011",
];

const START_B = 104;
const STOP = 106;

/** Encode a string into Code 128 module-bits. */
function encodeBits(text: string): string {
  // Subset B values: char code - 32.
  const codes: number[] = [START_B];
  for (const ch of text) {
    const v = ch.charCodeAt(0);
    if (v < 32 || v > 127) {
      throw new Error(`Code128B: unsupported char "${ch}" (code ${v})`);
    }
    codes.push(v - 32);
  }
  // Checksum: weighted modulo 103. Weight 1 for START + first char, 2 for second, …
  let sum = codes[0];
  for (let i = 1; i < codes.length; i++) sum += i * codes[i];
  codes.push(sum % 103);
  codes.push(STOP);
  return codes.map((c) => PATTERNS[c]).join("");
}

export interface Code128SvgOptions {
  /** Bar width in user units (default 2). */
  moduleWidth?: number;
  /** Bar height in user units (default 80). */
  height?: number;
  /** Whether to print the human-readable text under the barcode. */
  showText?: boolean;
  /** Font size for human-readable text (default 14). */
  textSize?: number;
  /** Quiet zone (white margin) in modules. Spec says ≥ 10. */
  quietZone?: number;
}

/**
 * Build a Code 128B barcode as a self-contained SVG string.
 * Uses currentColor so it inherits the surrounding text color.
 */
export function code128ToSvg(text: string, opts: Code128SvgOptions = {}): string {
  const moduleWidth = opts.moduleWidth ?? 2;
  const height = opts.height ?? 80;
  const showText = opts.showText ?? true;
  const textSize = opts.textSize ?? 14;
  const quietZone = opts.quietZone ?? 10;

  const bits = encodeBits(text);
  const barsWidth = bits.length * moduleWidth;
  const totalWidth = barsWidth + 2 * quietZone * moduleWidth;
  const totalHeight = height + (showText ? textSize + 6 : 0);

  // Coalesce consecutive "1" modules into a single <rect> for compact SVG.
  const rects: string[] = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === "1") {
      let j = i;
      while (j < bits.length && bits[j] === "1") j++;
      const x = quietZone * moduleWidth + i * moduleWidth;
      const w = (j - i) * moduleWidth;
      rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" />`);
      i = j;
    } else {
      i++;
    }
  }

  const textNode = showText
    ? `<text x="${totalWidth / 2}" y="${height + textSize}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="${textSize}" fill="currentColor">${escapeXml(text)}</text>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" ` +
    `width="${totalWidth}" height="${totalHeight}" fill="currentColor" shape-rendering="crispEdges" ` +
    `aria-label="Code-barres Code 128 contenant ${escapeXml(text)}">` +
    rects.join("") +
    textNode +
    `</svg>`
  );
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
