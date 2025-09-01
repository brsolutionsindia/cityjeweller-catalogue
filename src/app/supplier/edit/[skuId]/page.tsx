// src/app/supplier/edit/[skuId]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/firebaseConfig';
import { ref, get } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';

type DBItem = {
  Shape?: string; Size?: number; Clarity?: string; Color?: string;
  Cut?: string; Polish?: string; Symmetry?: string; Symm?: string; // Symm for legacy
  Fluorescence?: string; Certified?: string; Measurement?: string; Depth?: number; Table?: number;
  RapRate?: number; NetAmt?: number; CertNo?: string; Comments?: string; Status?: string;
};

type FormState = {
  Shape: string;
  Size: string; // keep as text, parse on save
  Clarity: string;
  Color: string;
  Cut: string;
  Polish: string;
  Symmetry: string;
  Fluorescence: string;
  Certified: string;

  ratePerCaratUSD: string; // maps to RapRate
  Measurement: string;
  Depth: number | '';
  Table: number | '';
  Remarks: string; // maps to Comments
  CertNo: string;
  Status: string;
};

const defaultState: FormState = {
  Shape: '',
  Size: '',
  Clarity: '',
  Color: '',
  Cut: '',
  Polish: '',
  Symmetry: '',
  Fluorescence: '',
  Certified: '',

  ratePerCaratUSD: '',
  Measurement: '',
  Depth: '',
  Table: '',
  Remarks: '',
  CertNo: '',
  Status: 'Available',
};

const FUNCTIONS_REGION = 'asia-south1';

const SHAPES = ['Round','Oval','Emerald','Princess','Pear','Other'] as const;
const GRADES = ['Excellent','Very Good','Good','Fair','Not known','Other'] as const;
const COLORS = ['D','E','F','G','H','I','J','K','L','M','Other'] as const;
const FLUO   = ['None','Faint','Medium','Strong','Not known','Other'] as const;
const CERTS  = ['IGI','GIA','HRD','Not Certified','Other'] as const;
const STATUS = ['Available','Hold','Sold','Hidden'] as const;

/** ---------------- label/code helpers ---------------- */
const toNumber = (v: unknown): number => {
  // convert to string, trim, replace commas with dots, remove any non-digit/non-dot chars
  const t = String(v ?? '')
    .trim()
    .replace(/,/g, '.')               // support "1,11"
    .replace(/\u00A0/g, ' ')          // NBSP -> space
    .replace(/[^\d.\-+eE]/g, '');     // strip odd chars
  // guard against multiple dots (e.g., "1.1.1")
  if ((t.match(/\./g) || []).length > 1) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};



const upper = (s: unknown) => (s == null ? '' : String(s).trim().toUpperCase());
const title = (s: unknown) => {
  const t = String(s ?? '').trim();
  if (!t) return '';
  return t[0].toUpperCase() + t.slice(1).toLowerCase();
};

// Cut/Polish/Symmetry: EX/VG/GD/NA/OT
const toCode = (v: unknown): 'EX'|'VG'|'GD'|'NA'|'OT' => {
  const t = upper(v);
  if (t === 'EX' || t.startsWith('EXCELLENT')) return 'EX';
  if (t === 'VG' || t.startsWith('VERY GOOD'))  return 'VG';
  if (t === 'GD' || t === 'GOOD')               return 'GD';
  if (t === 'NA' || t.startsWith('NOT KNOWN'))  return 'NA';
  return 'OT';
};
const fromCode = (c: unknown): string => {
  switch (upper(c)) {
    case 'EX': return 'Excellent';
    case 'VG': return 'Very Good';
    case 'GD': return 'Good';
    case 'NA': return 'Not known';
    case 'OT': return 'Other';
    default:   return String(c ?? '');
  }
};

// Fluorescence to label
const fluoFromCaps = (f: unknown): string => {
  switch (upper(f)) {
    case 'NONE': return 'None';
    case 'FAINT': return 'Faint';
    case 'MEDIUM': return 'Medium';
    case 'STRONG': return 'Strong';
    case 'NOT KNOWN': case 'NOTKNOWN': return 'Not known';
    case 'OTHER': return 'Other';
    default: return String(f ?? '');
  }
};

// Status from ALL CAPS to title-case option
const statusFromCaps = (s: unknown): string => {
  switch (upper(s)) {
    case 'AVAILABLE': return 'Available';
    case 'HOLD': return 'Hold';
    case 'SOLD': return 'Sold';
    case 'HIDDEN': return 'Hidden';
    default: return String(s ?? 'Available');
  }
};

// Shape from ALL CAPS to UI option (only for display)
const shapeFromCaps = (s: unknown): string => {
  const t = upper(s);
  const map: Record<string,string> = {
    ROUND: 'Round',
    OVAL: 'Oval',
    EMERALD: 'Emerald',
    PRINCESS: 'Princess',
    PEAR: 'Pear',
    OTHER: 'Other',
  };
  return map[t] ?? title(s);
};

