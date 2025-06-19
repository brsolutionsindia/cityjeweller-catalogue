// filters.ts for GoldCatalog

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  [key: string]: any;
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

  // ✅ More robust gold match (handles ##gold, ###gold, etc.)
  const isGold = remarks.includes('gold') && !remarks.includes('diamond') && !remarks.includes('silver');


  if (!isGold) return false;

  if (searchParam) {
    return (
      idLower.includes(searchParam) ||
      remarks.includes(searchParam)
       );
  }

  if (!typeFilter) return true;

  return idLower.includes(typeFilter.toLowerCase());
};
