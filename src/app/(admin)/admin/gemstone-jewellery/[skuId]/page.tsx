"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";
import { getQueuedGemstoneJewellery, approveGemstoneJewellery, rejectGemstoneJewellery } from "@/lib/firebase/gemstoneJewelleryAdminDb";

export default function AdminGemstoneJewelleryDetail() {
  const params = useParams<{ skuId: string }>();
  const skuId = useMemo(() => (params?.skuId as string) || "", [params]);

  const [item, setItem] = useState<GemstoneJewellerySubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getQueuedGemstoneJewellery(skuId);
        setItem(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [skuId]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!item) return <div className="p-6">Not found in queue.</div>;

  async function approve() {
    // TODO: pass actual admin uid from your admin auth layer
    await approveGemstoneJewellery({ gst: item.gstNumber, skuId: item.skuId, adminUid: "ADMIN" });
    alert("Approved & Published");
  }

  async function reject() {
    if (!reason.trim()) return alert("Enter rejection reason");
    await rejectGemstoneJewellery({ gst: item.gst, skuId: item.skuId, adminUid: "ADMIN", reason });
    alert("Rejected");
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Review • {item.itemName}</h1>

      <div className="rounded-2xl border p-4 space-y-2">
        <div><b>Nature:</b> {item.nature}</div>
        <div><b>Type:</b> {item.type}</div>
        <div><b>Tags:</b> {(item.tags || []).map(t => `#${t}`).join(" ")}</div>
        <div><b>Supplier:</b> {item.gstNumber}</div>
      </div>

      <div className="flex gap-2">
        <button onClick={approve} className="px-4 py-2 rounded-xl bg-black text-white">
          Approve
        </button>

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1 border rounded-xl px-3 py-2"
          placeholder="Rejection reason (required)"
        />
        <button onClick={reject} className="px-4 py-2 rounded-xl border">
          Reject
        </button>
      </div>

      {/* TODO: add a media viewer grid here (reuse your yellow-sapphire display style) */}
    </div>
  );
}
