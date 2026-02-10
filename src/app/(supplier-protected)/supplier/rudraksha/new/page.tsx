// src/app/(supplier-protected)/supplier/rudraksha/new/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import RudrakshaForm from "@/components/supplier/RudrakshaForm";
import type { RudrakshaSubmission, RudrakshaType, RudrakshaOrigin, Origin } from "@/lib/rudraksha/types";
import { generateItemName } from "@/lib/rudraksha/options";
import {
  allocateRudrakshaSku,
  createRudrakshaSubmissionStub,
  upsertRudrakshaSubmission,
  submitForApprovalRudraksha,
  getSupplierDefaultsRudraksha,
} from "@/lib/firebase/rudrakshaDb";

const SUGGESTED_TAGS = {
  mukhi: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  purposes: ["shivratri", "meditation", "protection", "health", "wealth", "peace", "focus"],
  styles: ["dailywear", "temple", "minimal", "premium", "traditional", "vedic"],
  materials: ["silver", "gold", "thread", "panchdhatu", "elastic"],
  types: ["mala", "bracelet", "pendant", "ring", "loose-bead"],
};

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

export default function NewRudrakshaPage() {
  const session = useSupplierSession();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [booting, setBooting] = useState(true);
  const [form, setForm] = useState<RudrakshaSubmission | null>(null);
  const [err, setErr] = useState<string>("");
  const [stage, setStage] = useState<string>("");

  const gst = useMemo(() => (session?.gst ?? "").trim(), [session?.gst]);
  const uid = useMemo(() => (session?.uid ?? "").trim(), [session?.uid]);

  const initKey = useMemo(() => (gst && uid ? `${gst}__${uid}` : ""), [gst, uid]);
  //const didInitKeyRef = useRef<string>("");

  // remove this line completely:
  // const didInitKeyRef = useRef<string>("");

  const runIdRef = useRef(0);

  useEffect(() => {
    if (!initKey) {
      setBooting(true);
      return;
    }

    // Each effect run gets a unique id
    runIdRef.current += 1;
    const runId = runIdRef.current;

    const isStale = () => runId !== runIdRef.current;

    (async () => {
      setErr("");
      setStage("Starting…");
      setBooting(true);

      try {
        setStage("Allocating SKU…");
        console.log("[RD:new] allocating sku", { gst, uid });

        const { skuId } = await withTimeout(
          allocateRudrakshaSku(gst, uid),
          15000,
          "allocateRudrakshaSku"
        );
        console.log("[RD:new] allocated skuId:", skuId);
        if (isStale()) return;

        setStage("Creating submission stub…");
        console.log("[RD:new] creating stub", { skuId });

        await withTimeout(
          createRudrakshaSubmissionStub({ skuId, gstNumber: gst, supplierUid: uid }),
          15000,
          "createRudrakshaSubmissionStub"
        );
        console.log("[RD:new] stub created");
        if (isStale()) return;

        setStage("Loading supplier defaults…");
        let defaults: any = null;
        try {
          defaults = await withTimeout(
            getSupplierDefaultsRudraksha(gst, uid),
            8000,
            "getSupplierDefaultsRudraksha"
          );
          console.log("[RD:new] defaults:", defaults);
        } catch (e) {
          console.warn("[RD:new] defaults skipped:", e);
          defaults = null;
        }
        if (isStale()) return;

        setStage("Preparing form…");

        const now = Date.now();

        const type = ((defaults as any)?.type || "MALA") as RudrakshaType;
        const originLegacy =
          (((defaults as any)?.originLegacy ?? (defaults as any)?.origin) || "UNKNOWN") as RudrakshaOrigin;
        const mukhi = ((defaults as any)?.mukhi ?? null) as number | null;

        const origin =
          (((defaults as any)?.originNew ?? (defaults as any)?.originNewSchema ?? null) ||
            (defaults as any)?.originNew ||
            null) as Origin | null;

        const material = ((defaults as any)?.material ?? null) as string | null;

        const base: RudrakshaSubmission = {
          skuId,
          gstNumber: gst,
          supplierUid: uid,
          status: "DRAFT",

          type,
          originLegacy,
          mukhi,
          sizeMm: null,
          weightGm: null,

          labCertified: null,
          energized: null,
          natural: true,

          material,
          closure: (defaults as any)?.closure ?? null,
          lengthInch: null,

          priceMode: ((defaults as any)?.priceMode ?? "MRP") as any,
          ratePerGm: (defaults as any)?.ratePerGm ?? null,
          mrp: null,
          offerPrice: null,
          currency: "INR",

          origin,
          productCategory: null,
          intendedWearTypes: null,

          tags: [],
          itemName: generateItemName({
            type,
            mukhi,
            origin: originLegacy,
            material,
            tags: [],
          }),
          media: [],

          createdAt: now,
          updatedAt: now,
        };

        if (isStale()) return;

        console.log("[RD:new] setting form now", base);

        setForm(base);
        setStage("Ready");
        setBooting(false);
      } catch (e: any) {
        console.error("[RD:new] init failed:", e);
        if (isStale()) return;
        setErr(e?.message || "Failed to prepare new SKU");
        setStage("Failed");
        setBooting(false);
      }
    })();

    return () => {
      // invalidate this run
      runIdRef.current += 1;
    };
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
      await submitForApprovalRudraksha(form.gstNumber, form.skuId, form.supplierUid);
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

  if (!form) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-lg font-semibold">Preparing new Rudraksha SKU…</div>
        <div className="text-sm text-gray-600">
          Session: GST = <b>{gst || "(not ready)"}</b> • UID = <b>{uid || "(not ready)"}</b>
        </div>

        <div className="rounded-xl border bg-gray-50 p-3 text-sm">
          <b>Current step:</b> {stage || "—"}
          <div className="text-xs text-gray-500 mt-1">
            If it hangs, you will now get a timeout error telling exactly which step is stuck.
          </div>
        </div>

        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <b>Init failed:</b> {err}
          </div>
        ) : null}
      </div>
    );
  }


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New Rudraksha Listing</h1>
      </div>

      <RudrakshaForm
        value={form}
        onChange={setForm}
        readOnlyStatus={false}
        suggested={SUGGESTED_TAGS}
      />

      {/* Bottom action bar */}
      <div className="sticky bottom-0 left-0 right-0 z-20 mt-8 border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-600">
            Status: <b>{form.status || "DRAFT"}</b>
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveDraft}
              disabled={saving}
              className="px-4 py-2 rounded-xl border text-sm disabled:opacity-60"
            >
              Save Draft
            </button>

            <button
              onClick={sendForApproval}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-black text-white text-sm disabled:opacity-60"
            >
              Submit
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
