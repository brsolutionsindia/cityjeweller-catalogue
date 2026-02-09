"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import { db } from "@/firebaseConfig";
import { get, ref as dbRef } from "firebase/database";
import type { RudrakshaSubmission } from "@/lib/rudraksha/types";
import { deleteRudrakshaSubmission } from "@/lib/firebase/rudrakshaDb";

const SUBMISSION_NODE = (gst: string) => `GST/${gst}/Submissions/Rudraksha`;
const SUPPLIER_INDEX = (gst: string, uid: string) => `GST/${gst}/Indexes/RudrakshaSubmissions/BySupplier/${uid}`;

const SORTS = [
  { key: "new", label: "Newest" },
  { key: "plh", label: "Price: Low → High" },
  { key: "phl", label: "Price: High → Low" },
] as const;

function uniq(arr: string[]) { return Array.from(new Set(arr.filter(Boolean))); }
function toNum(x: any) { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function money(n: number | null) { if (n === null) return "-"; return `₹${Math.round(n).toLocaleString("en-IN")}`; }
function formatWhen(ts?: number) { if (!ts) return "-"; try { return new Date(ts).toLocaleString(); } catch { return String(ts); } }

function asKind(m: any): "IMG" | "VID" {
  if (m?.kind === "IMG" || m?.kind === "VID") return m.kind;
  if (m?.type === "video") return "VID";
  return "IMG";
}
function getThumb(s: RudrakshaSubmission) {
  const imgs = (s.media || []).filter((m: any) => asKind(m) === "IMG").sort((a: any, b: any) => (a?.order ?? 9999) - (b?.order ?? 9999));
  return (imgs?.[0] as any)?.url || "";
}

function isWeightMode(pm: any) {
  const x = String(pm || "").toUpperCase();
  return x === "WEIGHT" || x === "PRICE_PER_WEIGHT" || x === "RATE_PER_WEIGHT";
}
function pickSupplierPrice(s: any): number | null {
  const pm = String(s?.priceMode || "MRP");
  if (isWeightMode(pm)) {
    const rate = toNum(s?.ratePerGm);
    const w = toNum(s?.weightGm);
    if (rate > 0 && w > 0) return Math.round(rate * w);
    return null;
  }
  const offer = toNum(s?.offerPrice);
  const mrp = toNum(s?.mrp);
  if (offer > 0) return offer;
  if (mrp > 0) return mrp;
  return null;
}

export default function SupplierRudrakshaHome() {
  const session = useSupplierSession();
  const gst = session?.gst;
  const uid = session?.uid;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RudrakshaSubmission[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("ALL");
  const [origin, setOrigin] = useState<string>("ALL");
  const [mukhi, setMukhi] = useState<string>("ALL");
  const [tag, setTag] = useState<string>("ALL");
  const [minP, setMinP] = useState<string>("");
  const [maxP, setMaxP] = useState<string>("");
  const [sortKey, setSortKey] = useState<(typeof SORTS)[number]["key"]>("new");

  async function load() {
    if (!gst || !uid) return;

    setLoading(true);
    setErr(null);

    try {
      const idxSnap = await get(dbRef(db, SUPPLIER_INDEX(gst, uid)));
      const skuIds = idxSnap.exists() ? Object.keys(idxSnap.val() || {}) : [];

      if (!skuIds.length) {
        setItems([]);
        setSelected({});
        return;
      }

      const results = await Promise.all(
        skuIds.map(async (skuId) => {
          const snap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
          return snap.exists() ? (snap.val() as RudrakshaSubmission) : null;
        })
      );

      const cleaned = results.filter(Boolean).map((x) => x as RudrakshaSubmission).filter((s) => !uid || s.supplierUid === uid);
      cleaned.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      setItems(cleaned);

      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const it of cleaned) if (prev[it.skuId]) next[it.skuId] = true;
        return next;
      });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (gst && uid) load(); /* eslint-disable-next-line */ }, [gst, uid]);

  const meta = useMemo(() => {
    const types = uniq(items.map((x) => String(x.type || "").toUpperCase()).filter(Boolean));
    const origins = uniq(items.map((x) => String((x as any).origin || "").toUpperCase()).filter(Boolean));
    const mukhis = uniq(items.map((x) => String(x.mukhi ?? "")).filter(Boolean));
    const tags = uniq((items.flatMap((x) => (x.tags || []) as any[]) as any[]).map((t) => String(t).toLowerCase()));
    return { types, origins, mukhis, tags };
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const min = minP ? Number(minP) : null;
    const max = maxP ? Number(maxP) : null;

    let arr = items.filter((it) => {
      const price = pickSupplierPrice(it);
      const text = `${it.skuId} ${it.itemName || ""} ${it.type || ""} ${it.origin || ""} ${it.mukhi ?? ""}`.toLowerCase();
      if (s && !text.includes(s)) return false;

      if (type !== "ALL" && String(it.type || "").toUpperCase() !== type) return false;
      if (origin !== "ALL" && String((it as any).origin || "").toUpperCase() !== origin) return false;
      if (mukhi !== "ALL" && String(it.mukhi ?? "") !== mukhi) return false;

      if (tag !== "ALL") {
        const tags = (it.tags || []).map((t) => String(t).toLowerCase());
        if (!tags.includes(tag)) return false;
      }

      if (min !== null && price !== null && price < min) return false;
      if (max !== null && price !== null && price > max) return false;

      return true;
    });

    if (sortKey === "plh") arr = arr.sort((a, b) => toNum(pickSupplierPrice(a)) - toNum(pickSupplierPrice(b)));
    else if (sortKey === "phl") arr = arr.sort((a, b) => toNum(pickSupplierPrice(b)) - toNum(pickSupplierPrice(a)));
    else arr = arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || (b.createdAt || 0) - (a.createdAt || 0));

    return arr;
  }, [items, q, type, origin, mukhi, tag, minP, maxP, sortKey]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((x) => selected[x.skuId]);
  const someVisibleSelected = filtered.some((x) => selected[x.skuId]);

  function toggleSelectAllVisible(next: boolean) {
    setSelected((prev) => {
      const out = { ...prev };
      for (const it of filtered) {
        if (next) out[it.skuId] = true;
        else delete out[it.skuId];
      }
      return out;
    });
  }

  async function onDeleteSelected() {
    if (!gst || !uid) return;
    if (!selectedIds.length) return;

    const ok = window.confirm(
      `Delete ${selectedIds.length} listing(s)?\n\n` +
      `• Draft/Pending/Rejected: will be deleted.\n` +
      `• Approved: will be UNLISTED from website and moved to Review (admin re-approval required).`
    );
    if (!ok) return;

    setLoading(true);
    try {
      for (const skuId of selectedIds) {
        await deleteRudrakshaSubmission({ gstNumber: gst, supplierUid: uid, skuId, deleteMedia: true });
      }
      setSelected({});
      await load();
      alert("Deleted.");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setQ(""); setType("ALL"); setOrigin("ALL"); setMukhi("ALL"); setTag("ALL"); setMinP(""); setMaxP(""); setSortKey("new");
  }

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((x) => x.status === "PENDING").length;
    const approved = items.filter((x) => x.status === "APPROVED").length;
    const draft = items.filter((x) => x.status === "DRAFT").length;
    const rejected = items.filter((x) => x.status === "REJECTED").length;
    return { total, pending, approved, draft, rejected };
  }, [items]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Rudraksha</h1>
        <div className="flex gap-2">
          <button onClick={load} className="px-4 py-2 rounded-xl border" disabled={loading || !gst || !uid} type="button">Refresh</button>
          <Link href="/supplier/rudraksha/new" className="px-4 py-2 rounded-xl bg-black text-white">+ New Listing</Link>
        </div>
      </div>

      <div className="rounded-2xl border p-4 flex flex-wrap gap-3 text-sm">
        <div>Total: <b>{stats.total}</b></div>
        <div>Draft: <b>{stats.draft}</b></div>
        <div>Pending: <b>{stats.pending}</b></div>
        <div>Approved: <b>{stats.approved}</b></div>
        <div>Rejected: <b>{stats.rejected}</b></div>
      </div>

      <div className="rounded-2xl border p-4 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Filters</div>
          <button className="text-xs underline text-gray-600" onClick={resetFilters}>Reset</button>
        </div>

        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <div className="text-xs text-gray-500 mb-1">Search</div>
            <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full border rounded-xl px-3 py-2" placeholder="SKU / name / mukhi..." />
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Type</div>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.types.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Origin</div>
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.origins.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Mukhi</div>
            <select value={mukhi} onChange={(e) => setMukhi(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.mukhis.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-1">
            <div className="text-xs text-gray-500 mb-1">Min</div>
            <input value={minP} onChange={(e) => setMinP(e.target.value)} className="w-full border rounded-xl px-3 py-2" placeholder="0" />
          </div>

          <div className="md:col-span-1">
            <div className="text-xs text-gray-500 mb-1">Max</div>
            <input value={maxP} onChange={(e) => setMaxP(e.target.value)} className="w-full border rounded-xl px-3 py-2" placeholder="50000" />
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Tag</div>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.tags.map((x) => <option key={x} value={x}>#{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Sort</div>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} className="w-full border rounded-xl px-3 py-2">
              {SORTS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="text-sm text-gray-600">
          {loading ? "Loading…" : <>Showing <b>{filtered.length}</b> items • Selected <b>{selectedIds.length}</b></>}
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-xl border border-red-300 text-red-700 bg-red-50" disabled={!selectedIds.length || loading} onClick={onDeleteSelected} type="button">
            Delete Listings
          </button>
        </div>
      </div>

      {err && <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">{err}</div>}

      {loading ? (
        <div className="rounded-2xl border p-4 text-gray-600">Loading listings…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border p-6 text-gray-600">No listings matched your filters. Try resetting filters.</div>
      ) : (
        <div className="rounded-2xl border overflow-hidden bg-white">
          <div className="grid grid-cols-[44px_90px_1fr_120px_180px_140px] gap-0 px-4 py-3 text-xs font-semibold bg-gray-50 border-b">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                onChange={(e) => toggleSelectAllVisible(e.target.checked)}
              />
            </div>
            <div>Media</div>
            <div>Item</div>
            <div>Supplier Price</div>
            <div>Updated</div>
            <div className="text-right">Action</div>
          </div>

          {filtered.map((s) => {
            const thumb = getThumb(s);
            const price = pickSupplierPrice(s);

            return (
              <div key={s.skuId} className="grid grid-cols-[44px_90px_1fr_120px_180px_140px] gap-0 px-4 py-3 border-b last:border-b-0 items-center">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={!!selected[s.skuId]}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = { ...prev };
                        if (e.target.checked) next[s.skuId] = true;
                        else delete next[s.skuId];
                        return next;
                      })
                    }
                  />
                </div>

                <div>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={s.itemName || s.skuId} className="h-14 w-14 rounded-xl object-cover border" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl border flex items-center justify-center text-xs text-gray-400">No media</div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.itemName || "(No item name)"}</div>
                  <div className="text-xs text-gray-500 truncate">{s.skuId}</div>
                  <div className="text-xs mt-1">
                    <span className="px-2 py-1 rounded-full border text-[11px]">{s.status || "DRAFT"}</span>
                  </div>
                </div>

                <div className="text-sm font-semibold">{money(price)}</div>

                <div className="text-sm text-gray-600">{formatWhen((s.updatedAt as any) || (s.createdAt as any))}</div>

                <div className="text-right">
                  <Link href={`/supplier/rudraksha/${encodeURIComponent(s.skuId)}`} className="px-3 py-2 rounded-xl border inline-block text-sm">
                    View / Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
