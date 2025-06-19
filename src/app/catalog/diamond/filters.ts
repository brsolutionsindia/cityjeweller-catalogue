// filters.ts for DiamondCatalog

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  [key: string]: any;
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

  const isDiamond = remarks.includes('diamond') && !remarks.includes('silver');



  if (!isDiamond) return false;

  if (searchParam) {
    return (
      idLower.includes(searchParam) ||
      remarks.includes(searchParam)
       );
  }

  if (!typeFilter) return true;

  return idLower.includes(typeFilter.toLowerCase());
};