/** ---------------- callable types ---------------- */
type UpdateDeleteReq = {
  skuId: string;
  action: 'update' | 'delete';
  fields?: Record<string, unknown>;
};
type UpdateDeleteRes = { ok: boolean; skuId: string; updated?: boolean; deleted?: boolean };

export default function EditNaturalDiamondPage() {
  const { skuId } = useParams<{ skuId: string }>();
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [gst, setGst] = useState<string | null>(null);

  // read-only display
  const [fullName, setFullName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(defaultState);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const fnUpdateOrDelete = useMemo(
    () =>
      httpsCallable<UpdateDeleteReq, UpdateDeleteRes>(
        getFunctions(undefined, FUNCTIONS_REGION),
        'nd_updateOrDeleteItem'
      ),
    []
  );

  // auth + supplier meta + fetch item
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace('/supplier/login'); return; }
      setUid(u.uid);

      const gstSnap = await get(ref(db, `User ID/${u.uid}/Shop GST`));
      const g = gstSnap.val();
      setGst(g ?? '');

      const userRoot = `User ID/${u.uid}`;
      const [n, m] = await Promise.all([
        get(ref(db, `${userRoot}/Full Name`)),
        get(ref(db, `${userRoot}/Mobile`)),
      ]);
      setFullName(n.val() ?? '');
      setMobile(m.val() ?? '');

      if (g) {
        const s = await get(ref(db, `GST/${g}/Shop Name`));
        setShopName(s.val() ?? '');
      }

      // fetch item
      if (skuId) {
        const itemSnap = await get(ref(db, `Global SKU/NaturalDiamonds/${skuId}`));
        const data: DBItem | null = itemSnap.exists() ? itemSnap.val() : null;

        if (!data) {
          setError('Item not found');
          setLoading(false);
          return;
        }

        setForm({
          Shape: shapeFromCaps(data.Shape),
          Size: data.Size != null ? String(data.Size) : '',
          Clarity: data.Clarity ?? '',
          Color: data.Color ?? '',
          Cut: fromCode(data.Cut),
          Polish: fromCode(data.Polish),
          Symmetry: fromCode(data.Symmetry ?? data.Symm),
          Fluorescence: fluoFromCaps(data.Fluorescence),
          Certified: data.Certified ?? '',

          ratePerCaratUSD: data.RapRate != null ? String(data.RapRate) : '',
          Measurement: data.Measurement ?? '',
          Depth: data.Depth ?? '',
          Table: data.Table ?? '',
          Remarks: data.Comments ?? '',
          CertNo: data.CertNo ?? '',
          Status: statusFromCaps(data.Status ?? 'Available'),
        });

        setLoading(false);
      }
    });
    return () => unsub();
  }, [router, skuId]);

  const onChange = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

const sizeNum = toNumber(form.Size);
const rateUSD = toNumber(form.ratePerCaratUSD);

