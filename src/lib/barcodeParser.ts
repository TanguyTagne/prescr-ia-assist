/**
 * Robust barcode → CIP-13 extractor.
 *
 * Handles input from all common pharmacy douchettes:
 *  - EAN-13 / CIP-13 (13 digits)              → returned as-is
 *  - CIP-7 ancien (7 digits)                  → returned as-is (DB caller will map)
 *  - GS1 DataMatrix 2D (boîtes médicaments)   → AI `01` + GTIN-14 → CIP-13
 *    Exemple : "010340099912345617260131101LOT123" → "3400999123456"
 *  - Symbology Identifier ISO/IEC 15424 ("]d2" pour Data Matrix, "]C1" pour
 *    Code-128 GS1, "]e0" pour Composite) — préfixe stripé avant parsing
 *  - Variantes avec FNC1 / GS (\x1d) entre AI
 *  - Code-128 GS1 imprimé avec parenthèses : "(01)03400999123456(17)260131(10)LOT"
 *
 * Retourne `null` si aucun code exploitable.
 */

/** Symbology Identifier prefixes (ISO/IEC 15424) that may be prepended by the scanner */
const SYMBOLOGY_PREFIX_RE = /^\](?:d[12]|C1|e[01]|Q[13])/i;

/**
 * Extracts a CIP-13 from a GS1 Data Matrix / Code-128-GS1 raw payload.
 *
 * Accepts inputs of the form:
 *   - `]d2010340093546127621ABC..17261231` (Symbology ID prefix)
 *   - `010340099912345617260131101LOT123`  (no prefix)
 *   - `(01)03400999123456(17)260131(10)LOT` (human-readable notation)
 *   - same, with FNC1 / GS (\x1d) separators between AIs
 *
 * Returns null if no AI `01` + GTIN-14 + leading 0 + 13 digits can be extracted.
 */
export function parseGS1DataMatrix(raw: string): string | null {
  if (!raw) return null;
  // Strip ISO/IEC 15424 symbology identifier, FNC1 separators, parentheses
  const cleaned = raw
    .replace(SYMBOLOGY_PREFIX_RE, "")
    .replace(/[\x1d()]/g, "")
    .trim();
  // AI "01" + GTIN-14 — pharmacy GTIN starts with "0" (packaging indicator) so
  // we drop it to recover the CIP-13.
  const match = cleaned.match(/01(\d{14})/);
  if (!match) return null;
  const gtin = match[1];
  const cip13 = gtin.startsWith("0") ? gtin.slice(1) : gtin.slice(-13);
  return /^\d{13}$/.test(cip13) ? cip13 : null;
}

export function parseBarcodeToCip(raw: string): string | null {
  if (!raw) return null;

  // Strip symbology ID, GS1 FNC1 separators (\x1d / ASCII 29) and parentheses
  const cleaned = raw
    .replace(SYMBOLOGY_PREFIX_RE, "")
    .replace(/[\x1d()]/g, "")
    .trim();

  // 1) Simple 13-digit code (EAN-13 / CIP-13) — try this first per spec
  //    Pharma CIP-13 commence par 3400 (FR). EAN-13 produits parapharma : autres préfixes.
  //    On rejette les RPPS (11 chiffres) et autres identifiants non-produits.
  if (/^\d{13}$/.test(cleaned)) return cleaned;

  // 2) GS1 Data Matrix fallback (AI "01" + GTIN-14)
  const fromGs1 = parseGS1DataMatrix(raw);
  if (fromGs1) return fromGs1;

  // 3) CIP-7 (vieilles boîtes) — accepté pour mapping côté DB
  if (/^\d{7}$/.test(cleaned)) return cleaned;

  // ❌ Pas de fallback 8-14 chiffres : on rejette les RPPS (11), ADELI (9),
  //    numéros INSEE, etc. — un code non-produit ne doit jamais déclencher une analyse.
  return null;
}
