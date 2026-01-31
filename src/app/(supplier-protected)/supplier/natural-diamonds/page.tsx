// supplier Dashboard

'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth'; // ⬅️ added signOut
import { auth, db } from '@/firebaseConfig';
import { ref, get, onValue } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';

const FUNCTIONS_REGION = 'asia-south1';

type Item = {
  CertNo?: string; Certified?: string; Clarity?: string; Color?: string; Comments?: string;
  Cut?: string; Depth?: number; Discount?: number; Fluorescence?: string;
  Measurement?: string; NetAmt?: number; Polish?: string; RapRate?: number;
  Shape?: string; Size?: number; Status?: string;
};

export default function SupplierDashboard() {
  const [uid, setUid] = useState<string | null>(null);
  const [gst, setGst] = useState<string | null>(null);
  const [skuIds, setSkuIds] = useState<string[]>([]);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Item>({});
  const router = useRouter();

  const fn = useMemo(() => {
    try {
      return httpsCallable(getFunctions(undefined, FUNCTIONS_REGION), 'nd_updateOrDeleteItem');
    } catch { return null; }
  }, []);

  // auth + GST load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace('/supplier/login'); return; }
      setUid(u.uid);

      const gstSnap = await get(ref(db, `User ID/${u.uid}/Shop GST`));
      const g = gstSnap.val();
      setGst(g);

      // read SKU IDs under GST list
      onValue(ref(db, `GST/${g}/Global SKU/NaturalDiamonds`), (snap) => {
        const obj = snap.val() || {};
        const keys = Object.keys(obj);
        setSkuIds(keys);
      });
    });
    return () => unsub();
  }, [router]);

  // read items by keys
  useEffect(() => {
    if (!gst || skuIds.length === 0) { setItems({}); return; }
    (async () => {
      const results: Record<string, Item> = {};
      await Promise.all(skuIds.map(async (k) => {
        const s = await get(ref(db, `Global SKU/NaturalDiamonds/${k}`));
        if (s.exists()) results[k] = s.val();
      }));
      setItems(results);
    })();
  }, [gst, skuIds]);

  const rows = useMemo(() => skuIds.map(k => [k, items[k]] as const), [skuIds, items]);

  const goEdit = (key: string) => router.push(`/supplier/natural-diamonds/edit/${key}`);

  const saveEdit = async () => {
    if (!editingKey || !fn) return;
    await fn({ skuId: editingKey, action: 'update', fields: {
      CertNo: editDraft.CertNo, Certified: editDraft.Certified, Clarity: editDraft.Clarity,
      Color: editDraft.Color, Comments: editDraft.Comments, Cut: editDraft.Cut, Depth: Number(editDraft.Depth ?? 0),
      Discount: Number(editDraft.Discount ?? 0), Fluorescence: editDraft.Fluorescence,
      Measurement: editDraft.Measurement, NetAmt: Number(editDraft.NetAmt ?? 0),
      Polish: editDraft.Polish, RapRate: Number(editDraft.RapRate ?? 0),
      Shape: editDraft.Shape, Size: Number(editDraft.Size ?? 0), Status: editDraft.Status
    }});
    setEditingKey(null);
  };

  const del = async (key: string) => {
    if (!fn) return;
    if (!confirm(`Delete ${key}?`)) return;
    await fn({ skuId: key, action: 'delete' });

    // optimistic UI (real-time listener will also reflect it)
    setSkuIds(prev => prev.filter(id => id !== key));
    setItems(prev => {
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.replace('/supplier/login');
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  if (!uid) return null;

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">My Natural Diamonds</h1>
        <div className="flex items-center gap-2">
          <button
            className="border px-3 py-1 rounded"
            onClick={() => router.push('/supplier/natural-diamonds/new')}
            title="Add new item"
          >
            + Add
          </button>
          <button
            className="border px-3 py-1 rounded"
            onClick={logout}
            title="Log out"
          >
            Logout
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-4">GST: {gst ?? '...'}</p>

      <div className="grid gap-3">
        {rows.map(([key, it]) => (
          <div key={key} className="border rounded p-4">
            <div className="font-mono text-sm mb-2">{key}</div>
            <div className="text-sm">CertNo: {it?.CertNo} | {it?.Certified} | {it?.Shape} | {it?.Size}</div>
            <div className="text-sm">Clarity/Color: {it?.Clarity}/{it?.Color} | Cut/Polish: {it?.Cut}/{it?.Polish}</div>
            <div className="text-sm">NetAmt: {it?.NetAmt ?? '-'} | RapRate: {it?.RapRate ?? '-'}</div>
            <div className="mt-2 flex gap-2">
              <button className="border px-3 py-1 rounded" onClick={() => goEdit(key)}>Edit</button>
              <button className="border px-3 py-1 rounded" onClick={() => del(key)}>Delete</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-500">No items found.</p>}
      </div>

      {editingKey && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded p-4 w-full max-w-xl">
            <h2 className="font-semibold mb-2">Edit {editingKey}</h2>
            <div className="grid grid-cols-2 gap-3">
              <input className="border p-2 rounded" placeholder="CertNo" value={editDraft.CertNo ?? ''} onChange={e=>setEditDraft({...editDraft, CertNo: e.target.value})}/>
              <input className="border p-2 rounded" placeholder="Certified" value={editDraft.Certified ?? ''} onChange={e=>setEditDraft({...editDraft, Certified: e.target.value})}/>
              <input className="border p-2 rounded" placeholder="Clarity" value={editDraft.Clarity ?? ''} onChange={e=>setEditDraft({...editDraft, Clarity: e.target.value})}/>
              <input className="border p-2 rounded" placeholder="Color" value={editDraft.Color ?? ''} onChange={e=>setEditDraft({...editDraft, Color: e.target.value})}/>
              <input className="border p-2 rounded" placeholder="Cut" value={editDraft.Cut ?? ''} onChange={e=>setEditDraft({...editDraft, Cut: e.target.value})}/>
              <input className="border p-2 rounded" placeholder="Polish" value={editDraft.Polish ?? ''} onChange={e=>setEditDraft({...editDraft, Polish: e.target.value})}/>
              <input className="border p-2 rounded" placeholder="Fluorescence" value={editDraft.Fluorescence ?? ''} onChange={e=>setEditDraft({...editDraft, Fluorescence: e.target.value})}/>
              <input className="border p-2 rounded" placeholder="Measurement" value={editDraft.Measurement ?? ''} onChange={e=>setEditDraft({...editDraft, Measurement: e.target.value})}/>
              <input className="border p-2 rounded" type="number" placeholder="Depth" value={editDraft.Depth ?? 0} onChange={e=>setEditDraft({...editDraft, Depth: Number(e.target.value)})}/>
              <input className="border p-2 rounded" type="number" placeholder="Discount" value={editDraft.Discount ?? 0} onChange={e=>setEditDraft({...editDraft, Discount: Number(e.target.value)})}/>
              <input className="border p-2 rounded" type="number" placeholder="RapRate" value={editDraft.RapRate ?? 0} onChange={e=>setEditDraft({...editDraft, RapRate: Number(e.target.value)})}/>
              <input className="border p-2 rounded" type="number" placeholder="NetAmt" value={editDraft.NetAmt ?? 0} onChange={e=>setEditDraft({...editDraft, NetAmt: Number(e.target.value)})}/>
              <input className="border p-2 rounded" placeholder="Shape" value={editDraft.Shape ?? ''} onChange={e=>setEditDraft({...editDraft, Shape: e.target.value})}/>
              <input className="border p-2 rounded" type="number" placeholder="Size (carat)" value={editDraft.Size ?? 0} onChange={e=>setEditDraft({...editDraft, Size: Number(e.target.value)})}/>
              <input className="border p-2 rounded" placeholder="Status" value={editDraft.Status ?? ''} onChange={e=>setEditDraft({...editDraft, Status: e.target.value})}/>
              <textarea className="border p-2 rounded col-span-2" placeholder="Comments" value={editDraft.Comments ?? ''} onChange={e=>setEditDraft({...editDraft, Comments: e.target.value})}/>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button className="border px-3 py-1 rounded" onClick={()=>setEditingKey(null)}>Cancel</button>
              <button className="border px-3 py-1 rounded" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
