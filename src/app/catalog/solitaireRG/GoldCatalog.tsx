'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ref, onValue, get } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import { useSearchParams } from 'next/navigation';

import PageLayout from '../../components/PageLayout';
import OfferBar from '../../components/OfferBar';
import SkuSummaryModal from '../../components/SkuSummaryModal';

import styles from '../../page.module.css';
import shapeIcon from '../../../../assets/shapeIcons';
import { filterSolitaireRings } from './filters';

/* =========================
   Types
========================= */

type ImageIndex = Record<string, { Primary?: string }>;

type SortKey = 'price-asc' | 'price-desc' | 'size-asc' | 'size-desc';


type RawSkuData = {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
  goldPurety?: string;
  Stone2_wt?: string | number;
  Stone2Weight?: string | number;
  stone2Weight?: string | number;
  Stone2?: string;
};

type ProductCard = {
  id: string;
  price: number | string;
  image: string;
  remarksLower?: string;
  stone2Ct?: number | null;
};

type Diamond = {
  StoneId: string;
  Size?: string;
  SizeRange?: string;
  Shape?: string;
  Status?: string;
  Color?: string;
  Clarity?: string;
  Cut?: string;
  Polish?: string;
  Symm?: string;
  Fluorescence?: string;
  Measurement?: string;
  Depth?: string;
  Table?: string;
  MRP?: number;
  OfferPrice?: number;
};

/* =========================
   Helpers
========================= */

// === Size helpers
const sizeNum = (s?: string) => {
  const n = parseFloat(s ?? '0');
  return Number.isFinite(n) ? n : 0;
};

// Choose the first (sorted) SizeRange that is >= minCt (prefer ranges whose min >= minCt)
const findFirstRangeAtLeast = (minCt: number, allRanges: string[]): string | '' => {
  const parsed = allRanges
    .map(r => ({ raw: r, pr: parseRangeStr(r) }))
    .filter(x => !!x.pr) as { raw: string; pr: NonNullable<ReturnType<typeof parseRangeStr>> }[];

  // prefer ranges whose min >= minCt, sorted by min asc
  const prefer = parsed
    .filter(x => x.pr.min >= minCt)
    .sort((a, b) => a.pr.min - b.pr.min);
  if (prefer.length) return prefer[0].raw;

  // otherwise take the first range whose max >= minCt (closest one)
  const fallback = parsed
    .filter(x => x.pr.max >= minCt)
    .sort((a, b) => a.pr.max - b.pr.max);
  return fallback[0]?.raw || '';
};


// Replace old rangesFrom with this "raw" version
const rangesFromRaw = (arr: Diamond[], shape: string): string[] => {
  const chosen = arr
    .filter(d => d.Shape === shape)
    .map(d => d.SizeRange ?? '')
    .filter(Boolean) as string[];
  return Array.from(new Set(chosen)).sort();
};

const buildAdminProductLines = (
  _ringId: string | null,
  nat?: Diamond | null,
  lab?: Diamond | null
) => {
  const lines: string[] = [];
  if (lab?.StoneId) {
    // e.g., "I am interested in your Product ID 8165-CVD1912."
    lines.push(`I am interested in your Product ID ${lab.StoneId}.`);
  }
  if (nat?.StoneId) {
    // e.g., "I am interested in Product ID 8165NDIAMS246."
    lines.push(`I am interested in Product ID ${nat.StoneId}.`);
  }
  return lines.join('\n\n'); // blank line between the two lines
};



