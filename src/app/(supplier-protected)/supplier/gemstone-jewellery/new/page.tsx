"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import GemstoneJewelleryForm from "@/components/supplier/GemstoneJewelleryForm";
import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";
import { generateItemName } from "@/lib/gemstoneJewellery/options";
import {
  allocateGemstoneJewellerySku,
  createGemstoneJewellerySubmissionStub,
  upsertGemstoneJewellerySubmission,
  submitForApproval,
  getSupplierDefaultsGemstoneJewellery,
} from "@/lib/firebase/gemstoneJewelleryDb";

export default function NewGemstoneJewelleryPage() {
  const session = useSupplierSession();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [booting, setBooting] = useState(true);
  const [form, setForm] = useState<GemstoneJewellerySubmission | null>(null);
  const [err, setErr] = useState<string>("");

  // ✅ init only once per unique session identity
  const initKey = useMemo(() => {
    const gst = (session?.gst || "").trim();
    const uid = (session?.uid || "").trim();
    return gst && uid ? `${gst}__${uid}` : "";
  }, [session?.gst, session?.uid]);

  const didInitKeyRef = useRef<string>("");

  useEffect(() => {
    // Wait until session is ready
    if (!initKey) {
      setBooting(true);
      return;
    }

    // Avoid re-init for same session key (prevents dev double run + re-renders)
    if (didInitKeyRef.current === initKey) return;
    didInitKeyRef.current = initKey;

    let alive = true;

    (async () => {
      setErr("");
      setBooting(true);

      try {
        console.log("[GJ:new] session ready:", { gst: session!.gst, uid: session!.uid });

        const { skuId } = await allocateGemstoneJewellerySku(session!.gst, session!.uid);
        console.log("[GJ:new] allocated skuId:", skuId);

        await createGemstoneJewellerySubmissionStub({
          skuId,
          gstNumber: session!.gst,
          supplierUid: session!.uid,
        });
        console.log("[GJ:new] stub created (or already existed):", skuId);

        const defaults = await getSupplierDefaultsGemstoneJewellery(session!.gst, session!.uid);
        console.log("[GJ:new] defaults:", defaults);

        const nature = (defaults?.nature as any) || "NATURAL";
        const type = (defaults?.type as any) || "BRACELET";

        const base: GemstoneJewellerySubmission = {
          skuId,
          gstNumber: session!.gst,
          supplierUid: session!.uid,

          status: "DRAFT",
          nature,
          type,

          stoneName: defaults?.stoneName || "Gemstone",
          lookName: defaults?.lookName || undefined,
          material: (defaults as any)?.material || undefined,
          closure: (defaults as any)?.closure || undefined,

          beadSizeMm: (defaults as any)?.beadSizeMm ?? undefined,
          lengthInch: (defaults as any)?.lengthInch ?? undefined,

          // ✅ these fields exist only if you added them in types.ts (else remove)
          ...(defaults as any)?.priceMode ? { priceMode: (defaults as any).priceMode } : {},
          ...(defaults as any)?.ratePerGm ? { ratePerGm: (defaults as any).ratePerGm } : {},
          ...(defaults as any)?.weightGm ? { weightGm: (defaults as any).weightGm } : {},

          mrp: (defaults as any)?.mrp ?? undefined,
          offerPrice: (defaults as any)?.offerPrice ?? undefined,

          tags: [],
          itemName: generateItemName({
            nature,
            type,
            stoneName: defaults?.stoneName || "Gemstone",
            lookName: defaults?.lookName,
            styleTags: [],
          }),
          media: [],
          currency: "INR",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        if (alive) setForm(base);
      } catch (e: any) {
        console.error("[GJ:new] init failed:", e);
        if (alive) setErr(e?.message || "Failed to prepare new SKU");
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initKey]);

  async function saveDraft() {
    if (!form) return;
    setSaving(true);
    try {
      await upsertGemstoneJewellerySubmission(form);
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
      await upsertGemstoneJewellerySubmission(form);
      await submitForApproval(form.gstNumber, form.skuId, form.supplierUid);
      alert("Submitted for approval");
      router.push("/supplier/gemstone-jewellery");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  // ✅ better boot UI + session visibility
  if (booting || !form) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-lg font-semibold">Preparing new SKU…</div>

        <div className="text-sm text-gray-600">
          Session: GST = <b>{session?.gst || "(not ready)"}</b> • UID ={" "}
          <b>{session?.uid || "(not ready)"}</b>
        </div>

        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <b>Init failed:</b> {err}
            <div className="mt-2 text-xs text-red-700">
              Open console logs: <b>[GJ:new]</b> lines will show exact failure step.
            </div>
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
        <h1 className="text-2xl font-semibold">New Gemstone Jewellery Listing</h1>
        <div className="flex gap-2">
          <button onClick={saveDraft} disabled={saving} className="px-4 py-2 rounded-xl border">
            Save Draft
          </button>
          <button
            onClick={sendForApproval}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-black text-white"
          >
            Submit
          </button>
        </div>
      </div>

      <GemstoneJewelleryForm value={form} onChange={setForm} readOnlyStatus={false} />
    </div>
  );
}
