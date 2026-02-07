"use client";

import { useEffect, useState } from "react";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import GemstoneJewelleryForm from "@/components/supplier/GemstoneJewelleryForm";
import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";
import { generateItemName } from "@/lib/gemstoneJewellery/options";
import {
  allocateGemstoneJewellerySku,
  createGemstoneJewellerySubmissionStub,
  upsertGemstoneJewellerySubmission,
  submitForApproval,
} from "@/lib/firebase/gemstoneJewelleryDb";

export default function NewGemstoneJewelleryPage() {
  const session = useSupplierSession();

  const [saving, setSaving] = useState(false);
  const [booting, setBooting] = useState(true);

  const [form, setForm] = useState<GemstoneJewellerySubmission | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!session?.gst || !session?.uid) return;

      setBooting(true);
      try {
        // ✅ allocate SKU using GST code + per-supplier serial
        const { skuId } = await allocateGemstoneJewellerySku(session.gst, session.uid);

        // ✅ create stub so DB has the record early (same style as YellowSapphire)
        await createGemstoneJewellerySubmissionStub({
          skuId,
          gstNumber: session.gst,
          supplierUid: session.uid,
        });

        const base: GemstoneJewellerySubmission = {
          skuId,
          gstNumber: session.gst,
          supplierUid: session.uid,

          status: "DRAFT",
          nature: "NATURAL",
          type: "BRACELET",

          tags: [],
          itemName: generateItemName({
            nature: "NATURAL",
            type: "BRACELET",
            stoneName: "Gemstone",
            styleTags: [],
          }),
          media: [],
          currency: "INR",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        if (alive) setForm(base);
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [session?.gst, session?.uid]);

  async function saveDraft() {
    if (!form) return;
    setSaving(true);
    try {
      await upsertGemstoneJewellerySubmission(form);
      alert("Saved");
    } finally {
      setSaving(false);
    }
  }

  async function sendForApproval() {
    if (!form) return;
    setSaving(true);
    try {
      await upsertGemstoneJewellerySubmission(form);
      await submitForApproval(form.gstNumber, form.skuId, form.supplierUid);
      alert("Submitted for approval");
    } finally {
      setSaving(false);
    }
  }

  if (booting || !form) {
    return <div className="p-6">Preparing new SKU…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Gemstone Jewellery Listing</h1>
        <div className="flex gap-2">
          <button onClick={saveDraft} disabled={saving} className="px-4 py-2 rounded-xl border">
            Save Draft
          </button>
          <button onClick={sendForApproval} disabled={saving} className="px-4 py-2 rounded-xl bg-black text-white">
            Submit
          </button>
        </div>
      </div>

      <GemstoneJewelleryForm
        value={form}
        onChange={setForm}
        suggested={{
          colors: ["red", "green", "blue", "yellow", "white", "black", "pink", "purple"],
          stones: ["pearl", "amethyst", "citrine", "ruby-look", "emerald-look"],
          styles: ["dailywear", "statement", "minimal", "temple", "boho", "bridal", "healing", "classic"],
          types: ["bracelet", "string", "necklace", "earrings"],
        }}
      />
    </div>
  );
}
