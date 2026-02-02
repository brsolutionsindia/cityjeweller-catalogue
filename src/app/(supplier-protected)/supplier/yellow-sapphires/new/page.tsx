"use client";

import React, { useEffect, useState } from "react";
import { SupplierProvider, useSupplierSession } from "@/lib/firebase/supplierContext";
import YellowSapphireForm from "@/components/supplier/YellowSapphireForm";
import {
  allocateYellowSapphireSku,
  createSubmissionStub,
  saveSubmission,
  getSupplierDefaults,
} from "@/lib/firebase/yellowSapphireDb";
import { useRouter } from "next/navigation";

function Inner() {
  const { uid, gst, loading } = useSupplierSession();
  const router = useRouter();

  const [skuId, setSkuId] = useState<string>("");
  const [allocating, setAllocating] = useState(false);

  // ✅ Prefill from supplier defaults
  const [prefill, setPrefill] = useState<any>(null);
  const [defaultsLoading, setDefaultsLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (loading) return;

      if (!uid) {
        window.location.href = "/login";
        return;
      }
      if (!gst) {
        alert("GST not found for this user. Check /User ID/<uid>/Shop GST");
        return;
      }

      setAllocating(true);
      try {
        // 1) allocate SKU
        const { skuId } = await allocateYellowSapphireSku(gst, uid);
        setSkuId(skuId);

        // 2) create stub (queue + submission + index)
        await createSubmissionStub({ skuId, gst, supplierUid: uid });

        // 3) fetch supplier defaults for prefill
        setDefaultsLoading(true);
        const defaults = await getSupplierDefaults(gst, uid);
        setPrefill(defaults || {});
      } catch (e: any) {
        console.error(e);
        alert(e?.message || "Failed to create listing");
      } finally {
        setDefaultsLoading(false);
        setAllocating(false);
      }
    };

    run();
  }, [uid, gst, loading]);

  if (loading || allocating || defaultsLoading) {
    return <div className="p-6">Preparing listing...</div>;
  }

  if (!skuId || !uid || !gst) {
    return <div className="p-6">Unable to create listing.</div>;
  }

  return (
    <div className="p-6">
      <YellowSapphireForm
        mode="create"
        skuId={skuId}
        initial={prefill || undefined}
        onSubmit={async (data) => {
          await saveSubmission({ skuId, gst, supplierUid: uid, data });
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
