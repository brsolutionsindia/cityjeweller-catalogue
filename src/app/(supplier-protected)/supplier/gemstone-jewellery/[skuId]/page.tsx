"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useSupplierSession } from "@/lib/firebase/supplierContext";
import GemstoneJewelleryForm from "@/components/supplier/GemstoneJewelleryForm";

import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";

import {
  getGemstoneJewellerySubmission,
  upsertGemstoneJewellerySubmission,
  submitForApproval,
} from "@/lib/firebase/gemstoneJewelleryDb";

function toStr(x: any) {
  return String(x ?? "").trim();
}

export default function SupplierGemstoneJewelleryEditPage() {
  const session = useSupplierSession();
  const router = useRouter();
  const params = useParams<{ skuId: string }>();

  const skuId = useMemo(() => decodeURIComponent(toStr(params?.skuId)), [params]);

  const gst = useMemo(() => toStr(session?.gst), [session?.gst]);
  const uid = useMemo(() => toStr(session?.uid), [session?.uid]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const [form, setForm] = useState<GemstoneJewellerySubmission | null>(null);

  async function load() {
    if (!gst || !uid || !skuId) return;
    setLoading(true);
    setErr("");
    try {
      const s = await getGemstoneJewellerySubmission(gst, skuId);
      if (!s) {
        setForm(null);
        setErr("Listing not found.");
        return;
      }
      if (s.supplierUid !== uid) {
        setForm(null);
        setErr("Access denied: this SKU does not belong to your supplier account.");
        return;
      }
      setForm(s);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Failed to load listing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!gst || !uid || !skuId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gst, uid, skuId]);

  async function saveDraft() {
    if (!form) return;
    setSaving(true);
    setErr("");

    try {
      // ✅ IMPORTANT:
      // If listing was APPROVED earlier, this will:
      // - move it to PENDING
      // - push AdminQueue
      // - remove from Global SKU (hide from website)
      await upsertGemstoneJewellerySubmission(form, { triggerReapprovalIfApproved: true });

      alert("Saved. If this listing was already approved, it is now sent for re-approval and hidden from website.");
      await load();
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
    setErr("");

    try {
      // Save first (also triggers reapproval if it was previously approved)
      await upsertGemstoneJewellerySubmission(form, { triggerReapprovalIfApproved: true });

      // Then explicitly mark it PENDING + queue (safe even if already pending)
      await submitForApproval(form.gstNumber, form.skuId, form.supplierUid);

      alert("Submitted for approval.");
      router.push("/supplier/gemstone-jewellery");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  if (!gst || !uid) {
    return (
      <div className="p-6">
        <div className="text-gray-600">Loading supplier session…</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Link href="/supplier/gemstone-jewellery" className="text-sm underline">
          ← Back
        </Link>
        <div className="text-gray-600">Loading listing…</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-6 space-y-3">
        <Link href="/supplier/gemstone-jewellery" className="text-sm underline">
          ← Back
        </Link>
        <div className="rounded-xl border p-4 text-red-700 bg-red-50 border-red-200">
          {err || "Listing not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/supplier/gemstone-jewellery" className="text-sm underline">
            ← Back to Gemstone Jewellery
          </Link>
          <div className="text-2xl font-semibold">{form.itemName || "(No item name)"}</div>
          <div className="text-xs text-gray-600">
            SKU: <b>{form.skuId}</b> • Status: <b>{form.status || "DRAFT"}</b>
          </div>

          {form.status === "APPROVED" && (
            <div className="mt-2 text-xs rounded-xl border border-amber-200 bg-amber-50 text-amber-900 p-3">
              This listing is currently <b>APPROVED</b> on the website. If you save changes, it will be sent for
              <b> re-approval</b> and will temporarily disappear from the website until admin approves again.
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={saveDraft}
            disabled={saving}
            className="px-4 py-2 rounded-xl border"
          >
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

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <GemstoneJewelleryForm value={form} onChange={setForm} readOnlyStatus={false} />
    </div>
  );
}
