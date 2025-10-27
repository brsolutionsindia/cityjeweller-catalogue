// data/catalogMenu.ts
export type CatalogItem = {
  label: string;
  image: string;
  link: string;
  disabled?: boolean; // default false
};

export const diamondItems: CatalogItem[] = [
  { label: 'Mangalsutra', image: '/mangalsutra.png', link: '/catalog/diamond?type=MG' },
  { label: 'Rings', image: '/rings.png', link: '/catalog/diamond?type=RG'},
  { label: 'Pendants', image: '/pendants.png', link: '/catalog/diamond?type=PD' },
  { label: 'Earrings', image: '/earrings.png', link: '/catalog/diamond?type=ER'},
  { label: 'Necklace Sets', image: '/necklace.png', link: '/catalog/diamond?type=NK', disabled: true},
  { label: 'Bangles', image: '/bangles.png', link: '/catalog/diamond?type=BG', disabled: true },
  { label: 'Bracelets', image: '/bracelets.png', link: '/catalog/diamond?type=BR', disabled: true },
  { label: 'Chains', image: '/chains.png', link: '/catalog/diamond?type=CH', disabled: true },
  { label: 'Nose Pins', image: '/nosepins.png', link: '/catalog/diamond?type=NP', disabled: true },
  { label: 'Others', image: '/others.png', link: '/catalog/diamond?type=OT', disabled: true},
];

export const goldItems: CatalogItem[] = [
  { label: 'Rings', image: '/gold-rings.png', link: '/catalog/gold?type=RG'},
  { label: 'Mangalsutra', image: '/gold-mangalsutra.png', link: '/catalog/gold?type=MG' },
  { label: 'Bangles', image: '/gold-bangles.png', link: '/catalog/gold?type=BG' },
  { label: 'Necklace Sets', image: '/gold-necklace.png', link: '/catalog/gold?type=NK' },
  { label: 'Pendants', image: '/gold-pendants.png', link: '/catalog/gold?type=PD' },
  { label: 'Bracelets', image: '/gold-bracelets.png', link: '/catalog/gold?type=BR' },
  { label: 'Chains', image: '/gold-chains.png', link: '/catalog/gold?type=CH' },
  { label: 'Earrings', image: '/gold-earrings.png', link: '/catalog/gold?type=ER', disabled: true },
  { label: 'Nose Pins', image: '/gold-nosepins.png', link: '/catalog/gold?type=NP', disabled: true },
  { label: 'Others', image: '/gold-others.png', link: '/catalog/gold?type=OT', disabled: true },
];

export const silverItems: CatalogItem[] = [
  { label: 'Rakhi', image: '/silver-rakhi.png', link: '/catalog/silver?type=SRK' },
  { label: 'Bracelet', image: '/silver-bracelet.png', link: '/catalog/silver?type=SBL' },
  { label: 'Utensils', image: '/silver-utensils.png', link: '/catalog/silver?type=SUT' },
  { label: 'Photo Frames', image: '/silver-frames.png', link: '/catalog/silver?type=SPF' },
  { label: 'Idols', image: '/silver-idols.png', link: '/catalog/silver?type=SID' },
  { label: 'Decor', image: '/silver-decor.png', link: '/catalog/silver?type=SDC' },
  { label: 'Antique', image: '/silver-antique.png', link: '/catalog/silver?type=SAQ' },
  { label: 'Dinner Set', image: '/silver-dinnerSet.png', link: '/catalog/silver?type=SDS' },
  { label: 'Dry Fruit Bowl', image: '/silver-dryFruitBowl.png', link: '/catalog/silver?type=SDF' },
  { label: 'Glass', image: '/silver-glass.png', link: '/catalog/silver?type=SGL' },
  { label: 'Kids', image: '/silver-kids.png', link: '/catalog/silver?type=SKD' },
  { label: 'Plates', image: '/silver-plates.png', link: '/catalog/silver?type=SPL' },
  { label: 'Sindoor Dibbi', image: '/silver-sindoorDibbi.png', link: '/catalog/silver?type=SSD' },
  { label: 'Sinhaasan', image: '/silver-sinhaasan.png', link: '/catalog/silver?type=SSN' },
  { label: 'Tray', image: '/silver-tray.png', link: '/catalog/silver?type=STR' },
  { label: 'Wedding Card', image: '/silver-weddingCard.png', link: '/catalog/silver?type=SWC' },
  { label: 'Payal', image: '/silver-payal.png', link: '/catalog/silver?type=SPY' },
  { label: 'Rings', image: '/silver-rings.png', link: '/catalog/silver?type=SRG' },
  { label: 'Kada', image: '/silver-kada.png', link: '/catalog/silver?type=SOT' },
  { label: 'Nazariye', image: '/silver-nazariye.png', link: '/catalog/silver?type=SBR' },
  { label: 'Pendants', image: '/silver-pendants.png', link: '/catalog/silver?type=SPD' },
];

export const gemstoneItems: CatalogItem[] = [
  { label: 'Loose Gemstones', image: '/gemstone-loose.png', link: '/catalog/gemstones/loose-gemstones/selector' },
  { label: 'Gemstone Strings', image: '/gemstone-strings.png', link: '/catalog/gemstones?type=ST' },
];

export const cvdItems: CatalogItem[] = [
  { label: 'Natural Diamonds', image: '/diamond-loose.png', link: '/catalog/naturalD' },
  { label: 'Lab Grown Diamonds', image: '/cvd-loose.png', link: '/catalog/labgrown' },
  { label: 'Solitaire Rings', image: '/solitaire-rings.png', link: '/catalog/solitaireRG' },
];

export const miscItems: CatalogItem[] = [
  { label: 'Miscellaneous', image: '/misc-items.png', link: '/catalog/misc', disabled: true },
];
