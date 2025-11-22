'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ref, onValue, get } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import { useSearchParams } from 'next/navigation';

import PageLayout from '../../components/PageLayout';
import OfferBar from '../../components/OfferBar';
import SkuSummaryModal from '../../components/SkuSummaryModal'; // NEW

import styles from '../../page.module.css';
import shapeIcon from '../../../../assets/shapeIcons';
import { filterSolitaireRings } from './filters';

import TrustInfoStrip from '../../components/TrustInfoStrip';


/* =========================
   Config
========================= */
const BASE_CT = 0.50; // baseline carat for auto picks & defaults
const DEFAULT_RANGE_NAT = '0.50-0.59';
const DEFAULT_RANGE_LAB = '0.50-0.69';

/* =========================
   Types
========================= */

type ImageIndex = Record<string, { Primary?: string }>;
type SortKey = 'price-asc' | 'price-desc' | 'size-asc' | 'size-desc';
type DiamondMode = 'NAT' | 'LAB' | 'COMPARE';
type StepNumber = 1 | 2 | 3;

type RawSkuData = {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
  goldPurety?: string;
  goldPurity?: string;
  GoldPurity?: string;
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
  Size?: string;       // e.g. "0.52"
  SizeRange?: string;  // e.g. "0.50-0.59"
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

type NumericLike = string | number | null | undefined;

type RingDetails = {
  goldPurety?: NumericLike;
  goldPurity?: NumericLike;
  GoldPurity?: NumericLike;
  [key: string]: unknown;
};


/* =========================
   Helpers
========================= */

// === Size helpers
const sizeNum = (s?: string) => {
  const n = parseFloat((s ?? '').toString());
  return Number.isFinite(n) ? n : 0;
};

const toFloat = (s: string) => parseFloat((s || '').trim());

// Normalize "0.50 – 0.59", " 0.50-0.59 " etc → "0.50-0.59"
const normalizeRangeStr = (raw?: string): string => {
  const s = (raw ?? '').toString().trim().replace(/[–—]/g, '-');
  return s.replace(/\s*-\s*/g, '-');
};

// Pretty print from parsed range (keeps at least 2 decimals)
const prettyRange = (min: number, max: number, decimals = 2) =>
  `${min.toFixed(decimals)}-${max.toFixed(decimals)}`;

const parseRangeStr = (range?: string): { min: number; max: number; decimals: number } | null => {
  const r = normalizeRangeStr(range);
  if (!r) return null;
  const m = r.match(/([0-9]*\.?[0-9]+)-([0-9]*\.?[0-9]+)/);
  if (!m) return null;
  const min = toFloat(m[1]);
  const max = toFloat(m[2]);
  if (!isFinite(min) || !isFinite(max)) return null;
  const d1 = (m[1].split('.')[1]?.length ?? 0);
  const d2 = (m[2].split('.')[1]?.length ?? 0);
  return { min, max, decimals: Math.max(d1, d2, 2) };
};

const inParsedRange = (val: number, parsed: { min: number; max: number } | null) =>
  parsed ? (val >= parsed.min && val <= parsed.max) : true;

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

// Returns unique, normalized size ranges for a given shape (sorted by numeric min/max)
const rangesFromRaw = (arr: Diamond[], shape: string): string[] => {
  const raw = arr
    .filter(d => d.Shape === shape)
    .map(d => normalizeRangeStr(d.SizeRange ?? ''))
    .filter(Boolean) as string[];

  const unique = Array.from(new Set(raw));
  const parsed = unique
    .map(r => ({ raw: r, pr: parseRangeStr(r)! }))
    .filter(x => !!x.pr)
    .sort((a, b) => (a.pr.min - b.pr.min) || (a.pr.max - b.pr.max));

  return parsed.map(x => prettyRange(x.pr.min, x.pr.max, x.pr.decimals));
};

// If preferred range exists, use it; else use any union range that contains BASE_CT; else closest >= BASE_CT
const resolveInitialRange = (union: string[], preferred: string) => {
  const prefNorm = normalizeRangeStr(preferred);
  const unionNorm = union.map(normalizeRangeStr);
  if (unionNorm.includes(prefNorm)) return prefNorm;
  const containsBase = unionNorm.find(r => inParsedRange(BASE_CT, parseRangeStr(r)));
  if (containsBase) return containsBase;
  return findFirstRangeAtLeast(BASE_CT, unionNorm) || '';
};

const buildAdminProductLines = (
  _ringId: string | null,
  nat?: Diamond | null,
  lab?: Diamond | null
) => {
  const lines: string[] = [];
  if (lab?.StoneId) lines.push(`I am interested in your Product ID ${lab.StoneId}.`);
  if (nat?.StoneId) lines.push(`I am interested in Product ID ${nat.StoneId}.`);
  return lines.join('\n\n');
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

// If a range is chosen, accept SizeRange === chosen (normalized) OR numeric Size within chosen.
const keepInChosenRange = (d: Diamond, chosen: string) => {
  if (!chosen) return true;
  const chosenNorm = normalizeRangeStr(chosen);
  const recNorm = normalizeRangeStr(d.SizeRange ?? '');
  if (recNorm && recNorm === chosenNorm) return true;
  const pr = parseRangeStr(chosenNorm);
  const sz = sizeNum(d.Size);
  return inParsedRange(sz, pr);
};

const money = (n?: number | string | null) => {
  const v = typeof n === 'number' ? n : Number(n ?? 0);
  if (!isFinite(v)) return '—';
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

// NEW: loose numeric parser + field pickers for mount detail
const parseLooseNumber = (v: NumericLike): number | null => {
  if (v === null || v === undefined) return null;

  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : null;
  }

  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  return null;
};

const pickFirstNumber = (
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): number | null => {
  if (!obj) return null;

  for (const key of keys) {
    const value = obj[key];
    const n = parseLooseNumber(value as NumericLike);
    if (n !== null && n > 0) return n;
  }

  return null;
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

  // Steps (for showing only one section at a time)
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [hoveredStep, setHoveredStep] = useState<StepNumber | null>(null); // NEW

  // Rings
  const [rings, setRings] = useState<ProductCard[]>([]);
  const [ringsLoading, setRingsLoading] = useState(true);
  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);
  const [ringPrice, setRingPrice] = useState<number>(0);
  const [ringDetails, setRingDetails] = useState<RingDetails | null>(null);
  const [mountInfoSkuId, setMountInfoSkuId] = useState<string | null>(null); // NEW – for (i) modal

  // Diamonds
  const [natAll, setNatAll] = useState<Diamond[]>([]);
  const [natFiltered, setNatFiltered] = useState<Diamond[]>([]);
  const [natSort, setNatSort] = useState<SortKey>('price-asc');
  const [selectedNatural, setSelectedNatural] = useState<Diamond | null>(null);

  const [labAll, setLabAll] = useState<Diamond[]>([]);
  const [labFiltered, setLabFiltered] = useState<Diamond[]>([]);
  const [labSort, setLabSort] = useState<SortKey>('price-asc');
  const [selectedLab, setSelectedLab] = useState<Diamond | null>(null);

  // auto-pick state flags
  const [userPickedNat, setUserPickedNat] = useState(false);
  const [userPickedLab, setUserPickedLab] = useState(false);

  // Tabs / mode
  const [diamondMode, setDiamondMode] = useState<DiamondMode>('NAT');
  const [activeTab, setActiveTab] = useState<'NAT' | 'LAB'>('NAT'); // which list is currently visible

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

  // Search param
  const searchParams = useSearchParams();
  const searchParam = (searchParams?.get?.('search') ?? '').toLowerCase();

  const heading = useMemo(() => {
    if (searchParam) return `Solitaire Rings — search: "${searchParam}"`;
    return 'Build Your Solitaire Ring';
  }, [searchParam]);

  const selectedRing = useMemo(
    () => rings.find(r => r.id === selectedRingId) || null,
    [rings, selectedRingId]
  );

  const chooseNat = (d: Diamond | null) => {
    setSelectedNatural(d);
    setUserPickedNat(!!d);
  };

  const chooseLab = (d: Diamond | null) => {
    setSelectedLab(d);
    setUserPickedLab(!!d);
  };

  /* Step navigation – clickable stepper */
  const goToStep = (step: StepNumber) => {
    if (step === 2 && !selectedRingId) {
      alert('Please choose a ring design first.');
      setCurrentStep(1);
      return;
    }
    if (step === 3 && !selectedRingId) {
      alert('Please choose a ring design first.');
      setCurrentStep(1);
      return;
    }
    setCurrentStep(step);
  };

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

  /* Diamonds data — load ONLY after a ring is chosen */
  useEffect(() => {
    if (!selectedRingId) {
      setNatAll([]);
      setLabAll([]);
      return;
    }

    const natRef = ref(db, 'Global SKU/NaturalDiamonds');
    const labRef = ref(db, 'Global SKU/CVD');

    const unNat = onValue(natRef, (snapshot) => {
      const val = snapshot.val() || {};
      const arr: Diamond[] = Object.values(val)
        .map(d => d as Diamond)
        .filter(d => d.Status === 'AVAILABLE');
      setNatAll(arr);
    });

    const unLab = onValue(labRef, (snapshot) => {
      const val = snapshot.val() || {};
      const arr: Diamond[] = Object.values(val)
        .map(d => d as Diamond)
        .filter(d => d.Status === 'AVAILABLE');
      setLabAll(arr);
    });

    return () => { unNat(); unLab(); };
  }, [selectedRingId]);

  /* Unions (shapes across datasets) */
  useEffect(() => {
    if (!selectedRingId) {
      setShapeUnion(['ROUND']);
      return;
    }
    const shapes = Array.from(new Set([
      ...natAll.map(d => d.Shape).filter(Boolean) as string[],
      ...labAll.map(d => d.Shape).filter(Boolean) as string[],
    ])).sort();

    setShapeUnion(shapes.length ? shapes : ['ROUND']);
    if (!shapes.includes(common.Shape)) {
      setCommon(prev => ({ ...prev, Shape: shapes[0] || 'ROUND' }));
    }
  }, [natAll, labAll, selectedRingId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Size unions + set DEFAULT ranges (~0.50ct bands) AFTER ring select */
  useEffect(() => {
    if (!selectedRingId) {
      setRangeUnionNat([]);
      setRangeUnionLab([]);
      setNatSizeRange('');
      setLabSizeRange('');
      return;
    }

    const natRanges = rangesFromRaw(natAll, common.Shape);
    const labRanges = rangesFromRaw(labAll, common.Shape);
    setRangeUnionNat(natRanges);
    setRangeUnionLab(labRanges);

    setNatSizeRange(prev => {
      const p = normalizeRangeStr(prev);
      return p && !natRanges.map(normalizeRangeStr).includes(p) ? '' : p;
    });
    setLabSizeRange(prev => {
      const p = normalizeRangeStr(prev);
      return p && !labRanges.map(normalizeRangeStr).includes(p) ? '' : p;
    });

    const natPick = resolveInitialRange(natRanges, DEFAULT_RANGE_NAT);
    const labPick = resolveInitialRange(labRanges, DEFAULT_RANGE_LAB);
    setNatSizeRange(natPick);
    setLabSizeRange(labPick);
  }, [natAll, labAll, common.Shape, selectedRingId]);

  /* Dataset-specific attribute unions & validate current filters per active tab */
  useEffect(() => {
    if (!selectedRingId) {
      setClarityNat([]); setColorNat([]); setCutNat([]); setPolishNat([]); setSymmNat([]); setFluorNat([]);
      setClarityLab([]); setColorLab([]); setCutLab([]); setPolishLab([]); setSymmLab([]); setFluorLab([]);
      setCommon(prev => ({ ...prev, Clarity: '', Color: '', Cut: '', Polish: '', Symm: '', Fluorescence: '' }));
      return;
    }

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

    const usingNat = activeTab === 'NAT';
    const pools = usingNat
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
  }, [common.Shape, natAll, labAll, activeTab, selectedRingId]);

  /* Sync diamondMode with visible tab */
  useEffect(() => {
    if (diamondMode === 'NAT') setActiveTab('NAT');
    else if (diamondMode === 'LAB') setActiveTab('LAB');
  }, [diamondMode]);

  /* When ring changes, reset selections & filters and fetch mount details */
  useEffect(() => {
    const ring = rings.find(r => r.id === selectedRingId);

    setSelectedNatural(null);
    setSelectedLab(null);
    setUserPickedNat(false);
    setUserPickedLab(false);

    setActiveTab('NAT');
    setDiamondMode('NAT');

    setRingPrice(typeof ring?.price === 'number' ? ring.price : 0);

    if (selectedRingId) {
      setCommon(prev => ({ ...prev, Shape: 'ROUND' }));
    } else {
      setCommon({
        Shape: 'ROUND',
        Clarity: '',
        Color: '',
        Cut: '',
        Polish: '',
        Symm: '',
        Fluorescence: '',
      });
      setNatSizeRange('');
      setLabSizeRange('');
      setCurrentStep(1);
    }
  }, [selectedRingId, rings]);

  // load full SKU record for selected mount
  useEffect(() => {
    if (!selectedRingId) {
      setRingDetails(null);
      return;
    }
    const skuRef = ref(db, `Global SKU/SKU/${selectedRingId}`);
    get(skuRef)
      .then((snap) => {
        setRingDetails(snap.exists() ? (snap.val() as RingDetails) : null);
      })
      .catch((err) => {
        console.error('Error loading selected ring details:', err);
        setRingDetails(null);
      });
  }, [selectedRingId]);

  /* Filter diamonds strictly by chosen size range (if any) */
  useEffect(() => {
    if (!selectedRingId) {
      setNatFiltered([]); setLabFiltered([]);
      return;
    }

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
    if (natSizeRange) nat = nat.filter(d => keepInChosenRange(d, natSizeRange));
    else nat = nat.filter(d => sizeNum(d.Size) >= BASE_CT);
    nat = nat.sort((a, b) => {
      if (natSort === 'price-asc') return (a.OfferPrice ?? a.MRP ?? 0) - (b.OfferPrice ?? b.MRP ?? 0);
      if (natSort === 'price-desc') return (b.OfferPrice ?? b.MRP ?? 0) - (a.OfferPrice ?? a.MRP ?? 0);
      if (natSort === 'size-asc')   return sizeNum(a.Size) - sizeNum(b.Size);
      return sizeNum(b.Size) - sizeNum(a.Size);
    });
    setNatFiltered(nat);

    // LAB
    let lab = applyCommon(labAll);
    if (labSizeRange) lab = lab.filter(d => keepInChosenRange(d, labSizeRange));
    else lab = lab.filter(d => sizeNum(d.Size) >= BASE_CT);
    lab = lab.sort((a, b) => {
      if (labSort === 'price-asc') return (a.OfferPrice ?? a.MRP ?? 0) - (b.OfferPrice ?? b.MRP ?? 0);
      if (labSort === 'price-desc') return (b.OfferPrice ?? b.MRP ?? 0) - (a.OfferPrice ?? a.MRP ?? 0);
      if (labSort === 'size-asc')   return sizeNum(a.Size) - sizeNum(b.Size);
      return sizeNum(b.Size) - sizeNum(a.Size);
    });
    setLabFiltered(lab);
  }, [common, natAll, labAll, natSort, labSort, selectedRingId, natSizeRange, labSizeRange]);

  /* Auto-pick cheapest within filtered lists, respecting mode and ignoring price = 0 */
  useEffect(() => {
    if (!selectedRingId) return;
    const price = (d: Diamond) => d.OfferPrice ?? d.MRP ?? Infinity;

    const baseNatPool = (diamondMode !== 'LAB')
      ? (natSizeRange
          ? natFiltered
          : natFiltered.filter(d => sizeNum(d.Size) >= BASE_CT))
      : [];
    const baseLabPool = (diamondMode !== 'NAT')
      ? (labSizeRange
          ? labFiltered
          : labFiltered.filter(d => sizeNum(d.Size) >= BASE_CT))
      : [];

    const natPool = baseNatPool.filter(d => (d.OfferPrice ?? d.MRP ?? 0) > 0);
    const labPool = baseLabPool.filter(d => (d.OfferPrice ?? d.MRP ?? 0) > 0);

    if (!userPickedNat && !selectedNatural && natPool.length) {
      const cheapestNat = [...natPool].sort((a, b) => price(a) - price(b))[0];
      if (cheapestNat) setSelectedNatural(cheapestNat);
    }
    if (!userPickedLab && !selectedLab && labPool.length) {
      const cheapestLab = [...labPool].sort((a, b) => price(a) - price(b))[0];
      if (cheapestLab) setSelectedLab(cheapestLab);
    }
  }, [
    selectedRingId,
    natFiltered, labFiltered,
    natSizeRange, labSizeRange,
    selectedNatural, selectedLab,
    userPickedNat, userPickedLab,
    diamondMode
  ]);

  /* CTA: WhatsApp */
  const handleEnquire = () => {
    if (!selectedRingId) {
      alert('Please select a ring design first.');
      return;
    }
    const needNat = (diamondMode === 'NAT' || diamondMode === 'COMPARE');
    const needLab = (diamondMode === 'LAB' || diamondMode === 'COMPARE');
    if ((needNat && !selectedNatural) && (needLab && !selectedLab)) {
      alert('Please select at least one diamond.');
      return;
    }

    const natPrice = selectedNatural ? (selectedNatural.OfferPrice ?? selectedNatural.MRP ?? 0) : 0;
    const labPrice = selectedLab ? (selectedLab.OfferPrice ?? selectedLab.MRP ?? 0) : 0;
    const totalNat = ringPrice + (natPrice || 0);
    const totalLab = ringPrice + (labPrice || 0);

    const parts = [
      `Ring SKU: ${selectedRingId} (Mount: ${money(ringPrice)})`,
      (needNat && selectedNatural) ? `Natural: ${selectedNatural.StoneId} (${money(natPrice)})` : '',
      (needLab && selectedLab) ? `LabGrown: ${selectedLab.StoneId} (${money(labPrice)})` : '',
      (needNat && selectedNatural) ? `Total with Natural: ${money(totalNat)}` : '',
      (needLab && selectedLab) ? `Total with Lab-Grown: ${money(totalLab)}` : '',
    ].filter(Boolean);

    const summary = `Hello CityJeweller, I want to enquire about: ${parts.join(' ')}.`;
const natArg = needNat ? selectedNatural : null;
const labArg = needLab ? selectedLab : null;

const adminLines = buildAdminProductLines(selectedRingId, natArg, labArg);

    const text = `${summary}\n\n${adminLines}`;

    const url = `https://wa.me/919023130944?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleGeneratePdf = () => {
    alert('PDF quote generation coming soon.');
  };

  const handleChangeRing = () => {
    setSelectedRingId(null);
    setSelectedNatural(null);
    setSelectedLab(null);
    setUserPickedNat(false);
    setUserPickedLab(false);
    setNatSizeRange('');
    setLabSizeRange('');
    setDiamondMode('NAT');
    setActiveTab('NAT');
    setCurrentStep(1);
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

  function SelectedDiamondSummary({
    label,
    diamond,
    isLab,
    auto,
    showProceed,
    onProceed,
  }: {
    label: string;
    diamond: Diamond;
    isLab?: boolean;
    auto?: boolean;
    showProceed?: boolean;
    onProceed?: () => void;
  }) {
    if (!diamond) return null;
    const price = diamond.OfferPrice ?? diamond.MRP ?? 0;
    return (
      <div className="mb-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-semibold text-[11px] uppercase tracking-wide text-neutral-700">
            {label}
          </span>
          <span className="mt-0.5 font-semibold">
            {sizeNum(diamond.Size).toFixed(2)}ct {diamond.Shape} · {diamond.Color}-{diamond.Clarity}
          </span>
          <span className="text-[11px] text-neutral-600">
            ID: {diamond.StoneId}
          </span>
          {isLab && (
            <span className="mt-0.5 inline-flex w-fit rounded-full bg-blue-50 px-2 py-[1px] text-[10px] text-blue-700">
              Lab-Grown (CVD)
            </span>
          )}
          {!isLab && (
            <span className="mt-0.5 inline-flex w-fit rounded-full bg-emerald-50 px-2 py-[1px] text-[10px] text-emerald-700">
              Natural Diamond
            </span>
          )}
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <div>
            <div className="text-sm font-bold">{price ? money(price) : '—'}</div>
            {auto && (
              <div className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-[2px] text-[10px] font-semibold text-amber-800">
                Auto-picked starting option
              </div>
            )}
          </div>

          {showProceed && onProceed && (
            <button
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700"
              onClick={onProceed}
            >
              Review Cart &amp; Enquiry
            </button>
          )}
        </div>
      </div>
    );
  }

  const isAutoNat = !!selectedNatural && !userPickedNat;
  const isAutoLab = !!selectedLab && !userPickedLab;

  // Derived numbers for review card
  const goldWt = pickFirstNumber(ringDetails, [
    'net', 'goldWt', 'Gold_Wt', 'NetWt', 'netWt', 'GoldWt21'
  ]);
  const labourAmt = pickFirstNumber(ringDetails, [
    'labourPrice', 'LabourAmt', 'LabourAmount', 'Making', 'MakingAmount', 'making'
  ]);

  const natAmt = selectedNatural ? (selectedNatural.OfferPrice ?? selectedNatural.MRP ?? 0) : 0;
  const labAmt = selectedLab ? (selectedLab.OfferPrice ?? selectedLab.MRP ?? 0) : 0;

  const goldPurityRaw =
    (ringDetails && (ringDetails.goldPurety || ringDetails.goldPurity || ringDetails.GoldPurity)) || '';
  const goldPurity =
    typeof goldPurityRaw === 'string' ? goldPurityRaw : String(goldPurityRaw || '');

// Extra breakdown fields for Product Details in Review Cart
const grossWt = pickFirstNumber(ringDetails as Record<string, unknown>, [
  'GrossWt', 'grossWt', 'Gross_Weight', 'GrossWeight', 'gross'
]);

const netWtFull = pickFirstNumber(ringDetails as Record<string, unknown>, [
  'NetWt', 'netWt', 'Net_Weight', 'NetWeight', 'net', 'goldWt', 'Gold_Wt', 'GoldWt21'
]);

const goldRatePerGm = pickFirstNumber(ringDetails as Record<string, unknown>, [
  'GoldRatePerGm', 'GoldRate', 'GoldRate18', 'GoldRatePerGram', 'rateGold', 'Rate_Gold'
]);

const sideDiamondCt = getStone2Ct((ringDetails || {}) as unknown as RawSkuData);

const sideDiamondRateCt = pickFirstNumber(ringDetails as Record<string, unknown>, [
  'Stone2RateCt', 'stone2RateCt', 'Stone2Rate', 'stone2Rate'
]);

const sideDiamondAmtFromRate =
  sideDiamondCt && sideDiamondRateCt ? sideDiamondCt * sideDiamondRateCt : null;

const sideDiamondAmt = pickFirstNumber(ringDetails as Record<string, unknown>, [
  'Stone2Price', 'stone2Price', 'Stone2Amount', 'stone2Amount', 'Stone2Amt'
]) ?? sideDiamondAmtFromRate;

const goldAmtFromRate =
  goldWt && goldRatePerGm ? goldWt * goldRatePerGm : null;

const goldAmt = pickFirstNumber(ringDetails as Record<string, unknown>, [
  'GoldAmount', 'goldAmount', 'GoldAmt', 'goldAmt', 'GoldPrice'
]) ?? goldAmtFromRate;

// Totals with solitaire
const totalWithNat = selectedNatural ? ringPrice + natAmt : ringPrice;
const totalWithLab = selectedLab ? ringPrice + labAmt : ringPrice;



  // NEW: active diamond for step labels & hover
  const activeDiamondForStep: Diamond | null = (() => {
    if (diamondMode === 'LAB') return selectedLab;
    if (diamondMode === 'NAT') return selectedNatural;
    return selectedNatural || selectedLab || null;
  })();

  // NEW: labels with price in step text
  const ringStepLabel = selectedRingId && ringPrice > 0
    ? `Choose Ring Design — ${money(ringPrice)}`
    : 'Choose Ring Design';

  const diamondStepLabel = (() => {
    const base = 'Select Diamond (Natural / Lab / Compare)';
    if (!activeDiamondForStep) return base;
    const amt = activeDiamondForStep.OfferPrice ?? activeDiamondForStep.MRP ?? 0;
    if (!amt) return base;
    return `${base} — ${money(amt)}`;
  })();

  /* UI */
  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />

      <h1 className="text-xl md:text-2xl font-bold">{heading}</h1>

      {/* Stepper – clickable & shows prices + hover quick glance */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => goToStep(1)}
          onMouseEnter={() => setHoveredStep(1)}
          onMouseLeave={() => setHoveredStep(null)}
        >
          <StepBadge n={1} active={currentStep === 1} />
          <span>{ringStepLabel}</span>
        </div>
        <span className="text-neutral-300">—</span>
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => goToStep(2)}
          onMouseEnter={() => setHoveredStep(2)}
          onMouseLeave={() => setHoveredStep(null)}
        >
          <StepBadge n={2} active={currentStep === 2} />
          <span>{diamondStepLabel}</span>
        </div>
        <span className="text-neutral-300">—</span>
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => goToStep(3)}
          onMouseEnter={() => setHoveredStep(3)}
          onMouseLeave={() => setHoveredStep(null)}
        >
          <StepBadge n={3} active={currentStep === 3} />
          <span>Review Cart &amp; Enquire</span>
        </div>
      </div>

      {/* Hover quick glance cards under stepper */}
      {hoveredStep === 1 && selectedRing && (
        <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm text-xs">
          <div className="relative w-10 h-10 rounded-md overflow-hidden bg-neutral-100">
            <Image src={selectedRing.image} alt={selectedRing.id} fill className="object-cover" />
          </div>
          <div>
            <div className="font-semibold text-sm">{selectedRing.id}</div>
            <div className="text-[11px] text-neutral-600">
              Mount: {money(ringPrice)}
            </div>
          </div>
        </div>
      )}

      {hoveredStep === 2 && activeDiamondForStep && (
        <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm text-xs">
          <div>
            <div className="font-semibold text-sm">
              {sizeNum(activeDiamondForStep.Size).toFixed(2)}ct {activeDiamondForStep.Shape}
            </div>
            <div className="text-[11px] text-neutral-600">
              {activeDiamondForStep.Color}-{activeDiamondForStep.Clarity} · ID: {activeDiamondForStep.StoneId}
            </div>
            <div className="text-[11px] text-neutral-800">
              {money(activeDiamondForStep.OfferPrice ?? activeDiamondForStep.MRP ?? 0)}
            </div>
          </div>
        </div>
      )}

      {/* STEP 1 – RING SELECTION */}
      {currentStep === 1 && (
        <section className="mt-4 rounded-2xl border border-neutral-200 bg-white/70 p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Step 1 · Pick a Ring Design</h2>
            <span className="text-xs text-neutral-500">{rings.length} item(s)</span>
          </div>

{selectedRing && (
  <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-100">
      <Image src={selectedRing.image} alt={selectedRing.id} fill className="object-cover" />
    </div>
    <div className="text-xs">
      <div className="font-semibold text-sm">{selectedRing.id}</div>
      <div className="text-neutral-600">Mount: {money(selectedRing.price)}</div>

      <div className="mt-1 flex flex-wrap gap-2">
        <button
          className="px-2 py-[3px] rounded-full border border-emerald-600 text-[11px] font-semibold text-emerald-700 bg-white"
          onClick={handleChangeRing}
        >
          Change ring
        </button>

        <button
          type="button"
          className="px-2 py-[3px] rounded-full border border-neutral-300 text-[11px] font-semibold text-neutral-800 bg-white"
          onClick={() => setMountInfoSkuId(selectedRing.id)}
        >
          View details
        </button>
      </div>
    </div>
  </div>
)}

          {ringsLoading && <p className={styles.loadingBlink}>Loading rings…</p>}

          {!ringsLoading && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
              {rings.map((r) => {
                const active = r.id === selectedRingId;
                return (
                  <div
                    key={r.id}
                    className={`relative rounded-xl overflow-hidden border text-left transition hover:shadow-sm cursor-pointer ${
                      active ? 'border-emerald-600 ring-2 ring-emerald-200' : 'border-neutral-200'
                    }`}
                    onClick={() => {
                      setSelectedRingId(r.id);
                      setCurrentStep(2);
                    }}
                    title={`Stone2 ~ ${r.stone2Ct ? r.stone2Ct.toFixed(2) + 'ct' : '—'}`}
                  >
{/* Details button for mounting breakup + enlarged image */}
<button
  type="button"
  className="absolute right-2 top-2 z-10 rounded-full bg-white px-3 py-[3px] text-[10px] font-semibold shadow border border-neutral-300"
  onClick={(e) => {
    e.stopPropagation();
    setMountInfoSkuId(r.id);
  }}
>
  Details
</button>


                    <Image src={r.image} alt={r.id} width={600} height={600} className="w-full aspect-square object-cover" />
                    <div className="p-2">
                      <div className="font-semibold text-sm truncate">{r.id}</div>
                      <div className="text-xs text-neutral-600">Mount: {money(r.price)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* STEP 2 – DIAMONDS */}
      {currentStep === 2 && (
        <section
          className="mt-4 rounded-2xl border border-neutral-200 bg-white/70 p-3 min-h-[260px]"
        >
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <div>
              <div className="text-xs text-neutral-500">Step 2 of 3</div>
              <h2 className="text-lg font-semibold">Choose Your Solitaire</h2>
            </div>

            {/* Mode switch: Natural / Lab / Compare */}
            <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 text-xs overflow-hidden">
              <button
                className={`px-3 py-1 ${diamondMode === 'NAT' ? 'bg-emerald-600 text-white' : ''}`}
                onClick={() => setDiamondMode('NAT')}
              >
                Natural
              </button>
              <button
                className={`px-3 py-1 border-l ${diamondMode === 'LAB' ? 'bg-blue-600 text-white' : ''}`}
                onClick={() => setDiamondMode('LAB')}
              >
                Lab-Grown
              </button>
              <button
                className={`px-3 py-1 border-l ${diamondMode === 'COMPARE' ? 'bg-neutral-900 text-white' : ''}`}
                onClick={() => setDiamondMode('COMPARE')}
              >
                Compare
              </button>
            </div>
          </div>

          {!selectedRingId && (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
              First choose a ring design in Step 1 to see matching Natural / Lab-grown solitaires.
            </div>
          )}

          {selectedRingId && (
            <>
              {/* Selected diamond summaries */}
              {(diamondMode === 'NAT' || diamondMode === 'COMPARE') && selectedNatural && (
                <SelectedDiamondSummary
                  label={diamondMode === 'COMPARE' ? 'Selected Natural Diamond' : 'Selected Diamond'}
                  diamond={selectedNatural}
                  isLab={false}
                  auto={isAutoNat}
                  showProceed={!!selectedRingId}
                  onProceed={() => setCurrentStep(3)}
                />
              )}

              {(diamondMode === 'LAB' || diamondMode === 'COMPARE') && selectedLab && (
                <SelectedDiamondSummary
                  label={diamondMode === 'COMPARE' ? 'Selected Lab-grown Diamond' : 'Selected Diamond'}
                  diamond={selectedLab}
                  isLab
                  auto={isAutoLab}
                  showProceed={!!selectedRingId}
                  onProceed={() => setCurrentStep(3)}
                />
              )}

              {/* When in COMPARE, allow switching visible list */}
              {diamondMode === 'COMPARE' && (
                <div className="mb-2 text-xs text-neutral-600 flex items-center gap-2">
                  <span>Viewing list:</span>
                  <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 overflow-hidden">
                    <button
                      className={`px-3 py-1 ${activeTab === 'NAT' ? 'bg-emerald-600 text-white' : ''}`}
                      onClick={() => setActiveTab('NAT')}
                    >
                      Natural
                    </button>
                    <button
                      className={`px-3 py-1 border-l ${activeTab === 'LAB' ? 'bg-blue-600 text-white' : ''}`}
                      onClick={() => setActiveTab('LAB')}
                    >
                      Lab-Grown
                    </button>
                  </div>
                </div>
              )}

              <div className="text-xs text-neutral-500 mb-2">
                {(() => {
                  const rng = activeTab === 'NAT' ? natSizeRange : labSizeRange;
                  return rng
                    ? `Size band: ${rng}`
                    : `Auto size set near ~${BASE_CT.toFixed(2)}ct`;
                })()}
              </div>

              {/* Filters */}
              <div
                className={styles.stickyFilterContainer}
                style={{ justifyContent: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', margin: '0.4rem 0 0.8rem' }}
              >
                <label className={styles.filterLabel}>Shape:{' '}
                  <select
                    value={common.Shape}
                    onChange={(e) => setCommon(prev => ({ ...prev, Shape: e.target.value }))}
                  >
                    {shapeUnion.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>

                {/* Size (dataset-specific) */}
                {activeTab === 'NAT' && (
                  <label className={styles.filterLabel}>Size:{' '}
                    <select
                      value={natSizeRange}
                      onChange={(e) => setNatSizeRange(normalizeRangeStr(e.target.value))}
                    >
                      <option value="">All Size (≥ {BASE_CT.toFixed(2)}ct)</option>
                      {rangeUnionNat.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                )}
                {activeTab === 'LAB' && (
                  <label className={styles.filterLabel}>Size:{' '}
                    <select
                      value={labSizeRange}
                      onChange={(e) => setLabSizeRange(normalizeRangeStr(e.target.value))}
                    >
                      <option value="">All Size (≥ {BASE_CT.toFixed(2)}ct)</option>
                      {rangeUnionLab.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                )}

                {/* Attribute filters */}
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
              {activeTab === 'NAT' && (
                <div className="flex items-center justify-end gap-3 text-sm mb-1">
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
                </div>
              )}
              {activeTab === 'LAB' && (
                <div className="flex items-center justify-end gap-3 text-sm mb-1">
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
                </div>
              )}

              {/* Grids */}
              <div className="mt-2">
                {activeTab === 'NAT' && (
                  <>
                    <p className={styles.itemCount}>
                      {natFiltered.length} natural diamond(s) found
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 mt-2">
                      {natFiltered.map(d => (
                        <DiamondCard
                          key={d.StoneId}
                          d={d}
                          active={selectedNatural?.StoneId === d.StoneId}
                          onSelect={() => {
                            if (selectedNatural?.StoneId === d.StoneId) {
                              chooseNat(null);
                            } else {
                              chooseNat(d);
                            }
                          }}
                          enquirePrefix="Product ID"
                          isLab={false}
                        />
                      ))}
                    </div>
                  </>
                )}

                {activeTab === 'LAB' && (
                  <>
                    <p className={styles.itemCount}>
                      {labFiltered.length} lab-grown diamond(s) found
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 mt-2">
                      {labFiltered.map(d => (
                        <DiamondCard
                          key={d.StoneId}
                          d={d}
                          active={selectedLab?.StoneId === d.StoneId}
                          onSelect={() => {
                            if (selectedLab?.StoneId === d.StoneId) {
                              chooseLab(null);
                            } else {
                              chooseLab(d);
                            }
                          }}
                          enquirePrefix="your Product ID"
                          isLab
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* STEP 3 – SUMMARY / CART */}
      {currentStep === 3 && (
        <aside className="mt-4 rounded-2xl border border-neutral-200 bg-white/80 p-3">
          <div>
            <div className="text-xs text-neutral-500">Step 3 of 3</div>
            <h2 className="text-lg font-semibold">Your Ring Summary</h2>
          </div>

          {/* Product-style mount detail card */}
          <div className="mt-3 rounded-2xl border bg-white/90 p-3 md:p-4 space-y-2">
            {selectedRing ? (
              <div className="flex gap-3 md:gap-4">
                <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                  <Image src={selectedRing.image} alt={selectedRing.id} fill className="object-cover" />
                </div>

                <div className="flex-1 text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm md:text-base">{selectedRing.id}</div>
                      <div className="text-[11px] text-neutral-500">Solitaire Ring</div>
                    </div>
                    <button
                      className="text-[11px] text-emerald-700 underline"
                      onClick={() => {
                        setCurrentStep(1);
                      }}
                    >
                      Change ring
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                    <div>
                      <div className="text-[11px] text-neutral-500">Gold Weight (approx.)</div>
                      <div className="font-semibold">
                        {goldWt != null
                          ? `${goldWt.toFixed(3)} gm${goldPurity ? ` (${goldPurity}kt)` : ''}`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-500">Labour / Making</div>
                      <div className="font-semibold">
                        {labourAmt != null ? money(labourAmt) : 'Included in mount'}
                      </div>
                    </div>

{/* Diamond detail in description */}
{(selectedNatural || selectedLab) && (
  <div className="mt-2 border-t border-dashed border-neutral-200 pt-2 space-y-1 col-span-2 md:col-span-3">
    <div className="text-[11px] font-semibold text-neutral-600 uppercase">
      Solitaire Detail
    </div>

    {/* Show Natural line only if mode includes Natural */}
    {(diamondMode === 'NAT' || diamondMode === 'COMPARE') && selectedNatural && (
      <div className="text-[11px] text-neutral-700">
        Natural Solitaire:{' '}
        <span className="font-semibold">
          {sizeNum(selectedNatural.Size).toFixed(2)}ct {selectedNatural.Shape}{' '}
          · {selectedNatural.Color}-{selectedNatural.Clarity}
        </span>{' '}
        (ID: {selectedNatural.StoneId})
        {selectedNatural.Measurement && (
          <> · {selectedNatural.Measurement} mm</>
        )}
      </div>
    )}

    {/* Show Lab-grown line only if mode includes Lab */}
    {(diamondMode === 'LAB' || diamondMode === 'COMPARE') && selectedLab && (
      <div className="text-[11px] text-neutral-700">
        Lab-grown Solitaire (CVD):{' '}
        <span className="font-semibold">
          {sizeNum(selectedLab.Size).toFixed(2)}ct {selectedLab.Shape}{' '}
          · {selectedLab.Color}-{selectedLab.Clarity}
        </span>{' '}
        (ID: {selectedLab.StoneId})
        {selectedLab.Measurement && (
          <> · {selectedLab.Measurement} mm</>
        )}
      </div>
    )}
  </div>
)}

                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">
                No ring selected yet. Start by choosing a design in Step 1.
              </p>
            )}
          </div>

{/* NEW: Product Details breakup, similar to gold-article page */}
{selectedRing && (
  <div className="mt-4 rounded-2xl border bg-white/90 p-3 md:p-4 text-xs space-y-1">
    <h3 className="text-sm font-semibold mb-2">Product Details</h3>

    <div>Item Code: <span className="font-semibold">{selectedRing.id}</span></div>

    {grossWt != null && (
      <div>Gross Weight: {grossWt.toFixed(3)} gm</div>
    )}

    {netWtFull != null && (
      <>
        <div>
          Net Weight: {netWtFull.toFixed(3)} gm
          {goldPurity ? ` (${goldPurity}kt)` : ''}
          {goldRatePerGm != null ? ` × ${money(goldRatePerGm)} /gm` : ''}
        </div>
        {goldAmt != null && (
          <div>= {money(goldAmt)}</div>
        )}
      </>
    )}

    {sideDiamondCt != null && (
      <>
        <div>
          Diamond: {sideDiamondCt.toFixed(2)} ct
          {sideDiamondRateCt != null ? ` × ${money(sideDiamondRateCt)} /ct` : ''}
        </div>
        {sideDiamondAmt != null && (
          <div>= {money(sideDiamondAmt)}</div>
        )}
      </>
    )}

    {/* Solitaire line(s) – respect current diamondMode */}
    {(() => {
      const showNatSolLine =
        (diamondMode === 'NAT' || diamondMode === 'COMPARE') && !!selectedNatural;
      const showLabSolLine =
        (diamondMode === 'LAB' || diamondMode === 'COMPARE') && !!selectedLab;

      if (!showNatSolLine && !showLabSolLine) return null;

      return (
        <>
          {showNatSolLine && selectedNatural && (
            <div>
              Solitaire (Natural): {sizeNum(selectedNatural.Size).toFixed(2)}ct
              {' '}= {money(natAmt)}
            </div>
          )}

          {showLabSolLine && selectedLab && (
            <div>
              Solitaire (Lab-grown): {sizeNum(selectedLab.Size).toFixed(2)}ct
              {' '}= {money(labAmt)}
            </div>
          )}
        </>
      );
    })()}

    {/* Making Charges */}
    {labourAmt != null && (
      <>
        <div>Making Charges:</div>
        <div>= {money(labourAmt)}</div>
      </>
    )}

    {/* Total */}
    <div className="mt-1 font-semibold">
      {diamondMode === 'NAT' && selectedNatural && (
        <>Total = {money(totalWithNat)}</>
      )}
      {diamondMode === 'LAB' && selectedLab && (
        <>Total = {money(totalWithLab)}</>
      )}
      {diamondMode === 'COMPARE' && (selectedNatural || selectedLab) && (
        <div className="space-y-1">
          {selectedNatural && (
            <div>Total (with Natural) = {money(totalWithNat)}</div>
          )}
          {selectedLab && (
            <div>Total (with Lab-grown) = {money(totalWithLab)}</div>
          )}
        </div>
      )}
      {(!selectedNatural && !selectedLab) && (
        <>Total (mount only) = {money(ringPrice)}</>
      )}
    </div>
  </div>
)}

          {/* Price Summary */}
          {selectedRing && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2">Price Summary</h3>

              {diamondMode === 'NAT' && (
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    <tr>
                      <td className="py-1 text-neutral-500">Mounting Price (including Labour)</td>
                      <td className="py-1 text-right">{money(ringPrice)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-neutral-500">Solitaire (Natural)</td>
                      <td className="py-1 text-right">
                        {selectedNatural ? money(natAmt) : 'Not selected'}
                      </td>
                    </tr>
                    <tr className="border-t">
                      <td className="py-2 font-semibold">Total (with Natural Diamond)</td>
                      <td className="py-2 text-right font-semibold">
                        {selectedNatural
                          ? money(ringPrice + natAmt)
                          : '—'}
                      </td>
                    </tr>
                    {isAutoNat && (
                      <tr>
                        <td colSpan={2} className="pt-1 text-[10px] text-amber-700">
                          * Starting total shown with auto-picked Natural solitaire.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {diamondMode === 'LAB' && (
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    <tr>
                      <td className="py-1 text-neutral-500">Mount</td>
                      <td className="py-1 text-right">{money(ringPrice)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-neutral-500">Diamond (Lab-Grown)</td>
                      <td className="py-1 text-right">
                        {selectedLab ? money(labAmt) : 'Not selected'}
                      </td>
                    </tr>
                    <tr className="border-t">
                      <td className="py-2 font-semibold">Total (with Lab-Grown Diamond)</td>
                      <td className="py-2 text-right font-semibold">
                        {selectedLab
                          ? money(ringPrice + labAmt)
                          : '—'}
                      </td>
                    </tr>
                    {isAutoLab && (
                      <tr>
                        <td colSpan={2} className="pt-1 text-[10px] text-amber-700">
                          * Starting total shown with auto-picked Lab-grown solitaire.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {diamondMode === 'COMPARE' && (
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left"></th>
                      <th className="text-right text-emerald-700">Natural</th>
                      <th className="text-right text-blue-700">Lab-Grown</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-1 text-neutral-500">Mount</td>
                      <td className="py-1 text-right">{money(ringPrice)}</td>
                      <td className="py-1 text-right">{money(ringPrice)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-neutral-500">Diamond</td>
                      <td className="py-1 text-right">
                        {selectedNatural ? money(natAmt) : '—'}
                      </td>
                      <td className="py-1 text-right">
                        {selectedLab ? money(labAmt) : '—'}
                      </td>
                    </tr>
                    <tr className="border-t">
                      <td className="py-2 font-semibold">Total</td>
                      <td className="py-2 text-right font-semibold">
                        {selectedNatural
                          ? money(ringPrice + natAmt)
                          : '—'}
                      </td>
                      <td className="py-2 text-right font-semibold">
                        {selectedLab
                          ? money(ringPrice + labAmt)
                          : '—'}
                      </td>
                    </tr>
                    {(isAutoNat || isAutoLab) && (
                      <tr>
                        <td colSpan={3} className="pt-1 text-[10px] text-amber-700">
                          * Starting totals are shown with auto-picked solitaires. You can replace them from Step 2.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleEnquire}
              className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!selectedRingId}
            >
              Enquire on WhatsApp
            </button>

            <button
              onClick={handleGeneratePdf}
              className="w-full px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!selectedRingId}
            >
              Download Quote PDF (with CJI logo)
            </button>

            <p className="text-[10px] text-neutral-500 text-center">
              Shown prices/rates are based on approximation. Final amount shall be based on final gold weight and will be confirmed by Rawat Gems &amp; Jewellers / CityJeweller.in.
            </p>
          </div>
        </aside>
      )}

      {/* NEW: Mounting breakup modal using same logic as Gold articles */}
      {mountInfoSkuId && (
        <SkuSummaryModal
          skuId={mountInfoSkuId}
          onClose={() => setMountInfoSkuId(null)}
        />
      )}


{/* Global trust / info section (reusable across pages) */}
      <TrustInfoStrip />

      {/* Mounting breakup modal */}
      {mountInfoSkuId && (
        <SkuSummaryModal
          skuId={mountInfoSkuId}
          onClose={() => setMountInfoSkuId(null)}
        />
      )}

    </PageLayout>
  );
}