if (!Number.isFinite(sizeNum) || sizeNum <= 0) {
  setError('Please enter a valid Size (Carat), e.g., 1.50');
  return;
}
if (!Number.isFinite(rateUSD) || rateUSD <= 0) {
  setError('Please enter a valid Rate per Carat (USD), e.g., 15000');
  return;
}

    try {
      setSaving(true);

      // Normalize before sending to server
      const normalizedFields: UpdateDeleteReq['fields'] = {
        // Specs
        Shape: upper(form.Shape),                   // CAPS
        Size: sizeNum,
        Clarity: form.Clarity,
        Color: form.Color,
        Cut: toCode(form.Cut),                      // code
        Polish: toCode(form.Polish),                // code
        Symmetry: toCode(form.Symmetry),            // code (server expects "Symmetry" key)
        Fluorescence: upper(form.Fluorescence),     // CAPS
        Certified: form.Certified,

        RapRate: rateUSD,                           // USD/ct
        Measurement: form.Measurement,
        Depth: form.Depth === '' ? null : Number(form.Depth),
        Table: form.Table === '' ? null : Number(form.Table),

        Comments: form.Remarks,
        CertNo: form.CertNo,
        Status: upper(form.Status),                 // CAPS (AVAILABLE/HOLD/SOLD/HIDDEN)
      };

      await fnUpdateOrDelete({
        skuId: String(skuId),
        action: 'update',
        fields: normalizedFields,
      });

      router.replace('/supplier/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm(`Delete ${skuId}?`)) return;
    try {
      setSaving(true);
      await fnUpdateOrDelete({ skuId: String(skuId), action: 'delete' });
      router.replace('/supplier/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  if (!uid || loading) return null;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">Edit Natural Diamond</h1>
        <span className="text-sm font-mono">SKU: {String(skuId)}</span>
      </div>

      <div className="mb-4 text-sm text-gray-700 flex flex-wrap gap-4">
        <div><span className="font-medium">Full Name:</span> {fullName || '-'}</div>
        <div><span className="font-medium">Mobile:</span> {mobile || '-'}</div>
        <div><span className="font-medium">Shop:</span> {shopName || '-'}</div>
        <div><span className="font-medium">GST:</span> {gst || '-'}</div>
      </div>

      <form onSubmit={save} className="grid grid-cols-2 gap-4">
        {/* Identification / status */}
        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Cert No</div>
          <input className="border p-2 rounded w-full"
                 value={form.CertNo} onChange={e=>onChange('CertNo', e.target.value)} />
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Status</div>
          <select className="border p-2 rounded w-full"
                  value={form.Status} onChange={e=>onChange('Status', e.target.value)}>
            {STATUS.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>

        {/* Specs */}
        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Shape *</div>
          <select className="border p-2 rounded w-full"
                  value={form.Shape} onChange={e=>onChange('Shape', e.target.value)}>
            <option value="">Select shape</option>
            {SHAPES.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Size (Carat) *</div>
          <input className="border p-2 rounded w-full" type="text" inputMode="decimal"
                 placeholder="e.g., 1.50"
                 value={form.Size} onChange={e=>onChange('Size', e.target.value)}
                 ///pattern="^[0-9]*\\.?[0-9]*$" 
	  />
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Clarity *</div>
          <select className="border p-2 rounded w-full"
                  value={form.Clarity} onChange={e=>onChange('Clarity', e.target.value)}>
            <option value="">Select clarity</option>
            {['IF','VVS1','VVS2','VS1','VS2','SI1','SI2','Not known','Other'].map(c=>(
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Color *</div>
          <select className="border p-2 rounded w-full"
                  value={form.Color} onChange={e=>onChange('Color', e.target.value)}>
            <option value="">Select color</option>
            {COLORS.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Cut *</div>
          <select className="border p-2 rounded w-full"
                  value={form.Cut} onChange={e=>onChange('Cut', e.target.value)}>
            <option value="">Select cut</option>
            {GRADES.map(g => <option key={g}>{g}</option>)}
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Polish *</div>
          <select className="border p-2 rounded w-full"
                  value={form.Polish} onChange={e=>onChange('Polish', e.target.value)}>
            <option value="">Select polish</option>
            {(['Excellent','Very Good','Good','Not known'] as const).map(g => <option key={g}>{g}</option>)}
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Symmetry *</div>
          <select className="border p-2 rounded w-full"
                  value={form.Symmetry} onChange={e=>onChange('Symmetry', e.target.value)}>
            <option value="">Select symmetry</option>
            {GRADES.map(g => <option key={g}>{g}</option>)}
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Fluorescence *</div>
          <select className="border p-2 rounded w-full"
                  value={form.Fluorescence} onChange={e=>onChange('Fluorescence', e.target.value)}>
            <option value="">Select fluorescence</option>
            {FLUO.map(f => <option key={f}>{f}</option>)}
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Certified? *</div>
          <select className="border p-2 rounded w-full"
                  value={form.Certified} onChange={e=>onChange('Certified', e.target.value)}>
            <option value="">Select certification</option>
            {CERTS.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Rate per Carat (USD) *</div>
          <input className="border p-2 rounded w-full" type="text" inputMode="decimal"
                 placeholder="e.g., 15000"
                 value={form.ratePerCaratUSD} onChange={e=>onChange('ratePerCaratUSD', e.target.value)}
                 //pattern="^[0-9]*\\.?[0-9]*$" 
		/>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Measurement (L × W × H, mm)</div>
          <input className="border p-2 rounded w-full" placeholder="e.g., 4.31 × 4.34 × 2.70"
                 value={form.Measurement} onChange={e=>onChange('Measurement', e.target.value)} />
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Depth (%)</div>
          <input className="border p-2 rounded w-full" type="number" step="0.1"
                 value={form.Depth} onChange={e=>onChange('Depth', e.target.value === '' ? '' : Number(e.target.value))} />
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Table (%)</div>
          <input className="border p-2 rounded w-full" type="number" step="0.1"
                 value={form.Table} onChange={e=>onChange('Table', e.target.value === '' ? '' : Number(e.target.value))} />
        </label>

        <label className="col-span-2">
          <div className="text-sm font-medium mb-1">Remarks</div>
          <textarea className="border p-2 rounded w-full"
                    value={form.Remarks} onChange={e=>onChange('Remarks', e.target.value)} />
        </label>

        {error && <p className="text-red-600 col-span-2">{error}</p>}

        <div className="col-span-2 flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">
            <button type="button" className="border px-3 py-1 rounded"
                    onClick={()=>router.back()}>
              Cancel
            </button>
            <button type="submit" className="border px-3 py-1 rounded" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <button type="button" className="border px-3 py-1 rounded text-red-600"
                  onClick={del} disabled={saving}>
            Delete
          </button>
        </div>
      </form>
    </main>
  );
}
