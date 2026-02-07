"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import { db } from "@/firebaseConfig";
import { get, ref as dbRef } from "firebase/database";

import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";

const SUBMISSION_NODE = (gst: string) => `GST/${gst}/Submissions/GemstoneJewellery`;
const SUPPLIER_INDEX = (gst: string, uid: string) =>
  `GST/${gst}/Indexes/GemstoneJewellerySubmissions/BySupplier/${uid}`;

function formatWhen(ts?: number) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function getThumb(s: GemstoneJewellerySubmission) {
  const imgs = (s.media || [])
    .filter((m: any) => (m?.kind || m?.type) === "IMG" || m?.kind === "image")
    .sort((a: any, b: any) => (a?.order ?? 9999) - (b?.order ?? 9999));
  return imgs?.[0]?.url || "";
}

export default function SupplierGemstoneJewelleryHome() {
  const session = useSupplierSession();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GemstoneJewellerySubmission[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const gst = session?.gst;
  const uid = session?.uid;

  async function load() {
    if (!gst || !uid) return;

    setLoading(true);
    setErr(null);

    try {
      // 1) read index -> skuIds
      const idxSnap = await get(dbRef(db, SUPPLIER_INDEX(gst, uid)));
      const skuIds = idxSnap.exists() ? Object.keys(idxSnap.val() || {}) : [];

      if (!skuIds.length) {
        setItems([]);
        return;
      }

      // 2) read each submission (parallel)
      const results = await Promise.all(
        skuIds.map(async (skuId) => {
          const snap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
          return snap.exists() ? (snap.val() as GemstoneJewellerySubmission) : null;
        })
      );

      const cleaned = results
        .filter(Boolean)
        .map((x) => x as GemstoneJewellerySubmission)
        // safety: keep only this supplier
        .filter((s) => !uid || s.supplierUid === uid);

      // 3) sort newest first
      cleaned.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      setItems(cleaned);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!gst || !uid) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gst, uid]);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gemstone Jewellery</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl border"
            disabled={loading || !gst || !uid}
            type="button"
          >
            Refresh
          </button>
          <Link
            href="/supplier/gemstone-jewellery/new"
            className="px-4 py-2 rounded-xl bg-black text-white"
          >
            + New Listing
          </Link>
        </div>
      </div>

      {/* Small stats row */}
      <div className="rounded-2xl border p-4 flex flex-wrap gap-3 text-sm">
        <div>Total: <b>{stats.total}</b></div>
        <div>Draft: <b>{stats.draft}</b></div>
        <div>Pending: <b>{stats.pending}</b></div>
        <div>Approved: <b>{stats.approved}</b></div>
        <div>Rejected: <b>{stats.rejected}</b></div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border p-4 text-gray-600">Loading listings…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border p-6 text-gray-600">
          No listings yet. Click <b>+ New Listing</b> to create one.
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden">
          <div className="grid grid-cols-[90px_1fr_120px_180px_120px] gap-0 px-4 py-3 text-xs font-semibold bg-gray-50 border-b">
            <div>Media</div>
            <div>Item</div>
            <div>Status</div>
            <div>Updated</div>
            <div className="text-right">Action</div>
          </div>

          {items.map((s) => {
            const thumb = getThumb(s);
            return (
              <div
                key={s.skuId}
                className="grid grid-cols-[90px_1fr_120px_180px_120px] gap-0 px-4 py-3 border-b last:border-b-0 items-center"
              >
                <div>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={s.itemName || s.skuId}
                      className="h-14 w-14 rounded-xl object-cover border"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl border flex items-center justify-center text-xs text-gray-400">
                      No media
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.itemName || "(No item name)"}</div>
                  <div className="text-xs text-gray-500 truncate">{s.skuId}</div>
                </div>

                <div className="text-sm">
                  <span className="px-2 py-1 rounded-full border text-xs">
                    {s.status || "DRAFT"}
                  </span>
                </div>

                <div className="text-sm text-gray-600">{formatWhen(s.updatedAt || s.createdAt)}</div>

                <div className="text-right">
                  {/* Adjust this route to your actual edit/view page */}
                  <Link
                    href={`/supplier/gemstone-jewellery/${s.skuId}`}
                    className="px-3 py-2 rounded-xl border inline-block text-sm"
                  >
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
