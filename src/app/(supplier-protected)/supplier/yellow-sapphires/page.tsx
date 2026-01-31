"use client";

import React, { useEffect, useMemo, useState } from "react";
import { SupplierProvider, useSupplierSession } from "@/lib/firebase/supplierContext";
import { get, ref } from "firebase/database";
import { db } from "@/lib/firebase/firebaseClient";
import type { YellowSapphireListing } from "@/lib/yellowSapphire/types";
import { deleteSubmission, getSubmission } from "@/lib/firebase/yellowSapphireDb";
import { buildWhatsAppMessage, openWhatsAppShare } from "@/components/supplier/WhatsAppShare";
import Link from "next/link";

function Inner() {
  const { uid, gst, loading, refresh } = useSupplierSession();
  const [items, setItems] = useState<YellowSapphireListing[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedList = useMemo(
    () => items.filter((it) => selected[it.skuId]),
    [items, selected]
  );

  const load = async () => {
    if (!uid || !gst) return;
    setBusy(true);

    try {
      const idxSnap = await get(
        ref(db, `GST/${gst}/Indexes/YellowSapphiresSubmissions/BySupplier/${uid}`)
      );
      const keysObj = (idxSnap.val() || {}) as Record<string, any>;
      const skuIds = Object.keys(keysObj);

      if (!skuIds.length) {
        setItems([]);
        setSelected({});
        return;
      }

      const fetched = await Promise.all(
        skuIds.map(async (sku) => (await getSubmission(gst, sku)) || null)
      );

      const cleaned = fetched.filter(Boolean) as YellowSapphireListing[];

      const toNum = (v: any) => (typeof v === "number" ? v : Number(v || 0));
      cleaned.sort((a, b) => toNum(b.updatedAt) - toNum(a.updatedAt));

      setItems(cleaned);
      setSelected({});
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (loading) return;
      if (!uid) {
        window.location.href = "/supplier/login";
        return;
      }
      if (!gst) {
        await refresh();
      }
      await load();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, gst, loading]);

  const toggleAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    items.forEach((it) => (next[it.skuId] = v));
    setSelected(next);
  };

  const bulkDelete = async () => {
    if (!uid || !gst) return;
    if (!selectedList.length) return alert("Select at least one listing.");

    if (!confirm(`Delete ${selectedList.length} listing(s)? This will delete media too.`)) return;

    setBusy(true);
    try {
      for (const it of selectedList) {
        await deleteSubmission({ skuId: it.skuId, gst, supplierUid: uid });
      }
      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const bulkShare = () => {
    if (!selectedList.length) return alert("Select at least one listing.");
    openWhatsAppShare(buildWhatsAppMessage(selectedList));
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          {/* ✅ Back button */}
          <div>
            <Link
              href="/supplier/dashboard"
              className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-black"
            >
              <span aria-hidden>←</span>
              <span>Back</span>
            </Link>
          </div>

          <div className="text-sm text-gray-500">Supplier Portal</div>
          <div className="text-2xl font-bold">Yellow Sapphire Listings</div>
          <div className="text-xs text-gray-500">GST: {gst || "-"}</div>
        </div>

        <div className="flex items-center gap-2">
          {/* ✅ Button text visibility fix */}
          <Link
            href="/supplier/yellow-sapphires/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 font-medium !text-white hover:bg-zinc-900"
          >
            <span aria-hidden>+</span>
            <span> Add Listing</span>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={items.length > 0 && selectedList.length === items.length}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              <span className="text-sm">Select All</span>
            </label>

            <div className="text-sm text-gray-600">
              Showing <b>{items.length}</b> item(s)
            </div>

            {selectedList.length > 0 && (
              <div className="text-sm text-gray-600">
                Selected <b>{selectedList.length}</b>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={bulkShare}
              className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              disabled={busy}
            >
              Share on WhatsApp
            </button>
            <button
              type="button"
              onClick={bulkDelete}
              className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              disabled={busy}
            >
              Delete
            </button>
          </div>
        </div>

        {busy && <div className="text-sm text-gray-500">Loading...</div>}

        <div className="grid md:grid-cols-2 gap-3">
          {items.map((it) => (
            <div key={it.skuId} className="rounded-2xl border p-4 flex gap-4">
              <div className="w-24 h-24 rounded-xl border overflow-hidden bg-gray-50 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    it.media?.thumbUrl ||
                    it.media?.images?.[0]?.url ||
                    "data:image/svg+xml;utf8," +
                      encodeURIComponent(
                        `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%' height='100%' fill='#eee'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#666' font-size='14'>No Image</text></svg>`
                      )
                  }
                  alt={it.skuId}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{it.skuId}</div>
                    <div className="text-xs text-gray-500">
                      Approval: <b>{it.status}</b> • {it.shapeCut} • {it.color} • {it.clarity}
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={!!selected[it.skuId]}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [it.skuId]: e.target.checked }))
                    }
                  />
                </div>

                <div className="text-sm">
                  <b>{it.weightCarat}</b> ct • ₹<b>{it.ratePerCaratInr}</b>/ct
                </div>

                <div className="text-xs text-gray-600">{it.measurementMm}</div>

                <div className="flex items-center gap-2 pt-2">
                  <Link
                    href={`/supplier/yellow-sapphires/${encodeURIComponent(it.skuId)}/edit`}
                    className="text-sm underline"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/catalog/yellow-sapphire/${encodeURIComponent(it.skuId)}`}
                    className="text-sm underline"
                    target="_blank"
                  >
                    Public Page
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!busy && items.length === 0 && (
          <div className="text-sm text-gray-600">
            No listings yet. Click <b>+ Add Listing</b>.
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <SupplierProvider>
      <Inner />
    </SupplierProvider>
  );
}