const parseCt = (v: unknown): number | null => {
  if (v == null) return null;
  const s = String(v).replace(/[^\d.]/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
};

const getStone2Ct = (sku: RawSkuData): number | null => {
  const tries = [sku.Stone2_wt, sku.Stone2Weight, sku.stone2Weight, sku.Stone2];
  for (const t of tries) {
    const n = parseCt(t);
    if (n && n > 0) return n;
  }
  const m = (sku.remarks || '').match(/(\d+\.\d+|\d+)\s*ct/i);
  if (m) {
    const n = parseFloat(m[1]);
    if (n > 0) return n;
  }
  return null;
};

const toFloat = (s: string) => parseFloat((s || '').trim());
const fmtDec = (n: number, places = 2) => (Number.isFinite(n) ? n.toFixed(places) : '');

const parseRangeStr = (range?: string): { min: number; max: number; decimals: number } | null => {
  if (!range) return null;
  const m = range.match(/([0-9]*\.?[0-9]+)\s*[-–]\s*([0-9]*\.?[0-9]+)/);
  if (!m) return null;
  const min = toFloat(m[1]);
  const max = toFloat(m[2]);
  if (!isFinite(min) || !isFinite(max)) return null;
  const d1 = (m[1].split('.')[1]?.length ?? 0);
  const d2 = (m[2].split('.')[1]?.length ?? 0);
  return { min, max, decimals: Math.max(d1, d2, 2) };
};

// Replace keepInChosenRange with direct equality on SizeRange
const keepInChosenRange = (d: Diamond, chosen: string) => {
  if (!chosen) return true;
  return (d.SizeRange ?? '') === chosen;
};


const money = (n?: number | string | null) => {
  const v = typeof n === 'number' ? n : Number(n ?? 0);
  if (!isFinite(v)) return '—';
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

/* =========================
   Info popups
========================= */
const clarityMap: Record<string, string> = {
  IF: 'Internally Flawless (best grade)',
  VVS1: 'Very Very Slightly Included 1',
  VVS2: 'Very Very Slightly Included 2',
  VS1: 'Very Slightly Included 1',
  VS2: 'Very Slightly Included 2',
  SI1: 'Slightly Included 1',
  SI2: 'Slightly Included 2',
  I1: 'Included – Visible inclusions',
};
const colorMap: Record<string, string> = {
  D: 'Colorless (highest grade)',
  E: 'Colorless – Slightly less than D',
  F: 'Colorless – Slight warmth',
  G: 'Near Colorless – Faint trace of color',
  H: 'Near Colorless – Slightly noticeable warmth',
  I: 'Near Colorless – Slight visible warmth',
  FIP: 'Fancy Intense Pink',
  FP: 'Fancy Pink',
  FVB: 'Fancy Vivid Blue',
  FVG: 'Fancy Vivid Green',
  FVP: 'Fancy Vivid Pink',
};
const gradeMap: Record<string, string> = { EX: 'Excellent', VG: 'Very Good', GD: 'Good', ID: 'Ideal', FR: 'Fair' };
const fluorescenceMap: Record<string, string> = { NON: 'None – No reaction to UV light', SLT: 'Slight – Minimal', VSL: 'Very Slight' };

function InfoPopup({ text, label, valueMap }: { text?: string; label?: string; valueMap: Record<string, string> }) {
  const [show, setShow] = useState(false);
  const refEl = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (refEl.current && !refEl.current.contains(e.target as Node)) setShow(false); };
    if (show) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show]);
  if (!text) return null;
  return (
    <span
      ref={refEl}
      style={{ cursor: 'pointer', color: '#0070f3', fontWeight: 'bold', position: 'relative' }}
      onClick={(e) => { e.stopPropagation(); setShow(p => !p); }}
    >
      {text}
      {show && (
        <span
          style={{
            display: 'block',
            background: '#fff',
            border: '1px solid #ccc',
            padding: '0.5rem',
            marginTop: '0.25rem',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            position: 'absolute',
            zIndex: 10,
            whiteSpace: 'normal',
            maxWidth: '260px'
          }}
        >
          <strong>{label || text}:</strong> {valueMap[text] || 'No info available'}
        </span>
      )}
    </span>
  );
}

/* =========================
   Component
========================= */
export default function SolitaireRingConfigurator() {
  // Header rates
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');

  // Rings
  const [rings, setRings] = useState<ProductCard[]>([]);
  const [ringsLoading, setRingsLoading] = useState(true);
  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);
  const [selectedRingCt, setSelectedRingCt] = useState<number | null>(null);
  const [ringPrice, setRingPrice] = useState<number>(0);
  const [ringPreview, setRingPreview] = useState<string | null>(null);
  const [collapseRings, setCollapseRings] = useState(false);

  // Diamonds
  const [natAll, setNatAll] = useState<Diamond[]>([]);
  const [natFiltered, setNatFiltered] = useState<Diamond[]>([]);
  const [natSort, setNatSort] = useState<SortKey>('price-asc');
  const [selectedNatural, setSelectedNatural] = useState<Diamond | null>(null);

  const [labAll, setLabAll] = useState<Diamond[]>([]);
  const [labFiltered, setLabFiltered] = useState<Diamond[]>([]);
const [labSort, setLabSort] = useState<SortKey>('price-asc');
  const [selectedLab, setSelectedLab] = useState<Diamond | null>(null);

const [lockNat, setLockNat] = useState(true);
const [lockLab, setLockLab] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'NAT' | 'LAB'>('NAT');

// Common filters (shared) + independent size range filters
const [common, setCommon] = useState({
  Shape: 'ROUND',
  Clarity: '',
  Color: '',
  Cut: '',
  Polish: '',
  Symm: '',
  Fluorescence: '',
});

// Independent size ranges
// under other useState lines
const [autoSeedKey, setAutoSeedKey] = useState<string | null>(null);


const [natSizeRange, setNatSizeRange] = useState<string>('');
const [labSizeRange, setLabSizeRange] = useState<string>('');

// Options (shared unions) + independent size-range option lists
const [shapeUnion, setShapeUnion] = useState<string[]>([]);
const [rangeUnionNat, setRangeUnionNat] = useState<string[]>([]);
const [rangeUnionLab, setRangeUnionLab] = useState<string[]>([]);

