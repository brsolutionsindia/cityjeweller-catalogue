interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
}

export const filterSilverItems = (
  key: string,
  value: RawSkuData,
  searchParam: string,
  typeFilter?: string
): boolean => {
  const remarks = (value.remarks || '').toLowerCase();
  const categoryOther = (value.jwelleryCategoryOther || '').toLowerCase();

  if (searchParam) {
    return (
      key.toLowerCase().includes(searchParam) ||
      remarks.includes(searchParam) ||
      categoryOther.includes(searchParam)
    );
  }

  const containsSilver = remarks.includes('sil') && !remarks.includes('diamond') && !remarks.includes('gold');


  if (!containsSilver) return false;

  switch (typeFilter) {
    case 'SRK': return remarks.includes('rakhi');
    case 'SBL': return remarks.includes('bracelet');
    case 'SUT': return remarks.includes('utensil');
    case 'SPF': return remarks.includes('frame');
    case 'SID': return remarks.includes('idol');
    case 'SDC': return remarks.includes('decor');
    case 'SAQ': return remarks.includes('antique');
    case 'SDS': return remarks.includes('dinner');
    case 'SDF': return remarks.includes('dryfruit');
    case 'SGL': return remarks.includes('glass');
    case 'SKD': return remarks.includes('kids');
    case 'SPL': return remarks.includes('plate');
    case 'SSD': return remarks.includes('sindoor');
    case 'SSN': return remarks.includes('sinhasan');
    case 'STR': return remarks.includes('tray');
    case 'SWC': return remarks.includes('wedding');
    case 'SPY': return remarks.includes('payal');
    case 'SRG': return key.toLowerCase().includes('rg');
    case 'SOT': return remarks.includes('kada');
    case 'SBR': return key.toLowerCase().includes('br');
    case 'SPD': return key.toLowerCase().includes('pd');
    default: return true; // fallback: all silver items
  }
};
