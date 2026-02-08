"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import { db } from "@/firebaseConfig";
import { get, ref as dbRef } from "firebase/database";
import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";
import GemstoneJewelleryForm from "@/components/supplier/GemstoneJewelleryForm";
import { upsertGemstoneJewellerySubmission } from "@/lib/firebase/gemstoneJewelleryDb";

const SUBMISSION_NODE = (gst: string) => `GST/${gst}/Submissions/GemstoneJewellery`;

// ✅ Predefined Hashtags (customer search)
const SUGGESTED_TAGS = {
  colors: ["red", "green", "blue", "yellow", "white", "black", "pink", "purple"],
  stones: ["pearl", "amethyst", "citrine", "ruby-look", "emerald-look"],
  styles: ["dailywear", "statement", "minimal", "temple", "boho", "bridal", "healing", "classic"],
  types: ["bracelet", "string", "necklace", "earrings"],
};

export default function BulkAddDetailsPage() {
  const router = useRouter();
  const session = useSupplierSession();

  const gst = useMemo(() => (session?.gst ?? "").trim(), [session?.gst]);
  const uid = useMemo(() => (session?.uid ?? "").trim(), [session?.uid]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skuIds, setSkuIds] = useState<string[]>([]);
  const [items, setItems] = useState<GemstoneJewellerySubmission[]>([]);
  const [err, setErr] = useState<string>("");

  const [template, setTemplate] = useState<GemstoneJewellerySubmission | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("GJ_BULK_SKUS");
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    setSkuIds(list || []);
  }, []);

  useEffect(() => {
    if (!gst || !uid) return;
    if (!skuIds.length) {
      setLoading(false);
      return;
    }

    let alive = true;
    (async () => {
      setErr("");
      setLoading(true);
      try {
        const results = await Promise.all(
          skuIds.map(async (skuId) => {
            const snap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
            return snap.exists() ? (snap.val() as GemstoneJewellerySubmission) : null;
          })
        );

        const cleaned = results.filter(Boolean) as GemstoneJewellerySubmission[];
        if (!cleaned.length) throw new Error("No drafts found. Please retry bulk upload.");

        const mine = cleaned.filter((x) => x.supplierUid === uid);
        if (!mine.length) throw new Error("Drafts do not belong to this supplier session.");

        if (!alive) return;
        setItems(mine);

        const first = mine[0];
        setTemplate({
          ...first,
          media: [],
          status: "DRAFT",
        });
      } catch (e: any) {
        console.error(e);
        if (alive) setErr(e?.message || "Failed to load bulk drafts");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [gst, uid, skuIds]);

  function applyTemplateToItem(it: GemstoneJewellerySubmission, t: GemstoneJewellerySubmission) {
    return {
      ...it,
      status: "DRAFT",
      nature: t.nature,
      type: t.type,
      stoneName: t.stoneName,
      lookName: t.lookName,
      material: (t as any).material ?? null,
      closure: (t as any).closure ?? null,
      beadSizeMm: (t as any).beadSizeMm ?? null,
      lengthInch: (t as any).lengthInch ?? null,
      weightGm: (t as any).weightGm ?? null,

      priceMode: (t as any).priceMode ?? "MRP",
      ratePerGm: (t as any).ratePerGm ?? null,
      mrp: (t as any).mrp ?? null,
      offerPrice: (t as any).offerPrice ?? null,

      tags: t.tags || [],
      itemName: t.itemName || it.itemName,

      media: it.media || [],
      updatedAt: Date.now(),
    } as any;
  }

  async function saveDraftAll() {
    if (!template) return;
    if (!items.length) return;

    setSaving(true);
    try {
      for (const it of items) {
        const next = applyTemplateToItem(it, template);
        await upsertGemstoneJewellerySubmission(next);
      }
      alert("Bulk drafts saved. Now edit each item and Submit for approval.");
      router.push("/supplier/gemstone-jewellery");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Bulk save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!gst || !uid) {
    return (
      <div className="p-6">
        <div className="text-lg font-semibold">Bulk Add Details</div>
        <div className="text-sm text-gray-600 mt-2">Waiting for supplier session…</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-lg font-semibold">Bulk Add Details</div>
        <div className="text-sm text-gray-600 mt-2">Loading drafts…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-lg font-semibold">Bulk Add Details</div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {err}
        </div>
        <button
          className="px-4 py-2 rounded-xl border"
          onClick={() => router.push("/supplier/gemstone-jewellery")}
          type="button"
        >
          Back to listings
        </button>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-lg font-semibold">Bulk Add Details</div>
        <div className="text-sm text-gray-600">No template found.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bulk Add Details</h1>
          <div className="text-sm text-gray-600 mt-1">
            These details will be saved as <b>DRAFT</b> for <b>{items.length}</b> items.
            You must open each SKU individually to submit for approval.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-xl border"
            onClick={() => router.push("/supplier/gemstone-jewellery")}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
            onClick={saveDraftAll}
            disabled={saving}
          >
            Save Draft (All)
          </button>
        </div>
      </div>

      {/* ✅ Pass suggested tags so predefined hashtags show */}
      <GemstoneJewelleryForm
        value={template}
        onChange={setTemplate}
        readOnlyStatus={false}
        suggested={SUGGESTED_TAGS}
      />

      <div className="rounded-2xl border p-4 bg-white">
        <div className="text-sm font-semibold">Draft SKUs in this batch</div>
        <div className="mt-2 text-xs text-gray-600 flex flex-wrap gap-2">
          {items.map((x) => (
            <span key={x.skuId} className="px-2 py-1 rounded-full border">
              {x.skuId}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
