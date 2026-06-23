import mockData from "@/data/medicaments-mock.json";

export interface MockMed {
  ean: string;
  nom: string;
  complementaires: { nom: string; raison: string }[];
}

/**
 * Local mock fallback lookup. Used when the scanned EAN/CIP is not found
 * in the Supabase `medicaments` table (DB lookup is done by the caller).
 */
export function lookupEanMock(code: string): MockMed | null {
  return (mockData as MockMed[]).find((m) => m.ean === code) ?? null;
}
