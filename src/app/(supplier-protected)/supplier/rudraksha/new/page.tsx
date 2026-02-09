"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import RudrakshaForm from "@/components/supplier/RudrakshaForm";
import type { RudrakshaSubmission } from "@/lib/rudraksha/types";
import { generateItemName } from "@/lib/rudraksha/options";
import {
  allocateRudrakshaSku,
  createRudrakshaSubmissionStub,
  upsertRudrakshaSubmission,
  submitRudrakshaForApproval,
  getSupplierDefaultsRudraksha,
} from "@/lib/firebase/rudrakshaDb";

const SUGGESTED_TAGS = {
  mukhi: [1,2,3,4,5,6,7,8,9,10,11,12,13,14],
  purposes: ["shivratri", "meditation", "protection", "health", "wealth", "peace", "focus"],
  styles: ["dailywear", "temple", "minimal", "premium", "traditional", "vedic"],
  materials: ["silver", "gold", "thread", "panchdhatu", "elastic"],
  types: ["mala", "bracelet", "pendant", "ring", "loose-bead"],
};

export default function NewRudrakshaPage() {
  const session = useSupplierSession();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [booting, setBooting] = useState(true);
  const [form, setForm] = useState<RudrakshaSubmission | null>(null);
  const [err, setErr] = useState<string>("");

  const gst = useMemo(() => (session?.gst ?? "").trim(), [session?.gst]);
  const uid = useMemo(() => (session?.uid ?? "").trim(), [session?.uid]);

  const initKey = useMemo(() => (gst && uid ? `${gst}__${uid}` : ""), [gst, uid]);
  const didInitKeyRef = useRef<string>("");

  useEffect(() => {
    if (!initKey) { setBooting(true); return; }
    if (didInitKeyRef.current === initKey) return;
    didInitKeyRef.current = initKey;

    let alive = true;

    (async () => {
      setErr("");
      setBooting(true);

      try {
        const { skuId } = await allocateRudrakshaSku(gst, uid);

        await createRudrakshaSubmissionStub({ skuId, gstNumber: gst, supplierUid: uid });

        const defaults = await getSupplierDefaultsRudraksha(gst, uid);

        const now = Date.now();
        const type = (defaults?.type as any) || "MALA";
        const origin = (defaults?.origin as any) || "UNKNOWN";
        const mukhi = (defaults?.mukhi as any) ?? null;

        const base: RudrakshaSubmission = {
          skuId,
          gstNumber: gst,
          supplierUid: uid,
          status: "DRAFT",

          type,
          origin,
          mukhi,

          sizeMm: null,
          weightGm: null,

          labCertified: null,
          energized: null,
          natural: true,

          material: (defaults as any)?.material ?? null,
          closure: (defaults as any)?.closure ?? null,
          lengthInch: null,

          priceMode: (defaults as any)?.priceMode ?? "MRP",
          ratePerGm: (defaults as any)?.ratePerGm ?? null,
          mrp: null,
          offerPrice: null,

          tags: [],
          itemName: generateItemName({
            type,
            mukhi,
            origin,
            material: (defaults as any)?.material ?? null,
            tags: [],
          }),
          media: [],
          currency: "INR",

          createdAt: now,
          updatedAt: now,
        };

        if (alive) setForm(base);
      } catch (e: any) {
        console.error("[RD:new] init failed:", e);
        if (alive) setErr(e?.message || "Failed to prepare new SKU");
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => { alive = false; };
  }, [initKey, gst, uid]);

  async function saveDraft() {
    if (!form) return;
    setSaving(true);
    try {
      await upsertRudrakshaSubmission(form);
      alert("Saved");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendForApproval() {
    if (!form) return;
    setSaving(true);
    try {
      await upsertRudrakshaSubmission(form);
      await submitRudrakshaForApproval(form.gstNumber, form.skuId, form.supplierUid);
      alert("Submitted for approval");
      router.push("/supplier/rudraksha");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  if (booting || !form) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-lg font-semibold">Preparing new Rudraksha SKU…</div>
        <div className="text-sm text-gray-600">
          Session: GST = <b>{gst || "(not ready)"}</b> • UID = <b>{uid || "(not ready)"}</b>
        </div>
        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <b>Init failed:</b> {err}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            If this stays here, check console for where it stops: allocate / stub / defaults.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Rudraksha Listing</h1>
        <div className="flex gap-2">
          <button onClick={saveDraft} disabled={saving} className="px-4 py-2 rounded-xl border">
            Save Draft
          </button>
          <button onClick={sendForApproval} disabled={saving} className="px-4 py-2 rounded-xl bg-black text-white">
            Submit
          </button>
        </div>
      </div>

      <RudrakshaForm value={form} onChange={setForm} readOnlyStatus={false} suggested={SUGGESTED_TAGS} />
    </div>
  );
}
