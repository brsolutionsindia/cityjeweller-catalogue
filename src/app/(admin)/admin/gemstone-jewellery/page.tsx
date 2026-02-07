// src/app/(admin)/admin/gemstone-jewellery/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPendingGemstoneJewelleryQueue } from "@/lib/firebase/gemstoneJewelleryAdminDb";

type QueueItem = {
  skuId: string;
  gstNumber: string;
  supplierUid: string;
  status: string;
  thumbUrl?: string;
  createdAt?: any;
  updatedAt?: any;
};

const toNum = (v: any) => (typeof v === "number" ? v : Number(v || 0));

const NO_THUMB =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
      <rect width='100%' height='100%' fill='#eee'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#666' font-size='14'>
        No Thumb
      </text>
    </svg>`
  );

export default function Page() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) =>
      [it.skuId, it.gstNumber, it.supplierUid].some((x) => (x || "").toLowerCase().includes(s))
    );
  }, [items, q]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setBusy(true);
      try {
        const obj = await getPendingGemstoneJewelleryQueue();

        // Firebase queue is an object keyed by skuId
        const arr = Object.entries(obj || {}).map(([skuIdKey, raw]) => {
          const it = (raw || {}) as Partial<QueueItem>;
          return {
            skuId: it.skuId || skuIdKey,
            gstNumber: it.gstNumber || "",
            supplierUid: it.supplierUid || "",
            status: it.status || "PENDING",
            thumbUrl: it.thumbUrl || "",
            createdAt: it.createdAt,
            updatedAt: it.updatedAt,
          } as QueueItem;
        });

        arr.sort(
          (a, b) =>
            toNum(b.updatedAt) - toNum(a.updatedAt) || toNum(b.createdAt) - toNum(a.createdAt)
        );

        if (alive) setItems(arr);
      } finally {
        if (alive) setBusy(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm underline">
            ← Back to Admin
          </Link>
          <div className="text-2xl font-bold mt-1">Gemstone Jewellery Approvals</div>
          <div className="text-xs text-gray-500 mt-1">
            {busy ? "Loading…" : `Pending: ${items.length}`}
          </div>
        </div>

        <input
          className="border rounded-xl px-3 py-2 w-72"
          placeholder="Search by SKU / GST / Supplier UID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {busy && <div className="text-sm text-gray-500">Loading pending queue…</div>}

        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((it) => (
            <Link
              key={it.skuId}
              // ✅ NO gst query param needed because detail page reads gstNumber from queue
              href={`/admin/gemstone-jewellery/${encodeURIComponent(it.skuId)}`}
              className="rounded-2xl border p-4 flex gap-4 hover:bg-slate-50"
            >
              <div className="w-24 h-24 rounded-xl border overflow-hidden bg-gray-50 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.thumbUrl || NO_THUMB}
                  alt={it.skuId}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1">
                <div className="font-bold">{it.skuId}</div>
                <div className="text-xs text-gray-600 mt-1">
                  GST: <b>{it.gstNumber}</b>
                </div>
                <div className="text-xs text-gray-600">
                  Supplier UID: <b>{it.supplierUid}</b>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Status: <b>{it.status}</b>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!busy && filtered.length === 0 && (
          <div className="text-sm text-gray-600">No pending gemstone jewellery submissions.</div>
        )}
      </div>
    </div>
  );
}
