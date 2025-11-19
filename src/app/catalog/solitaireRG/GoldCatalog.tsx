'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ref, onValue, get } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import { useSearchParams } from 'next/navigation';

import PageLayout from '../../components/PageLayout';
import OfferBar from '../../components/OfferBar';

import styles from '../../page.module.css';
import shapeIcon from '../../../../assets/shapeIcons';
import { filterSolitaireRings } from './filters';

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
type SourceChoice = 'BOTH' | 'NAT' | 'LAB';

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
   Lightweight Ring Confirm Modal
========================= */
function RingConfirmModal({
  ring,
  sourceChoice,
  onChangeSourceChoice,
  onClose,
  onContinue
}: {
  ring: ProductCard | null;
  sourceChoice: SourceChoice;
  onChangeSourceChoice: (s: SourceChoice) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  if (!ring) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-lg overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative aspect-square">
            <Image
              src={ring.image}
              alt={ring.id}
              fill
              sizes="400px"
              className="object-cover"
            />
          </div>
          <div className="p-4 flex flex-col gap-3">
            <h3 className="text-lg font-semibold">{ring.id}</h3>
            <p className="text-sm text-neutral-700">
              Mount price: <b>{money(ring.price)}</b>
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              We’ll show <b>starting totals</b> using auto-picked{' '}
              <b>~{BASE_CT.toFixed(2)} ct ROUND</b> options. You can replace or clear them anytime.
            </div>

            {/* Choose type: synced with Step 2 */}
            <div className="mt-1 text-sm">
              <div className="font-medium mb-1">Choose type:</div>
              <div className="flex flex-col gap-1">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="ringConfirmSource"
                    checked={sourceChoice === 'NAT'}
                    onChange={() => onChangeSourceChoice('NAT')}
                  />
                  <span>Natural only</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="ringConfirmSource"
                    checked={sourceChoice === 'LAB'}
                    onChange={() => onChangeSourceChoice('LAB')}
                  />
                  <span>Lab-Grown only</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="ringConfirmSource"
                    checked={sourceChoice === 'BOTH'}
                    onChange={() => onChangeSourceChoice('BOTH')}
                  />
                  <span>Both</span>
                </label>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200"
                onClick={onClose}
              >
                Back
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                onClick={onContinue}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
  const [ringPrice, setRingPrice] = useState<number>(0);
  const [collapseRings, setCollapseRings] = useState(false);

  // Ring confirm modal
  const [ringCandidateId, setRingCandidateId] = useState<string | null>(null);

  // Source choice (NAT only, LAB only, or BOTH)
  const [sourceChoice, setSourceChoice] = useState<SourceChoice>('BOTH');

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

  const [lockNat, setLockNat] = useState(true);
  const [lockLab, setLockLab] = useState(true);

  // Tabs (hidden when user chooses single source)
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

  // Whether to show Step 2 section
  const [showDiamonds, setShowDiamonds] = useState(false);

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

  const chooseNat = (d: Diamond | null) => {
    setSelectedNatural(d);
    setUserPickedNat(true);
    setLockNat(false);
  };

  const chooseLab = (d: Diamond | null) => {
    setSelectedLab(d);
    setUserPickedLab(true);
    setLockLab(false);
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
    // when no ring is selected, make sure lists are empty and no listeners are active
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
      // reset unions when no ring is chosen
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

    // validate current selected ranges against unions (normalize both sides)
    setNatSizeRange(prev => {
      const p = normalizeRangeStr(prev);
      return p && !natRanges.map(normalizeRangeStr).includes(p) ? '' : p;
    });
    setLabSizeRange(prev => {
      const p = normalizeRangeStr(prev);
      return p && !labRanges.map(normalizeRangeStr).includes(p) ? '' : p;
    });

    // On ring select, set to our DEFAULT bands
    const natPick = resolveInitialRange(natRanges, DEFAULT_RANGE_NAT);
    const labPick = resolveInitialRange(labRanges, DEFAULT_RANGE_LAB);
    setNatSizeRange(natPick);
    setLabSizeRange(labPick);
  }, [natAll, labAll, common.Shape, selectedRingId]);

  /* Dataset-specific attribute unions & validate current filters per active tab */
  useEffect(() => {
    if (!selectedRingId) {
      // clear option lists when not in step 2 yet
      setClarityNat([]); setColorNat([]); setCutNat([]); setPolishNat([]); setSymmNat([]); setFluorNat([]);
      setClarityLab([]); setColorLab([]); setCutLab([]); setPolishLab([]); setSymmLab([]); setFluorLab([]);
      // also clear common attribute selections so step 1 stays light
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

    // ensure common filters valid for the ACTIVE pool
    const pools = (activeTab === 'NAT' || sourceChoice === 'NAT')
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
  }, [common.Shape, natAll, labAll, activeTab, sourceChoice, selectedRingId]);

  /* Sync sourceChoice with tabs & selections */
  useEffect(() => {
    if (sourceChoice === 'NAT') {
      setActiveTab('NAT');
      setSelectedLab(null);   // hide/clear lab when NAT only
    } else if (sourceChoice === 'LAB') {
      setActiveTab('LAB');
      setSelectedNatural(null); // hide/clear natural when LAB only
    }
    // BOTH => keep current tab
  }, [sourceChoice]);

  /* Ring change setup */
  useEffect(() => {
    const ring = rings.find(r => r.id === selectedRingId);

    // clear selections (fresh start)
    setSelectedNatural(null);
    setSelectedLab(null);
    setUserPickedNat(false);
    setUserPickedLab(false);

    // start NAT tab after ring choose
    setActiveTab('NAT');

    // cache mount price
    setRingPrice(typeof ring?.price === 'number' ? ring.price : 0);

    if (selectedRingId) {
      setCommon(prev => ({ ...prev, Shape: 'ROUND' }));
      setCollapseRings(true);
      setShowDiamonds(false); // hide diamond section until user explicitly opens it
    } else {
      setCollapseRings(false);
      setShowDiamonds(false);
    }
    setLockNat(true);
    setLockLab(true);
  }, [selectedRingId, rings]);

  /* Filter diamonds strictly by chosen size range (if any) */
  useEffect(() => {
    if (!selectedRingId) {  // <- do nothing until a ring is chosen
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

  /* Auto-pick cheapest within filtered lists, respecting source choice and ignoring price = 0 */
  useEffect(() => {
    if (!selectedRingId) return;
    const price = (d: Diamond) => d.OfferPrice ?? d.MRP ?? Infinity;

    // Base pools with size condition
    const baseNatPool = (sourceChoice !== 'LAB')
      ? (natSizeRange
          ? natFiltered
          : natFiltered.filter(d => sizeNum(d.Size) >= BASE_CT))
      : [];
    const baseLabPool = (sourceChoice !== 'NAT')
      ? (labSizeRange
          ? labFiltered
          : labFiltered.filter(d => sizeNum(d.Size) >= BASE_CT))
      : [];

    // Filter out diamonds where OfferPrice/MRP is 0 or missing
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
    sourceChoice
  ]);

  /* CTA */
  const handleEnquire = () => {
    if (!selectedRingId) {
      alert('Please select a ring design first.');
      return;
    }
    const needNat = (sourceChoice === 'BOTH' || sourceChoice === 'NAT');
    const needLab = (sourceChoice === 'BOTH' || sourceChoice === 'LAB');
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
    const adminLines = buildAdminProductLines(selectedRingId, selectedNatural, selectedLab);
    const text = `${summary}\n\n${adminLines}`;

    const url = `https://wa.me/919023130944?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleChangeRing = () => {
    setSelectedRingId(null);
    setCollapseRings(false);
    setSelectedNatural(null);
    setSelectedLab(null);
    setUserPickedNat(false);
    setUserPickedLab(false);
    setNatSizeRange('');
    setLabSizeRange('');
    setLockNat(true);
    setLockLab(true);
    setShowDiamonds(false);
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

  const isAutoNat = !!selectedNatural && !userPickedNat;
  const isAutoLab = !!selectedLab && !userPickedLab;

  /* UI */
  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />

      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center py-2 rounded mb-4">
        Mount prices exclude solitaire. <b>We show a starting total using ~{BASE_CT.toFixed(2)}ct auto-picked diamonds.</b> Replace or clear anytime.
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
          <StepBadge n={2} active={!!selectedRingId && showDiamonds} />
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
                    onClick={() => setRingCandidateId(r.id)} // confirm modal first
                    className="w-full text-left"
                    title={`Stone2 ~ ${r.stone2Ct ? r.stone2Ct.toFixed(2) + 'ct' : '—'}`}
                  >
                    <Image src={r.image} alt={r.id} width={600} height={600} className="w-full aspect-square object-cover" />
                    <div className="p-2">
                      <div className="font-semibold text-sm">{r.id}; Mount = {money(r.price)} </div>
                    </div>
                  </button>

                  {collapseRings && active && (
                    <div className="px-2 pb-2 flex items-center gap-2">
                      <button
                        className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
                        onClick={(e) => { e.stopPropagation(); /* optional quick view */ }}
                        title="Open quick view"
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

      {/* STEP 2: DIAMONDS - only when user explicitly opens it */}
      {selectedRingId && showDiamonds && (
        <section
          ref={step2Ref}
          className="mt-5 rounded-2xl border border-neutral-200 bg-white/70 p-3"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Step 2 · Select Diamond</h2>

            {/* Source choice: NAT only / LAB only / BOTH */}
            {selectedRingId && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-neutral-600">Choose type:</span>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="source"
                    checked={sourceChoice === 'NAT'}
                    onChange={() => { setSourceChoice('NAT'); setActiveTab('NAT'); }}
                  />
                  <span>Natural only</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="source"
                    checked={sourceChoice === 'LAB'}
                    onChange={() => { setSourceChoice('LAB'); setActiveTab('LAB'); }}
                  />
                  <span>Lab-Grown only</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="source"
                    checked={sourceChoice === 'BOTH'}
                    onChange={() => setSourceChoice('BOTH')}
                  />
                  <span>Both</span>
                </label>
              </div>
            )}

            <div className="text-xs text-neutral-500">
              {(() => {
                const rng = activeTab === 'NAT' ? natSizeRange : labSizeRange;
                return rng
                  ? `Size: ${rng}`
                  : selectedRingId
                    ? `Auto size set near ~${BASE_CT.toFixed(2)}ct`
                    : 'Pick a ring to auto-set size';
              })()}
            </div>
          </div>

          {/* Tabs (hide entirely if one source chosen) */}
          {sourceChoice === 'BOTH' && (
            <div className="mt-3 inline-flex rounded-lg border border-neutral-200 overflow-hidden">
              <button className={`px-4 py-2 text-sm ${activeTab === 'NAT' ? 'bg-emerald-600 text-white' : 'bg-white'}`} onClick={() => setActiveTab('NAT')}>Natural Diamonds</button>
              <button className={`px-4 py-2 text-sm border-l ${activeTab === 'LAB' ? 'bg-emerald-600 text-white' : 'bg-white'}`} onClick={() => setActiveTab('LAB')}>Lab-Grown Diamonds</button>
            </div>
          )}

          {/* Banners */}
          {selectedRingId && (sourceChoice !== 'LAB') && (activeTab === 'NAT' || sourceChoice === 'NAT') && (
            <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
              We auto-picked a <b>{BASE_CT.toFixed(2)} ct</b> Natural diamond to show the <b>starting price</b>. Use <b>Replace</b> to change.
            </div>
          )}
          {selectedRingId && (sourceChoice !== 'NAT') && (activeTab === 'LAB' || sourceChoice === 'LAB') && (
            <div className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
              We auto-picked a <b>{BASE_CT.toFixed(2)} ct</b> Lab-Grown diamond to show the <b>starting price</b>. Use <b>Replace</b> to change.
            </div>
          )}

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
            {(sourceChoice !== 'LAB') && (activeTab === 'NAT' || sourceChoice === 'NAT') && (
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
            {(sourceChoice !== 'NAT') && (activeTab === 'LAB' || sourceChoice === 'LAB') && (
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

            {/* Attribute filters (apply to whichever list is visible) */}
            <label className={styles.filterLabel}>Clarity:{' '}
              <select
                value={common.Clarity}
                onChange={(e) => setCommon(prev => ({ ...prev, Clarity: e.target.value }))}
              >
                <option value="">All</option>
                {((activeTab === 'NAT' || sourceChoice === 'NAT') && sourceChoice !== 'LAB'
                  ? clarityNat
                  : clarityLab).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>

            <label className={styles.filterLabel}>Color:{' '}
              <select
                value={common.Color}
                onChange={(e) => setCommon(prev => ({ ...prev, Color: e.target.value }))}
              >
                <option value="">All</option>
                {((activeTab === 'NAT' || sourceChoice === 'NAT') && sourceChoice !== 'LAB'
                  ? colorNat
                  : colorLab).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>

            <label className={styles.filterLabel}>Cut:{' '}
              <select
                value={common.Cut}
                onChange={(e) => setCommon(prev => ({ ...prev, Cut: e.target.value }))}
              >
                <option value="">All</option>
                {((activeTab === 'NAT' || sourceChoice === 'NAT') && sourceChoice !== 'LAB'
                  ? cutNat
                  : cutLab).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>

            <label className={styles.filterLabel}>Polish:{' '}
              <select
                value={common.Polish}
                onChange={(e) => setCommon(prev => ({ ...prev, Polish: e.target.value }))}
              >
                <option value="">All</option>
                {((activeTab === 'NAT' || sourceChoice === 'NAT') && sourceChoice !== 'LAB'
                  ? polishNat
                  : polishLab).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>

            <label className={styles.filterLabel}>Symm:{' '}
              <select
                value={common.Symm}
                onChange={(e) => setCommon(prev => ({ ...prev, Symm: e.target.value }))}
              >
                <option value="">All</option>
                {((activeTab === 'NAT' || sourceChoice === 'NAT') && sourceChoice !== 'LAB'
                  ? symmNat
                  : symmLab).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>

            <label className={styles.filterLabel}>Fluor:{' '}
              <select
                value={common.Fluorescence}
                onChange={(e) => setCommon(prev => ({ ...prev, Fluorescence: e.target.value }))}
              >
                <option value="">All</option>
                {((activeTab === 'NAT' || sourceChoice === 'NAT') && sourceChoice !== 'LAB'
                  ? fluorNat
                  : fluorLab).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>

          {/* Sorting */}
          {(sourceChoice !== 'LAB') && (activeTab === 'NAT' || sourceChoice === 'NAT') && (
            <div className="flex items-center justify-end gap-3 text-sm">
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
          {(sourceChoice !== 'NAT') && (activeTab === 'LAB' || sourceChoice === 'LAB') && (
            <div className="mt-2 flex items-center justify-end gap-3 text-sm">
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
            {(sourceChoice !== 'LAB') && (activeTab === 'NAT' || sourceChoice === 'NAT') && (
              <>
                <p className={styles.itemCount}>
                  {lockNat && selectedNatural ? 'Auto-picked one natural diamond for starting total' : `Showing ${natFiltered.length} natural diamonds`}
                </p>

                {lockNat && selectedNatural ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                    <DiamondCard
                      d={selectedNatural}
                      active
                      onSelect={() => {
                        setSelectedNatural(null);
                        setUserPickedNat(false);
                        setLockNat(false); // show full list (i.e., Replace)
                      }}
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
                        onSelect={() => {
                          if (selectedNatural?.StoneId === d.StoneId) {
                            // Unselect → act like Replace
                            setSelectedNatural(null);
                            setUserPickedNat(false);
                            setLockNat(false);
                          } else {
                            chooseNat(d);
                          }
                        }}
                        enquirePrefix="Product ID"
                        isLab={false}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {(sourceChoice !== 'NAT') && (activeTab === 'LAB' || sourceChoice === 'LAB') && (
              <>
                <p className={styles.itemCount}>
                  {lockLab && selectedLab ? 'Auto-picked one lab-grown diamond for starting total' : `Showing ${labFiltered.length} lab-grown diamonds`}
                </p>

                {lockLab && selectedLab ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                    <DiamondCard
                      d={selectedLab}
                      active
                      onSelect={() => {
                        setSelectedLab(null);
                        setUserPickedLab(false);
                        setLockLab(false); // show full list (i.e., Replace)
                      }}
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
                        onSelect={() => {
                          if (selectedLab?.StoneId === d.StoneId) {
                            // Unselect → act like Replace
                            setSelectedLab(null);
                            setUserPickedLab(false);
                            setLockLab(false);
                          } else {
                            chooseLab(d);
                          }
                        }}
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
      )}

      {/* Sticky compare bar */}
      <div className="sticky bottom-2 z-10 mt-5 rounded-2xl border bg-white p-3 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className={`text-xs md:text-sm grid ${sourceChoice === 'BOTH' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'} gap-2 md:gap-6`}>
            <div><b>Ring:</b> {selectedRingId || '—'}</div>
            <div><b>Mount:</b> {money(ringPrice)}</div>

            {(sourceChoice !== 'LAB') && (
              <div className="flex items-center gap-2">
                <span>
                  <b>Natural:</b>{' '}
                  {selectedNatural
                    ? `${sizeNum(selectedNatural.Size).toFixed(2)}ct · ${selectedNatural.Color}-${selectedNatural.Clarity} · ${money(selectedNatural.OfferPrice ?? selectedNatural.MRP ?? 0)}`
                    : '—'}
                </span>
                <button
                  className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
                  onClick={() => {
                    setShowDiamonds(true);
                    setSourceChoice('NAT');
                    setActiveTab('NAT');
                    setLockNat(false);
                    setTimeout(() => {
                      step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }}
                >
                  {selectedNatural ? 'Replace' : 'Choose'}
                </button>
              </div>
            )}

            {(sourceChoice !== 'NAT') && (
              <div className="flex items-center gap-2">
                <span>
                  <b>Lab-Grown:</b>{' '}
                  {selectedLab
                    ? `${sizeNum(selectedLab.Size).toFixed(2)}ct · ${selectedLab.Color}-${selectedLab.Clarity} · ${money(selectedLab.OfferPrice ?? selectedLab.MRP ?? 0)}`
                    : '—'}
                </span>
                <button
                  className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
                  onClick={() => {
                    setShowDiamonds(true);
                    setSourceChoice('LAB');
                    setActiveTab('LAB');
                    setLockLab(false);
                    setTimeout(() => {
                      step2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }}
                >
                  {selectedLab ? 'Replace' : 'Choose'}
                </button>
              </div>
            )}
          </div>

          {/* Totals (show only chosen sources) */}
          <div className={`grid ${sourceChoice === 'BOTH' ? 'grid-cols-2' : 'grid-cols-1'} gap-2 md:gap-4`}>
            {(sourceChoice !== 'LAB') && (
              <div className="rounded-lg border p-2 text-center">
                <div className="text-[11px] text-neutral-500">
                  {isAutoNat ? 'Starting total (auto-picked)' : 'Total with Natural'}
                </div>
                <div className="text-base font-semibold">
                  {selectedNatural
                    ? money(ringPrice + (selectedNatural.OfferPrice ?? selectedNatural.MRP ?? 0))
                    : '—'}
                </div>
              </div>
            )}

            {(sourceChoice !== 'NAT') && (
              <div className="rounded-lg border p-2 text-center">
                <div className="text-[11px] text-neutral-500">
                  {isAutoLab ? 'Starting total (auto-picked)' : 'Total with Lab-Grown'}
                </div>
                <div className="text-base font-semibold">
                  {selectedLab
                    ? money(ringPrice + (selectedLab.OfferPrice ?? selectedLab.MRP ?? 0))
                    : '—'}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleEnquire}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
          >
            Enquire on WhatsApp
          </button>
        </div>
      </div>

      {/* Ring confirm modal */}
      {ringCandidateId && (
        <RingConfirmModal
          ring={rings.find(r => r.id === ringCandidateId) || null}
          sourceChoice={sourceChoice}
          onChangeSourceChoice={setSourceChoice}
          onClose={() => setRingCandidateId(null)}
          onContinue={() => {
            setSelectedRingId(ringCandidateId);
            setRingCandidateId(null);

            // lock in the choice and tab
            if (sourceChoice === 'NAT') {
              setSourceChoice('NAT');
              setActiveTab('NAT');
              setSelectedLab(null);
            } else if (sourceChoice === 'LAB') {
              setSourceChoice('LAB');
              setActiveTab('LAB');
              setSelectedNatural(null);
            } else {
              setSourceChoice('BOTH');
              setActiveTab('NAT'); // default start tab when both
            }
            // Do NOT show diamond section yet; user will open via Replace/Choose
          }}
        />
      )}
    </PageLayout>
  );
}
