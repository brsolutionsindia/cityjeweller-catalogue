// src/app/catalog/CatalogFilterUtil.ts

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
}

export function applyFiltering(
  allItems: [string, RawSkuData][],
  typeFilter: string | null,
  searchParam: string
) {
  return allItems.filter(([key, value]) => {
    const remarks = (value.remarks || '').toLowerCase();
    const categoryOther = (value.jwelleryCategoryOther || '').toLowerCase();
    const containsSilver = remarks.includes('sil');
    const containsGemstone = remarks.includes('gemstone');

    if (searchParam) {
      return (
        key.toLowerCase().includes(searchParam) ||
        remarks.includes(searchParam) ||
        categoryOther.includes(searchParam)
      );
    }

    if (!typeFilter) return true;
    if (typeFilter === 'ST') return containsGemstone;

    if (typeFilter.startsWith('LG-')) {
      const desiredType = typeFilter.replace('LG-', '').toLowerCase();
      return categoryOther === desiredType;
    }

    const silverSpecificFilters: { [key: string]: string } = {
      SUT: 'utensil',
      SPF: 'frame',
      SID: 'idol',
      SDC: 'decor',
      SAQ: 'antique',
      SDS: 'dinner',
      SDF: 'dryfruit',
      SGL: 'glass',
      SKD: 'mickey',
      SPL: 'plate',
      SSD: 'sindoor',
      SSN: 'sinhasan',
      STR: 'tray',
      SWC: 'wedding',
      SPY: 'payal'
    };

    if (typeFilter in silverSpecificFilters) {
      return remarks.includes('sil') && remarks.includes(silverSpecificFilters[typeFilter]);
    }

    if (typeFilter.startsWith('S')) {
      const goldType = typeFilter.substring(1).toLowerCase();
      return key.toLowerCase().includes(goldType) && containsSilver;
    }

    return key.includes(typeFilter) && !containsSilver && !containsGemstone;
  });
}
