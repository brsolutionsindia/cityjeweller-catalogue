"use client";

import { useMemo, useState } from "react";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import GemstoneJewelleryForm from "@/components/supplier/GemstoneJewelleryForm";
import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";
import { generateItemName } from "@/lib/gemstoneJewellery/options";
import { upsertGemstoneJewellerySubmission, submitForApproval } from "@/lib/firebase/gemstoneJewelleryDb";

export default function NewGemstoneJewelleryPage() {
  const session = useSupplierSession();
  const skuId = useMemo(() => crypto.randomUUID(), []);

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<GemstoneJewellerySubmission>(() => {
    const base: GemstoneJewellerySubmission = {
      skuId,
      gst: session.gst,
      supplierUid: session.uid,
      status: "DRAFT",
      nature: "NATURAL",
      type: "BRACELET",
      tags: [],
      itemName: generateItemName({ nature: "NATURAL", type: "BRACELET", stoneName: "Gemstone", styleTags: [] }),
      media: [],
      currency: "INR",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return base;
  });

  async function saveDraft() {
    setSaving(true);
    try {
      await upsertGemstoneJewellerySubmission(form);
      alert("Saved");
    } finally {
      setSaving(false);
    }
  }

  async function sendForApproval() {
    setSaving(true);
    try {
      await upsertGemstoneJewellerySubmission(form);
      await submitForApproval(form.gst, form.skuId, form.supplierUid);
      alert("Submitted for approval");
    } finally {
      setSaving(false);
    }
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
        // suggested tags can be loaded later from Config/Tags
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
