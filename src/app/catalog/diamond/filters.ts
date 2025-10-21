// filters.ts for DiamondCatalog

export interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
  goldPurety?: string;
}

/**
 * Returns true if the item matches diamond-based filtering logic.
 */
export const filterDiamondItems = (
  skuId: string,
  value: RawSkuData,
  searchParam: string,
  typeFilter: string | null
): boolean => {
  const remarks = (value.remarks || '').toLowerCase();
  const idLower = skuId.toLowerCase();

  // ❌ Exclude solitaire items
  if (remarks.includes('solitaire')) return false;

  // ✅ Diamond check excluding silver content
  const isDiamond = remarks.includes('diamond') && !remarks.includes('silver');
  if (!isDiamond) return false;

  // ✅ Search text match
  if (searchParam) {
    return (
      idLower.includes(searchParam) ||
      remarks.includes(searchParam)
    );
  }

  // ✅ Type filter match (e.g., ER, RG, etc.)
  if (typeFilter) {
    return idLower.includes(typeFilter.toLowerCase());
  }

  return true;
};
