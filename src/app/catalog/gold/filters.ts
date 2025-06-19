// filters.ts for GoldCatalog

export interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
  goldPurety?: string;
}

/**
 * Returns true if the item matches gold-based filtering logic.
 */
export const filterGoldItems = (
  skuId: string,
  value: RawSkuData,
  searchParam: string,
  typeFilter: string | null
): boolean => {
  const remarks = (value.remarks || '').toLowerCase();
  const idLower = skuId.toLowerCase();

  // ✅ Must contain 'gold' but exclude diamond and silver references
  const isGold =
    remarks.includes('gold') &&
    !remarks.includes('diamond') &&
    !remarks.includes('silver');

  if (!isGold) return false;

  // ✅ Search filter match
  if (searchParam) {
    return (
      idLower.includes(searchParam) ||
      remarks.includes(searchParam)
    );
  }

  // ✅ Type code match (ER, RG, etc.)
  if (typeFilter) {
    return idLower.includes(typeFilter.toLowerCase());
  }

  return true;
};
