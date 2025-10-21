// filters.ts for Solitaire Rings catalog

export interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
  goldPurety?: string;
}

/**
 * Returns true for items that are RINGS and whose remarks contain "solitaire".
 * - "Ring" detection: SKU id contains "RG" OR remarks include "ring" OR category mentions ring.
 * - Case-insensitive matching.
 * - Optional search filter (query matches id or remarks).
 */
export const filterSolitaireRings = (
  skuId: string,
  value: RawSkuData,
  searchParam: string
): boolean => {
  const remarks = (value.remarks || '').toLowerCase();
  const idLower = skuId.toLowerCase();
  const catLower = (value.jwelleryCategoryOther || '').toLowerCase();

  // Must be a ring
  const isRing =
    idLower.includes('rg') ||
    remarks.includes('ring') ||
    catLower.includes('ring');

  if (!isRing) return false;

  // Must mention "solitaire" in remarks
  const mentionsSolitaire = remarks.includes('solitaire');
  if (!mentionsSolitaire) return false;

  // Optional text search across id/remarks
  if (searchParam) {
    const q = searchParam.toLowerCase();
    return idLower.includes(q) || remarks.includes(q);
  }

  return true;
};
