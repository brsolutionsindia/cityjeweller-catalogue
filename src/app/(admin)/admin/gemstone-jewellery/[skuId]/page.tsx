"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";
import {
  getQueuedGemstoneJewellery,
  approveGemstoneJewellery,
  rejectGemstoneJewellery,
} from "@/lib/firebase/gemstoneJewelleryAdminDb";
import GemstoneJewelleryForm from "@/components/supplier/GemstoneJewelleryForm";

const DEFAULT_MARGIN = 20;

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isWeightMode(pm: any) {
  const x = String(pm || "").toUpperCase();
  return x === "WEIGHT" || x === "PRICE_PER_WEIGHT" || x === "RATE_PER_WEIGHT";
}

function computeBaseAndPublic(listing: any) {
  const pm = String(listing?.priceMode || "MRP");
  const marginPct = toNum(listing?.adminMarginPct ?? listing?.marginPct ?? DEFAULT_MARGIN);

  let base = 0;
  let source = "";

  if (isWeightMode(pm)) {
    const rate = toNum(listing?.ratePerGm);
    const wt = toNum(listing?.weightGm);
    base = rate > 0 && wt > 0 ? Math.round(rate * wt) : 0;
    source = "WEIGHT(ratePerGm*weightGm)";
  } else {
    const offer = toNum(listing?.offerPrice);
    const mrp = toNum(listing?.mrp);

    if (offer > 0) {
      base = Math.round(offer);
      source = "OFFER_PRICE";
    } else if (mrp > 0) {
      base = Math.round(mrp);
      source = "MRP";
    } else {
      base = 0;
      source = "NONE";
    }
  }

  const publicPrice = base > 0 ? Math.round(base * (1 + marginPct / 100)) : 0;

  return { marginPct, base, publicPrice, source };
}

