/**
 * Robust barcode → CIP-13 extractor.
 *
 * Handles input from all common pharmacy douchettes:
 *  - EAN-13 / CIP-13 (13 digits)              → returned as-is
 *  - CIP-7 ancien (7 digits)                  → returned as-is (DB caller will map)
 *  - GS1 DataMatrix 2D (boîtes médicaments)   → AI `01` + GTIN-14 → CIP-13
 *    Exemple : "010340099912345617260131101LOT123" → "3400999123456"
 *  - Variantes avec FNC1 / GS (\x1d) entre AI
 *  - Code-128 GS1 imprimé avec parenthèses : "(01)03400999123456(17)260131(10)LOT"
 *
 * Retourne `null` si aucun code exploitable.
 */
export function parseBarcodeToCip(raw: string): string | null {
  if (!raw) return null;

  // Strip GS1 FNC1 separators (\x1d / ASCII 29) and parentheses
  const cleaned = raw.replace(/[\x1d()]/g, "").trim();

  // 1) Simple 13-digit code (EAN-13 / CIP-13)
  if (/^\d{13}$/.test(cleaned)) return cleaned;

  // 2) GS1 DataMatrix: starts with AI "01" + 14-digit GTIN (leading 0 + CIP-13)
  //    Pharmacy GTIN-14 always starts with "0" → drop it to recover CIP-13.
  const gs1 = cleaned.match(/01(\d{14})/);
  if (gs1) {
    const gtin = gs1[1];
    const cip13 = gtin.startsWith("0") ? gtin.slice(1) : gtin.slice(-13);
    if (/^\d{13}$/.test(cip13)) return cip13;
  }

  // 3) CIP-7 (vieilles boîtes) — accepté pour mapping côté DB
  if (/^\d{7}$/.test(cleaned)) return cleaned;

  // 4) Fallback: 8–14 digits
  if (/^\d{8,14}$/.test(cleaned)) return cleaned;

  return null;
}
