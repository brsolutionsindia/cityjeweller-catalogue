// src/app/supplier/new/page.tsx

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/firebaseConfig';
import { ref, get } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';

type FormState = {
  solitaireId: string;

  Shape: string;
  Size: string;
  Clarity: string;
  Color: string;
  Cut: string;
  Polish: string;
  Symmetry: string;
  Fluorescence: string;
  Certified: string;

  ratePerCaratUSD: string;
  Measurement: string;
  Depth: number | '';
  Table: number | '';
  Remarks: string;
};

const defaultState: FormState = {
  solitaireId: '',

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
};

type ReserveResp = { ok?: boolean; skuId: string; prefix?: string; next?: number };

export default function NewNaturalDiamond() {
  const [uid, setUid] = useState<string | null>(null);
  const [gst, setGst] = useState<string | null>(null);

  // read-only display
  const [fullName, setFullName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');

  const [form, setForm] = useState<FormState>(defaultState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const router = useRouter();

  const FUNCTIONS_REGION = 'asia-south1'; // match REGION above
  const fnReserve = httpsCallable(getFunctions(undefined, FUNCTIONS_REGION), 'nd_reserveSkuId');
  const fnCreate  = httpsCallable(getFunctions(undefined, FUNCTIONS_REGION), 'nd_createFromForm');

  // auth + GST + read-only meta
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace('/supplier/login'); return; }
      setUid(u.uid);

      // GST
      const gstSnap = await get(ref(db, `User ID/${u.uid}/Shop GST`));
      const g = gstSnap.val();
      setGst(g);

      // Full Name & Mobile
      const userRoot = `User ID/${u.uid}`;
      const [n, m] = await Promise.all([
        get(ref(db, `${userRoot}/Full Name`)),
        get(ref(db, `${userRoot}/Mobile`))
      ]);
      setFullName(n.val() ?? '');
      setMobile(m.val() ?? '');

      // Shop Name (from GST node)
      if (g) {
        const s = await get(ref(db, `GST/${g}/Shop Name`));
        setShopName(s.val() ?? '');
      }
    });
    return () => unsub();
  }, [router]);

  const onChange = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const sizeNum = parseFloat(String(form.Size).trim());
    const rateUSD = parseFloat(String(form.ratePerCaratUSD).trim());

    if (isNaN(sizeNum) || sizeNum <= 0) {
      setError('Please enter a valid Size (Carat), e.g., 1.50');
      return;
    }
    if (isNaN(rateUSD) || rateUSD <= 0) {
      setError('Please enter a valid Rate per Carat (USD), e.g., 15000');
      return;
    }

    if (!uid || !gst) { setError('GST not found.'); return; }

    try {
      setSaving(true);
      // 1) reserve SKU
      const r1 = await fnReserve();
      const { skuId } = (r1.data as ReserveResp);

      const upper = (s: unknown): string =>
        s == null ? '' : String(s).trim().toUpperCase();

      // Map long labels to codes; accept codes too (EX/VG/GD/NA/OT)
      const toCode = (v: string): 'EX' | 'VG' | 'GD' | 'NA' | 'OT' => {
        const t = upper(v);
        if (t === 'EX' || t === 'VG' || t === 'GD' || t === 'NA' || t === 'OT') return t;
        if (t.startsWith('EXCELLENT')) return 'EX';
        if (t.startsWith('VERY GOOD')) return 'VG';
        if (t === 'GOOD') return 'GD';
        if (t.startsWith('NOT KNOWN') || t === 'NOTKNOWN' || t === 'NA') return 'NA';
        return 'OT';
      };

      // Build normalized fields for the server
      const normalized = {
        Shape: upper(form.Shape),
        Cut: toCode(form.Cut),
        Polish: toCode(form.Polish),
        Symm: toCode(form.Symmetry),        // rename Symmetry -> Symm (coded)
        Fluorescence: upper(form.Fluorescence),
        // If you add Status later: Status: upper(form.Status)
      };

      // 2) server create (writes GST node copy + public record with MRP/OfferPrice)
      const payload = {
        skuId,
        ...form,
        ...normalized, // enforced fields overwrite above
        Size: sizeNum,
        ratePerCaratUSD: rateUSD,
        Depth: form.Depth === '' ? null : Number(form.Depth),
        Table: form.Table === '' ? null : Number(form.Table),
      };

      await fnCreate(payload);

      // 3) back to dashboard
      router.replace('/supplier/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!uid) return null;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-2">Add Natural Diamond</h1>

      {/* Read-only meta pulled from DB */}
      <div className="mb-4 text-sm text-gray-700 flex flex-wrap gap-4">
        <div><span className="font-medium">Full Name:</span> {fullName || '-'}</div>
        <div><span className="font-medium">Mobile:</span> {mobile || '-'}</div>
        <div><span className="font-medium">Shop:</span> {shopName || '-'}</div>
        <div><span className="font-medium">GST:</span> {gst || '-'}</div>
      </div>

      <form onSubmit={save} className="grid grid-cols-2 gap-4">
        <input
          className="border p-2 rounded col-span-2"
          placeholder="Solitaire ID/Code (optional)"
          value={form.solitaireId}
          onChange={(e) => onChange('solitaireId', e.target.value)}
        />

        {/* Specs */}
        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Shape *</div>
          <select
            className="border p-2 rounded w-full"
            value={form.Shape}
            onChange={(e) => onChange('Shape', e.target.value)}
          >
            <option value="">Select shape</option>
            <option>Round</option><option>Oval</option><option>Emerald</option>
            <option>Princess</option><option>Pear</option><option>Other</option>
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Size (Carat) *</div>
          <input
            className="border p-2 rounded w-full"
            type="text"
            inputMode="decimal"
            placeholder="e.g., 1.50"
            value={form.Size}
            onChange={(e) => onChange('Size', e.target.value)}
            pattern="^[0-9]*\.?[0-9]*$"
          />
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Clarity *</div>
          <select
            className="border p-2 rounded w-full"
            value={form.Clarity}
            onChange={(e) => onChange('Clarity', e.target.value)}
          >
            <option value="">Select clarity</option>
            <option>IF</option><option>VVS1</option><option>VVS2</option>
            <option>VS1</option><option>VS2</option><option>SI1</option><option>SI2</option>
            <option>Not known</option><option>Other</option>
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Color *</div>
          <select
            className="border p-2 rounded w-full"
            value={form.Color}
            onChange={(e) => onChange('Color', e.target.value)}
          >
            <option value="">Select color</option>
            {['D','E','F','G','H','I','J','K','L','M','Other'].map(c => <option key={c}>{c}</option>)}
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Cut *</div>
          <select
            className="border p-2 rounded w-full"
            value={form.Cut}
            onChange={(e) => onChange('Cut', e.target.value)}
          >
            <option value="">Select cut</option>
            <option>Excellent</option><option>Very Good</option><option>Good</option><option>Fair</option>
            <option>Not known</option><option>Other</option>
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Polish *</div>
          <select
            className="border p-2 rounded w-full"
            value={form.Polish}
            onChange={(e) => onChange('Polish', e.target.value)}
          >
            <option value="">Select polish</option>
            <option>Excellent</option><option>Very Good</option><option>Good</option><option>Not known</option>
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Symmetry *</div>
          <select
            className="border p-2 rounded w-full"
            value={form.Symmetry}
            onChange={(e) => onChange('Symmetry', e.target.value)}
          >
            <option value="">Select symmetry</option>
            <option>Excellent</option><option>Very Good</option><option>Good</option><option>Not known</option><option>Other</option>
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Fluorescence *</div>
          <select
            className="border p-2 rounded w-full"
            value={form.Fluorescence}
            onChange={(e) => onChange('Fluorescence', e.target.value)}
          >
            <option value="">Select fluorescence</option>
            <option>None</option><option>Faint</option><option>Medium</option><option>Strong</option><option>Not known</option><option>Other</option>
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Certified? *</div>
          <select
            className="border p-2 rounded w-full"
            value={form.Certified}
            onChange={(e) => onChange('Certified', e.target.value)}
          >
            <option value="">Select certification</option>
            <option>IGI</option><option>GIA</option><option>HRD</option><option>Not Certified</option><option>Other</option>
          </select>
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Rate per Carat (USD) *</div>
          <input
            className="border p-2 rounded w-full"
            type="text"
            inputMode="decimal"
            placeholder="e.g., 15000"
            value={form.ratePerCaratUSD}
            onChange={(e) => onChange('ratePerCaratUSD', e.target.value)}
            pattern="^[0-9]*\.?[0-9]*$"
          />
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Measurement (L × W × H, mm)</div>
          <input
            className="border p-2 rounded w-full"
            placeholder="e.g., 4.31 × 4.34 × 2.70"
            value={form.Measurement}
            onChange={(e) => onChange('Measurement', e.target.value)}
          />
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Depth (%)</div>
          <input
            className="border p-2 rounded w-full"
            type="number"
            step="0.1"
            value={form.Depth}
            onChange={(e) =>
              onChange('Depth', e.target.value === '' ? '' as const : Number(e.target.value))
            }
          />
        </label>

        <label className="col-span-1">
          <div className="text-sm font-medium mb-1">Table (%)</div>
          <input
            className="border p-2 rounded w-full"
            type="number"
            step="0.1"
            value={form.Table}
            onChange={(e) =>
              onChange('Table', e.target.value === '' ? '' as const : Number(e.target.value))
            }
          />
        </label>

        <label className="col-span-2">
          <div className="text-sm font-medium mb-1">Remarks</div>
          <textarea
            className="border p-2 rounded w-full"
            value={form.Remarks}
            onChange={(e) => onChange('Remarks', e.target.value)}
          />
        </label>

        {error && <p className="text-red-600 col-span-2">{error}</p>}
        <div className="col-span-2 flex gap-2 justify-end">
          <button className="border px-3 py-1 rounded" type="button" onClick={() => router.back()}>
            Cancel
          </button>
          <button className="border px-3 py-1 rounded" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </main>
  );
}