export default function AdminGemstoneJewelleryDetail() {
  const params = useParams<{ skuId: string }>();
  const router = useRouter();

  const rawSkuId = typeof params?.skuId === "string" ? params.skuId : "";
  const skuId = useMemo(() => decodeURIComponent(rawSkuId), [rawSkuId]);

  const [data, setData] = useState<GemstoneJewellerySubmission | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminUid] = useState("admin");
  const [rejectReason, setRejectReason] = useState("");
  const [marginPct, setMarginPct] = useState<number>(DEFAULT_MARGIN);

  async function load() {
    if (!skuId) return;
    setBusy(true);
    try {
      // First try to get from queue (pending items)
      let submission = await getQueuedGemstoneJewellery(skuId);

      // If not in queue, try to get from global SKU
      if (!submission) {
        const { get, ref: dbRef } = await import("firebase/database");
        const { db } = await import("@/firebaseConfig");

        const globalSnap = await get(dbRef(db, `Global SKU/GemstoneJewellery/${skuId}`));
        if (globalSnap.exists()) {
          submission = globalSnap.val() as GemstoneJewellerySubmission;
        }
      }

      if (submission) {
        setData(submission);
        setRejectReason((submission as any)?.rejectionReason || "");
        setMarginPct(toNum(submission.adminMarginPct) || DEFAULT_MARGIN);
      }
    } catch (e: any) {
      console.error("Failed to load:", e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuId]);

  const { base: baseAmount, source: baseSource, publicPrice } = useMemo(
    () => computeBaseAndPublic({ ...data, adminMarginPct: marginPct }),
    [data, marginPct]
  );

  async function approve() {
    if (!data) return;
    setBusy(true);
    try {
      await approveGemstoneJewellery({
        gstNumber: data.gstNumber,
        skuId: data.skuId,
        adminUid,
        finalPatch: { adminMarginPct: marginPct },
      });
      alert("Approved!");
      router.push("/admin/gemstone-jewellery");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Approve failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMargin() {
    if (!data) return;
    setSaving(true);
    try {
      await approveGemstoneJewellery({
        gstNumber: data.gstNumber,
        skuId: data.skuId,
        adminUid,
        finalPatch: { adminMarginPct: marginPct },
      });
      alert("Margin saved!");
      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to save margin.");
    } finally {
      setSaving(false);
    }
  }

  async function reject() {
    if (!data || !rejectReason.trim()) {
      alert("Please enter a reason");
      return;
    }
    setBusy(true);
    try {
      await rejectGemstoneJewellery({
        gstNumber: data.gstNumber,
        skuId: data.skuId,
        adminUid,
        reason: rejectReason.trim(),
      });
      alert("Rejected.");
      router.push("/admin/gemstone-jewellery");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Reject failed.");
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div className="p-6">
        <Link href="/admin/gemstone-jewellery" className="text-sm underline">
          ← Back
        </Link>
        <div className="mt-4 text-gray-600">Loading…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Link href="/admin/gemstone-jewellery" className="text-sm underline">
          ← Back
        </Link>
        <div className="mt-4 text-red-600">Listing not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/admin/gemstone-jewellery" className="text-sm underline">
            ← Back to list
          </Link>
          <div className="text-2xl font-bold">{data.itemName || data.skuId}</div>
          <div className="text-xs text-gray-600">
            SKU: <b>{data.skuId}</b> • GST: <b>{data.gstNumber}</b> • Status: <b>{data.status}</b>
          </div>
        </div>

        <div className="flex gap-2">
          {data.status === "PENDING" && (
            <>
              <button
                onClick={approve}
                disabled={busy}
                className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={reject}
                disabled={busy}
                className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* Admin Controls - Margin & Pricing */}
      <div className="rounded-lg border p-6 bg-blue-50 border-blue-200 space-y-4">
        <h3 className="text-lg font-semibold text-blue-900">Admin Controls - Margin & Pricing</h3>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Base Price</label>
            <div className="text-2xl font-bold text-gray-900">
              ₹{baseAmount.toLocaleString("en-IN")}
            </div>
            <div className="text-xs text-gray-600 mt-1">({baseSource})</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Margin %</label>
            <input
              type="number"
              min="0"
              max="200"
              step="0.5"
              value={marginPct}
              onChange={(e) => setMarginPct(toNum(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg font-semibold text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website Price (Public)</label>
            <div className="text-2xl font-bold text-green-600">
              ₹{publicPrice.toLocaleString("en-IN")}
            </div>
            <div className="text-xs text-gray-600 mt-1">Base + {marginPct}% margin</div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={saveMargin}
            disabled={saving || marginPct === (data.adminMarginPct ?? DEFAULT_MARGIN)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Margin"}
          </button>
        </div>
      </div>

      {/* Rejection Reason (only for pending) */}
      {data.status === "PENDING" && (
        <div className="rounded-lg border p-6 bg-red-50 border-red-200 space-y-3">
          <h3 className="font-semibold text-red-900">Rejection Reason</h3>
          <textarea
            placeholder="Explain why you're rejecting this listing (required to reject)…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm h-24"
          />
        </div>
      )}

      {/* Supplier Data - Read Only */}
      <div className="rounded-lg border p-6 bg-gray-50 border-gray-200 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Listing Details (Supplier Data - Read-Only)</h3>
        <p className="text-sm text-gray-600">
          These fields are controlled by the supplier. To modify content, the supplier must edit from their dashboard.
        </p>

        {/* Display the full form in read-only mode */}
        <div className="pointer-events-none opacity-70">
          <GemstoneJewelleryForm
            value={data}
            onChange={() => {
              /* no-op */
            }}
            readOnlyStatus={true}
          />
        </div>

        <div className="text-xs text-gray-600 bg-white p-3 rounded border border-gray-200 mt-4">
          ℹ️ <strong>Admin can only modify:</strong> Margin % and pricing. All supplier-controlled content must be
          changed by the supplier from their dashboard.
        </div>
      </div>
    </div>
  );
}