const [clarityNat, setClarityNat] = useState<string[]>([]);
const [colorNat, setColorNat] = useState<string[]>([]);
const [cutNat, setCutNat] = useState<string[]>([]);
const [polishNat, setPolishNat] = useState<string[]>([]);
const [symmNat, setSymmNat] = useState<string[]>([]);
const [fluorNat, setFluorNat] = useState<string[]>([]);

const [clarityLab, setClarityLab] = useState<string[]>([]);
const [colorLab, setColorLab] = useState<string[]>([]);
const [cutLab, setCutLab] = useState<string[]>([]);
const [polishLab, setPolishLab] = useState<string[]>([]);
const [symmLab, setSymmLab] = useState<string[]>([]);
const [fluorLab, setFluorLab] = useState<string[]>([]);


const jumpToDiamonds = (tab: 'NAT' | 'LAB') => {
  setActiveTab(tab);
  step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const handleChangeNatural = () => {
  setSelectedNatural(null);
  setLockNat(false);      // <— unlock NAT grid
  jumpToDiamonds('NAT');
};

const handleChangeLab = () => {
  setSelectedLab(null);
  setLockLab(false);      // <— unlock LAB grid
  jumpToDiamonds('LAB');
};



  // Search param
  const searchParams = useSearchParams();
  const searchParam = (searchParams?.get?.('search') ?? '').toLowerCase();

  // Refs
  const step2Ref = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<HTMLDivElement>(null);

  const heading = useMemo(() => {
    if (searchParam) return `Solitaire Rings — search: "${searchParam}"`;
    return 'Build Your Solitaire Ring';
  }, [searchParam]);

  /* Rates */
  useEffect(() => {
    const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const dateRef = ref(db, 'Global SKU/Rates/Date');
    const un1 = onValue(rateRef, s => setGoldRate(s.val()));
    const un2 = onValue(dateRef, s => setRateDate(s.val()));
    return () => { un1(); un2(); };
  }, []);

  /* Rings + images */
  useEffect(() => {
    setRingsLoading(true);
    const skuRef = ref(db, 'Global SKU/SKU/');
    const imgRef = ref(db, 'Global SKU/Images/');

    const unsub = onValue(skuRef, async (skuSnap) => {
      try {
        const skuData = skuSnap.val() || {};
        let imgData: ImageIndex = {};
        try {
          const imgSnap = await get(imgRef);
          imgData = imgSnap.exists() ? (imgSnap.val() as ImageIndex) : {};
        } catch {
          imgData = {};
        }

        const all = Object.entries(skuData) as [string, RawSkuData][];
        const filtered = all.filter(([k, v]) => filterSolitaireRings(k, v, searchParam));

        const list: ProductCard[] = filtered
          .map(([key, val]) => {
            const imageUrl = imgData?.[key]?.Primary || '/product-placeholder.jpg';
            const stone2Ct = getStone2Ct(val);
            const priceNum =
              typeof val.grTotalPrice === 'number'
                ? val.grTotalPrice
                : Number(val.grTotalPrice);
            const price = Number.isFinite(priceNum) ? priceNum : '—';
            return { id: key, price, image: imageUrl, remarksLower: (val.remarks ?? '').toLowerCase(), stone2Ct };
          })
          .sort((a, b) => {
            const A = typeof a.price === 'number' ? a.price : Number.MAX_SAFE_INTEGER;
            const B = typeof b.price === 'number' ? b.price : Number.MAX_SAFE_INTEGER;
            return A - B;
          });

        setRings(list);
      } catch (e) {
        console.error('Error loading rings:', e);
        setRings([]);
      } finally {
        setRingsLoading(false);
      }
    });

    return () => unsub();
  }, [searchParam]);

  /* Diamonds data */
  useEffect(() => {
    const natRef = ref(db, 'Global SKU/NaturalDiamonds');
    const unNat = onValue(natRef, (snapshot) => {
      const val = snapshot.val() || {};
      const arr: Diamond[] = Object.values(val).map(d => d as Diamond).filter(d => d.Status === 'AVAILABLE');
      setNatAll(arr);
    });

    const labRef = ref(db, 'Global SKU/CVD');
    const unLab = onValue(labRef, (snapshot) => {
      const val = snapshot.val() || {};
      const arr: Diamond[] = Object.values(val).map(d => d as Diamond).filter(d => d.Status === 'AVAILABLE');
      setLabAll(arr);
    });

    return () => { unNat(); unLab(); };
  }, []);

  /* Unions */
  useEffect(() => {
    const shapes = Array.from(new Set([
      ...natAll.map(d => d.Shape).filter(Boolean) as string[],
      ...labAll.map(d => d.Shape).filter(Boolean) as string[],
    ])).sort();
    setShapeUnion(shapes.length ? shapes : ['ROUND']);
    if (!shapes.includes(common.Shape)) {
      setCommon(prev => ({ ...prev, Shape: shapes[0] || 'ROUND' }));
    }
  }, [natAll, labAll]);
  /* Size union + AUTO pick to 1.00ct if ring is selected */
useEffect(() => {
  // independent size-range option lists
  const natRanges = rangesFromRaw(natAll, common.Shape);
  const labRanges = rangesFromRaw(labAll, common.Shape);
  setRangeUnionNat(natRanges);
  setRangeUnionLab(labRanges);

  // if current selection no longer valid for this shape, clear it
  setNatSizeRange(prev => (prev && !natRanges.includes(prev) ? '' : prev));
  setLabSizeRange(prev => (prev && !labRanges.includes(prev) ? '' : prev));

  // On ring select, auto-pick ~1.00 ct for BOTH datasets independently
  if (selectedRingId) {
const pickNat = findFirstRangeAtLeast(1.0, natRanges);
const pickLab = findFirstRangeAtLeast(1.0, labRanges);
setNatSizeRange(pickNat || '');
setLabSizeRange(pickLab || '');
}

}, [natAll, labAll, common.Shape, selectedRingId]);



useEffect(() => {
  const scopedNat = natAll.filter(d => d.Shape === common.Shape);
  const scopedLab = labAll.filter(d => d.Shape === common.Shape);

  const uniq = (arr: Diamond[], key: keyof Diamond) =>
    Array.from(new Set(arr.map(d => d[key]).filter(Boolean) as string[])).sort();

  setClarityNat(uniq(scopedNat, 'Clarity'));
  setColorNat(uniq(scopedNat, 'Color'));
  setCutNat(uniq(scopedNat, 'Cut'));
  setPolishNat(uniq(scopedNat, 'Polish'));
  setSymmNat(uniq(scopedNat, 'Symm'));
  setFluorNat(uniq(scopedNat, 'Fluorescence'));

  setClarityLab(uniq(scopedLab, 'Clarity'));
  setColorLab(uniq(scopedLab, 'Color'));
  setCutLab(uniq(scopedLab, 'Cut'));
  setPolishLab(uniq(scopedLab, 'Polish'));
  setSymmLab(uniq(scopedLab, 'Symm'));
  setFluorLab(uniq(scopedLab, 'Fluorescence'));

  // ensure currently chosen common filters are valid for the ACTIVE TAB pool
  const pools = activeTab === 'NAT'
    ? {
        Clarity: uniq(scopedNat, 'Clarity'),
        Color:   uniq(scopedNat, 'Color'),
        Cut:     uniq(scopedNat, 'Cut'),
        Polish:  uniq(scopedNat, 'Polish'),
        Symm:    uniq(scopedNat, 'Symm'),
        Fluorescence: uniq(scopedNat, 'Fluorescence'),
      }
    : {
        Clarity: uniq(scopedLab, 'Clarity'),
        Color:   uniq(scopedLab, 'Color'),
        Cut:     uniq(scopedLab, 'Cut'),
        Polish:  uniq(scopedLab, 'Polish'),
        Symm:    uniq(scopedLab, 'Symm'),
        Fluorescence: uniq(scopedLab, 'Fluorescence'),
      };

  setCommon(prev => ({
    ...prev,
    Clarity: pools.Clarity.includes(prev.Clarity) ? prev.Clarity : '',
    Color: pools.Color.includes(prev.Color) ? prev.Color : '',
    Cut: pools.Cut.includes(prev.Cut) ? prev.Cut : '',
    Polish: pools.Polish.includes(prev.Polish) ? prev.Polish : '',
    Symm: pools.Symm.includes(prev.Symm) ? prev.Symm : '',
    Fluorescence: pools.Fluorescence.includes(prev.Fluorescence) ? prev.Fluorescence : '',
  }));
}, [common.Shape, natAll, labAll, activeTab]);


  /* Ring change: cache ring price, collapse list, scroll to diamonds */
useEffect(() => {
  const ring = rings.find(r => r.id === selectedRingId);
  const ct = ring?.stone2Ct ?? null;
  setSelectedRingCt(ct);

  // clear current selections first
  setSelectedNatural(null);
  setSelectedLab(null);

  // we always start from NAT tab after ring choose
  setActiveTab('NAT');

  // cache mount price
  setRingPrice(typeof ring?.price === 'number' ? ring.price : 0);

  if (selectedRingId) {
    // force ROUND (requirement) and arm one-time auto-selection
    setCommon(prev => ({ ...prev, Shape: 'ROUND' }));
    setAutoSeedKey(selectedRingId); // <- this tells the filter effect to pick first items

    setCollapseRings(true);
    setTimeout(() => {
      step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  } else {
    setCollapseRings(false);
  }
setLockNat(true);
setLockLab(true);
}, [selectedRingId, rings]);


  /* Filter diamonds; band around 1.00ct when a ring is selected */
useEffect(() => {
  const applyCommon = (list: Diamond[]) => {
    let result = list.filter(d => (!common.Shape || d.Shape === common.Shape));
    if (common.Clarity)   result = result.filter(d => d.Clarity === common.Clarity);
    if (common.Color)     result = result.filter(d => d.Color === common.Color);
    if (common.Cut)       result = result.filter(d => d.Cut === common.Cut);
    if (common.Polish)    result = result.filter(d => d.Polish === common.Polish);
    if (common.Symm)      result = result.filter(d => d.Symm === common.Symm);
    if (common.Fluorescence) result = result.filter(d => d.Fluorescence === common.Fluorescence);
    return result;
  };

// NATURAL
let nat = applyCommon(natAll);
if (natSizeRange) {
  nat = nat.filter(d => keepInChosenRange(d, natSizeRange));
} else {
  const natTargetMin = selectedRingId ? 1.0 : (selectedRingCt ?? null);
  if (natTargetMin != null) nat = nat.filter(d => sizeNum(d.Size) >= natTargetMin);
}

  nat = nat.sort((a, b) => {
    if (natSort === 'price-asc') return (a.OfferPrice ?? 0) - (b.OfferPrice ?? 0);
    if (natSort === 'price-desc') return (b.OfferPrice ?? 0) - (a.OfferPrice ?? 0);
    if (natSort === 'size-asc')   return parseFloat(a.Size ?? '0') - parseFloat(b.Size ?? '0');
    return parseFloat(b.Size ?? '0') - parseFloat(a.Size ?? '0');
  });
  setNatFiltered(nat);


// LAB
let lab = applyCommon(labAll);
if (labSizeRange) {
  lab = lab.filter(d => keepInChosenRange(d, labSizeRange));
} else {
  const labTargetMin = selectedRingId ? 1.0 : (selectedRingCt ?? null);
  if (labTargetMin != null) lab = lab.filter(d => sizeNum(d.Size) >= labTargetMin);
}

  lab = lab.sort((a, b) => {
    if (labSort === 'price-asc') return (a.OfferPrice ?? 0) - (b.OfferPrice ?? 0);
    if (labSort === 'price-desc') return (b.OfferPrice ?? 0) - (a.OfferPrice ?? 0);
    if (labSort === 'size-asc')   return parseFloat(a.Size ?? '0') - parseFloat(b.Size ?? '0');
    return parseFloat(b.Size ?? '0') - parseFloat(a.Size ?? '0');
  });
  setLabFiltered(lab);
}, [common, natAll, labAll, natSort, labSort, selectedRingId, selectedRingCt, natSizeRange, labSizeRange]);

useEffect(() => {
  if (!autoSeedKey || autoSeedKey !== selectedRingId) return;

  const byOffer = (a: Diamond, b: Diamond) =>
    (a.OfferPrice ?? a.MRP ?? Infinity) - (b.OfferPrice ?? b.MRP ?? Infinity);

  if (!selectedNatural && natFiltered.length) {
    setSelectedNatural([...natFiltered].sort(byOffer)[0]);
  }
  if (!selectedLab && labFiltered.length) {
    setSelectedLab([...labFiltered].sort(byOffer)[0]);
  }

  setAutoSeedKey(null); // do it once per ring pick
}, [autoSeedKey, selectedRingId, natFiltered, labFiltered, selectedNatural, selectedLab]);


  /* CTA */
const handleEnquire = () => {
  if (!selectedRingId) {
    alert('Please select a ring design first.');
    return;
  }
  if (!selectedNatural && !selectedLab) {
    alert('Please select at least one diamond (Natural or Lab-Grown).');
    return;
  }

  const natPrice = selectedNatural ? (selectedNatural.OfferPrice ?? selectedNatural.MRP ?? 0) : 0;
  const labPrice = selectedLab ? (selectedLab.OfferPrice ?? selectedLab.MRP ?? 0) : 0;
  const totalNat = ringPrice + (natPrice || 0);
  const totalLab = ringPrice + (labPrice || 0);

  const parts = [
    `Ring SKU: ${selectedRingId} (Mount: ${money(ringPrice)})`,
    selectedNatural ? `Natural: ${selectedNatural.StoneId} (${money(natPrice)})` : '',
    selectedLab ? `LabGrown: ${selectedLab.StoneId} (${money(labPrice)})` : '',
    selectedNatural ? `Total with Natural: ${money(totalNat)}` : '',
    selectedLab ? `Total with Lab-Grown: ${money(totalLab)}` : '',
  ].filter(Boolean);

  // One sentence, then a period.
  const summary = `Hello CityJeweller, I want to enquire about: ${parts.join(' ')}.`;

  // Admin lines in separate paragraphs.
  const adminLines = buildAdminProductLines(selectedRingId, selectedNatural, selectedLab);

  const text = `${summary}\n\n${adminLines}`;

  const url = `https://wa.me/919023130944?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};


const handleChangeRing = () => {
  setSelectedRingId(null);
  setSelectedRingCt(null);
  setCollapseRings(false);
  setSelectedNatural(null);
  setSelectedLab(null);
  setNatSizeRange('');
  setLabSizeRange('');
  setLockNat(true);   // reset locks
  setLockLab(true);
  setTimeout(() => step1Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
};

  const StepBadge = ({ n, active }: { n: number; active: boolean }) => (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${active ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-700'}`}>{n}</span>
  );


function DiamondCard({
  d, active, onSelect, enquirePrefix, isLab
}: {
  d: Diamond; active?: boolean; onSelect: () => void; enquirePrefix: string; isLab?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-2 hover:shadow ${active ? (isLab ? 'border-blue-600 ring-2 ring-blue-200' : 'border-emerald-600 ring-2 ring-emerald-200') : 'border-neutral-200'}`}>
      <div className="text-center">
        <Image src={shapeIcon[d.Shape ?? ''] || '/default.png'} alt={d.Shape || 'shape'} width={120} height={120} className="mx-auto" />
      </div>
      <div className="text-center">
        <p className="font-medium">{(sizeNum(d.Size)).toFixed(2)}ct ({d.Shape})</p>
        <p className="text-[13px] font-semibold mt-1">
          <InfoPopup text={d.Color} label="Color" valueMap={colorMap} /> · <InfoPopup text={d.Clarity} label="Clarity" valueMap={clarityMap} />
        </p>
        <p className="text-[12px] text-neutral-600 mt-1">{isLab ? 'CVD · ' : ''}{d.Measurement ?? ''} mm</p>
        <p className="text-[12px] text-neutral-600">
          D {((parseFloat(d.Depth ?? '0')) || 0).toFixed(2)}% , T {((parseFloat(d.Table ?? '0')) || 0).toFixed(2)}%
        </p>
        <p className="text-[12px] text-neutral-700">
          <InfoPopup text={d.Cut} label="Cut" valueMap={gradeMap} />, <InfoPopup text={d.Polish} label="Polish" valueMap={gradeMap} />, <InfoPopup text={d.Symm} label="Symmetry" valueMap={gradeMap} />, <InfoPopup text={d.Fluorescence} label="Fluorescence" valueMap={fluorescenceMap} />
        </p>
        {(d.MRP || d.OfferPrice) && (
          <p className="mt-1">
            {d.MRP ? <span className="line-through text-neutral-400 mr-2">{money(d.MRP)}</span> : null}
            {d.OfferPrice ? <span className="text-red-600 font-bold">{money(d.OfferPrice)}</span> : null}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[0.8rem] font-semibold">{d.StoneId}</span>
        <div className="flex items-center gap-2">
          <button
            className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
            onClick={onSelect}
          >
            {active ? 'Unselect' : 'Select'}
          </button>
          <a
            className="text-xs px-2 py-1 rounded bg-green-500 text-white"
            href={`https://wa.me/919023130944?text=${encodeURIComponent(
              `I am interested in ${enquirePrefix} ${d.StoneId}.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Enquire
          </a>
        </div>
      </div>
    </div>
  );
}




  /* UI */
  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />

      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center py-2 rounded mb-4">
        Mount prices exclude solitaire. <b>Totals update once you select a diamond.</b>
      </div>

      <h1 className="text-xl md:text-2xl font-bold">{heading}</h1>

      {/* Stepper */}
      <div className="mt-3 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <StepBadge n={1} active />
          <span>Choose Ring Design</span>
        </div>
        <span className="text-neutral-300">—</span>
        <div className="flex items-center gap-2">
          <StepBadge n={2} active={!!selectedRingId} />
          <span>Select Diamond</span>
        </div>
      </div>

      {/* STEP 1: RINGS */}
      <section ref={step1Ref} className="mt-4 rounded-2xl border border-neutral-200 bg-white/70 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Step 1 · Pick a Ring Design</h2>
          <span className="text-xs text-neutral-500">{rings.length} item(s)</span>
        </div>

        {ringsLoading && <p className={styles.loadingBlink}>Loading rings…</p>}

        {!ringsLoading && (
          <div className={`mt-3 ${collapseRings ? '' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'}`}>
            {(collapseRings && selectedRingId
              ? rings.filter(r => r.id === selectedRingId)
              : rings
            ).map((r) => {
              const active = r.id === selectedRingId;
              return (
                <div key={r.id} className={`rounded-xl overflow-hidden border text-left transition ${active ? 'border-emerald-600 ring-2 ring-emerald-200' : 'border-neutral-200'}`}>
                  <button
                    onClick={() => setSelectedRingId(r.id)}
                    className="w-full text-left"
                    title={`Stone2 ~ ${r.stone2Ct ? r.stone2Ct.toFixed(2) + 'ct' : '—'}`}
                  >
                    <Image src={r.image} alt={r.id} width={600} height={600} className="w-full aspect-square object-cover" />
                    <div className="p-2">
                      <div className="font-semibold text-sm">{r.id}; Mount = {money(r.price)} </div>
                    </div>
                  </button>

                  {collapseRings && (
                    <div className="px-2 pb-2 flex items-center gap-2">
                      <button
                        className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
                        onClick={(e) => { e.stopPropagation(); setRingPreview(r.id); }}
                      >
                        Quick view
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
                        onClick={(e) => { e.stopPropagation(); handleChangeRing(); }}
                      >
                        Change ring
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* STEP 2: DIAMONDS */}
      <section
        ref={step2Ref}
        className={`mt-5 rounded-2xl border bg-white/70 p-3 ${selectedRingId ? 'border-neutral-200' : 'border-neutral-100 opacity-60 pointer-events-none'}`}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold">Step 2 · Select Diamond</h2>
          <div className="text-xs text-neutral-500">
  {activeTab === 'NAT'
    ? (natSizeRange ? `Size: ${natSizeRange}` : selectedRingId ? 'Auto size set to ~1.00ct · ±0.10ct' : 'Pick a ring to auto-set size')
    : (labSizeRange ? `Size: ${labSizeRange}` : selectedRingId ? 'Auto size set to ~1.00ct · ±0.10ct' : 'Pick a ring to auto-set size')}
</div>

        </div>

        {/* Tabs */}
        <div className="mt-3 inline-flex rounded-lg border border-neutral-200 overflow-hidden">
          <button className={`px-4 py-2 text-sm ${activeTab === 'NAT' ? 'bg-emerald-600 text-white' : 'bg-white'}`} onClick={() => setActiveTab('NAT')}>Natural Diamonds</button>
          <button className={`px-4 py-2 text-sm border-l ${activeTab === 'LAB' ? 'bg-emerald-600 text-white' : 'bg-white'}`} onClick={() => setActiveTab('LAB')}>Lab-Grown Diamonds</button>
        </div>

        {/* Filters */}
        <div className={styles.stickyFilterContainer}
             style={{ justifyContent: 'center', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', margin: '0.8rem 0' }}>
          <label className={styles.filterLabel}>Shape:{' '}
  <select
    value={common.Shape}
    onChange={(e) => setCommon(prev => ({ ...prev, Shape: e.target.value }))}
  >
    {shapeUnion.map(s => <option key={s} value={s}>{s}</option>)}
  </select>
</label>

{/* Size (dataset-specific) */}
{activeTab === 'NAT' ? (
  <label className={styles.filterLabel}>Size:{' '}
    <select
      value={natSizeRange}
      onChange={(e) => setNatSizeRange(e.target.value)}
    >
      <option value="">All Size</option>
      {rangeUnionNat.map(r => <option key={r} value={r}>{r}</option>)}
    </select>
  </label>
) : (
  <label className={styles.filterLabel}>Size:{' '}
    <select
      value={labSizeRange}
      onChange={(e) => setLabSizeRange(e.target.value)}
    >
      <option value="">All Size</option>
      {rangeUnionLab.map(r => <option key={r} value={r}>{r}</option>)}
    </select>
  </label>
)}

{/* Attribute filters now use dataset-specific options */}
<label className={styles.filterLabel}>Clarity:{' '}
  <select
    value={common.Clarity}
    onChange={(e) => setCommon(prev => ({ ...prev, Clarity: e.target.value }))}
  >
    <option value="">All</option>
    {(activeTab === 'NAT' ? clarityNat : clarityLab).map(v => <option key={v} value={v}>{v}</option>)}
  </select>
</label>

<label className={styles.filterLabel}>Color:{' '}
  <select
    value={common.Color}
    onChange={(e) => setCommon(prev => ({ ...prev, Color: e.target.value }))}
  >
    <option value="">All</option>
    {(activeTab === 'NAT' ? colorNat : colorLab).map(v => <option key={v} value={v}>{v}</option>)}
  </select>
</label>

<label className={styles.filterLabel}>Cut:{' '}
  <select
    value={common.Cut}
    onChange={(e) => setCommon(prev => ({ ...prev, Cut: e.target.value }))}
  >
    <option value="">All</option>
    {(activeTab === 'NAT' ? cutNat : cutLab).map(v => <option key={v} value={v}>{v}</option>)}
  </select>
</label>

<label className={styles.filterLabel}>Polish:{' '}
  <select
    value={common.Polish}
    onChange={(e) => setCommon(prev => ({ ...prev, Polish: e.target.value }))}
  >
    <option value="">All</option>
    {(activeTab === 'NAT' ? polishNat : polishLab).map(v => <option key={v} value={v}>{v}</option>)}
  </select>
</label>

<label className={styles.filterLabel}>Symm:{' '}
  <select
    value={common.Symm}
    onChange={(e) => setCommon(prev => ({ ...prev, Symm: e.target.value }))}
  >
    <option value="">All</option>
    {(activeTab === 'NAT' ? symmNat : symmLab).map(v => <option key={v} value={v}>{v}</option>)}
  </select>
</label>

<label className={styles.filterLabel}>Fluor:{' '}
  <select
    value={common.Fluorescence}
    onChange={(e) => setCommon(prev => ({ ...prev, Fluorescence: e.target.value }))}
  >
    <option value="">All</option>
    {(activeTab === 'NAT' ? fluorNat : fluorLab).map(v => <option key={v} value={v}>{v}</option>)}
  </select>
</label>
        </div>

        {/* Sorting */}
        <div className="flex items-center justify-end gap-3 text-sm">
          {activeTab === 'NAT' ? (
            <>
              <label htmlFor="natSort">Sort (Natural): </label>
              <select
  id="natSort"
  value={natSort}
  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNatSort(e.target.value as SortKey)}
>

                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
                <option value="size-asc">Size: Small → Large</option>
                <option value="size-desc">Size: Large → Small</option>
              </select>
            </>
          ) : (
            <>
              <label htmlFor="labSort">Sort (Lab): </label>
              <select
  id="labSort"
  value={labSort}
  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLabSort(e.target.value as SortKey)}
>

                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
                <option value="size-asc">Size: Small → Large</option>
                <option value="size-desc">Size: Large → Small</option>
              </select>
            </>
          )}
        </div>

        {/* Grids */}
        <div className="mt-2">
          {activeTab === 'NAT' && (
  <>
    <p className={styles.itemCount}>
      {lockNat && selectedNatural ? 'Auto-selected one natural diamond' : `Showing ${natFiltered.length} natural diamonds`}
    </p>

    {lockNat && selectedNatural ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
        {/* render ONLY the selected card */}
        <DiamondCard
          d={selectedNatural}
          active
          onSelect={() => {}}
          enquirePrefix="Product ID"
          isLab={false}
        />
      </div>
    ) : (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
        {natFiltered.map(d => (
          <DiamondCard
            key={d.StoneId}
            d={d}
            active={selectedNatural?.StoneId === d.StoneId}
            onSelect={() => setSelectedNatural(selectedNatural?.StoneId === d.StoneId ? null : d)}
            enquirePrefix="Product ID"
            isLab={false}
          />
        ))}
      </div>
    )}
  </>
)}


{activeTab === 'LAB' && (
  <>
    <p className={styles.itemCount}>
      {lockLab && selectedLab ? 'Auto-selected one lab-grown diamond' : `Showing ${labFiltered.length} lab-grown diamonds`}
    </p>

    {lockLab && selectedLab ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
        <DiamondCard
          d={selectedLab}
          active
          onSelect={() => {}}
          enquirePrefix="your Product ID"
          isLab
        />
      </div>
    ) : (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
        {labFiltered.map(d => (
          <DiamondCard
            key={d.StoneId}
            d={d}
            active={selectedLab?.StoneId === d.StoneId}
            onSelect={() => setSelectedLab(selectedLab?.StoneId === d.StoneId ? null : d)}
            enquirePrefix="your Product ID"
            isLab
          />
        ))}
      </div>
    )}
  </>
)}


        </div>
      </section>

      {/* Sticky compare bar */}
      <div className="sticky bottom-2 z-10 mt-5 rounded-2xl border bg-white p-3 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs md:text-sm grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6">
            <div><b>Ring:</b> {selectedRingId || '—'}</div>
            <div><b>Mount:</b> {money(ringPrice)}</div>

            <div className="flex items-center gap-2">
              <span>
                <b>Natural:</b>{' '}
                {selectedNatural
                  ? `${sizeNum(selectedNatural.Size).toFixed(2)}ct · ${selectedNatural.Color}-${selectedNatural.Clarity} · ${money(selectedNatural.OfferPrice ?? selectedNatural.MRP ?? 0)}`
                  : '—'}
              </span>
              <button
                className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
                onClick={handleChangeNatural}
              >
                Change
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span>
                <b>Lab-Grown:</b>{' '}
                {selectedLab
                  ? `${sizeNum(selectedLab.Size).toFixed(2)}ct · ${selectedLab.Color}-${selectedLab.Clarity} · ${money(selectedLab.OfferPrice ?? selectedLab.MRP ?? 0)}`
                  : '—'}
              </span>
              <button
                className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
                onClick={handleChangeLab}
              >
                Change
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-4">
            <div className="rounded-lg border p-2 text-center">
              <div className="text-[11px] text-neutral-500">Total with Natural</div>
              <div className="text-base font-semibold">
                {selectedNatural
                  ? money(ringPrice + (selectedNatural.OfferPrice ?? selectedNatural.MRP ?? 0))
                  : '—'}
              </div>
            </div>
            <div className="rounded-lg border p-2 text-center">
              <div className="text-[11px] text-neutral-500">Total with Lab-Grown</div>
              <div className="text-base font-semibold">
                {selectedLab
                  ? money(ringPrice + (selectedLab.OfferPrice ?? selectedLab.MRP ?? 0))
                  : '—'}
              </div>
            </div>
          </div>

          <button
            onClick={handleEnquire}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
          >
            Enquire on WhatsApp
          </button>
        </div>
      </div>

      {/* Quick view */}
      {ringPreview && (
        <SkuSummaryModal skuId={ringPreview} onClose={() => setRingPreview(null)} />
      )}
    </PageLayout>
  );
}
