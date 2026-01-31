"use client";

import React, { useEffect, useState } from "react";
import { SupplierProvider, useSupplierSession } from "@/lib/firebase/supplierContext";
import YellowSapphireForm from "@/components/supplier/YellowSapphireForm";
import { deleteSubmission, getSubmission, saveSubmission } from "@/lib/firebase/yellowSapphireDb";
import { useParams, useRouter } from "next/navigation";
import type { YellowSapphireListing } from "@/lib/yellowSapphire/types";

function Inner() {
  const { uid, gst, loading } = useSupplierSession();
  const params = useParams<{ skuId: string }>();
  const router = useRouter();

  const skuId = decodeURIComponent(params.skuId);

  const [initial, setInitial] = useState<YellowSapphireListing | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (loading) return;

      if (!uid) {
        window.location.href = "/supplier/login";
        return;
      }
      if (!gst) {
        alert("GST not found for this user.");
        return;
      }

      setBusy(true);
      try {
        const submission = await getSubmission(gst, skuId);
        if (!submission) {
          alert("Listing not found.");
          router.push("/supplier/yellow-sapphires");
          return;
        }

        // ownership check
        if (submission.supplierUid !== uid) {
          alert("You do not have access to this listing.");
          router.push("/supplier/yellow-sapphires");
          return;
        }

        setInitial(submission);
      } catch (e: any) {
        console.error(e);
        alert(e?.message || "Failed to load listing.");
        router.push("/supplier/yellow-sapphires");
      } finally {
        setBusy(false);
      }
    };

    run();
  }, [loading, uid, gst, skuId, router]);

  if (busy || loading) return <div className="p-6">Loading listing...</div>;
  if (!initial || !uid || !gst) return <div className="p-6">Unable to load.</div>;

  const isApproved = initial.status === "APPROVED";
  const canEdit = !isApproved; // optional: block edits after approval

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          onClick={() => router.push("/supplier/yellow-sapphires")}
        >
          ← Back to Dashboard
        </button>

        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-600">
            Approval: <b>{initial.status}</b>
          </div>

          <button
            type="button"
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
            onClick={async () => {
              if (!confirm("Delete this listing? This will delete its media too.")) return;
              await deleteSubmission({ skuId, gst, supplierUid: uid });
              router.push("/supplier/yellow-sapphires");
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-xl border p-3 bg-yellow-50 text-sm text-yellow-900">
          This listing is already <b>APPROVED</b>. Editing is disabled to avoid mismatch with the public page.
          If you want changes, delete and re-submit, or ask admin to reopen.
        </div>
      )}

      <YellowSapphireForm
        mode="edit"
        skuId={skuId}
        initial={initial}
        onSubmit={async (data) => {
          if (!canEdit) return;

          // keep status PENDING when supplier edits (so admin can re-check)
          const next = {
            ...data,
            status: "PENDING" as const,
          };

          await saveSubmission({ skuId, gst, supplierUid: uid, data: next });
          router.push("/supplier/yellow-sapphires");
        }}
      />
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
