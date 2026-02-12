# Phase 3: Admin UI Implementation Guide

**Target File:** `src/app/(admin)/admin/gemstone-jewellery/page.tsx` (NEW)

**Time:** 4-5 hours  
**Focus:** Admin dashboard for listing lifecycle management

---

## Admin Dashboard Structure

**URL:** `/admin/gemstone-jewellery`

### Navigation Tabs
1. **PENDING** - Items awaiting approval
2. **APPROVED** - Live on website
3. **HIDDEN** - Hidden from website
4. **UNLIST_REQUESTS** - Supplier deletion requests
5. **ALL** - View all listings

### Features
- Search by SKU, supplier name, title
- Real-time counts for each tab
- Action buttons based on status
- Modal for reasons (when rejecting/sending back)
- Bulk actions (future enhancement)

---

## Full Admin Page Implementation

```typescript
"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import {
  getPendingGemstoneJewelleryQueue,
  getQueuedGemstoneJewellery,
  approveGemstoneJewellery,
  rejectGemstoneJewellery,
  listAllGemstoneJewelleryGlobal,
  hideGemstoneJewelleryFromWebsite,
  unhideGemstoneJewelleryToWebsite,
  sendGemstoneJewelleryBackToSupplierReview,
  approveUnlistRequestGemstoneJewellery,
  rejectUnlistRequestGemstoneJewellery,
} from "@/lib/firebase/gemstoneJewelleryAdminDb";
import { getGemstoneJewellerySubmission } from "@/lib/firebase/gemstoneJewelleryDb";
import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";

type QueueItem = GemstoneJewellerySubmission & {
  status?: string;
  reason?: string;
  thumbUrl?: string;
  queuedAt?: number;
};

type TabType = "PENDING" | "APPROVED" | "HIDDEN" | "UNLIST_REQUESTS" | "ALL";

export default function AdminGemstoneJewelleryPage() {
  const auth = useAuth();
  const adminUid = auth?.uid;

  // State
  const [tab, setTab] = useState<TabType>("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string>("");

  // Data
  const [pending, setPending] = useState<QueueItem[]>([]);
  const [global, setGlobal] = useState<(GemstoneJewellerySubmission & { isHidden: boolean })[]>([]);
  const [unlistRequests, setUnlistRequests] = useState<QueueItem[]>([]);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"REJECT" | "SEND_BACK">("REJECT");
  const [modalSkuId, setModalSkuId] = useState<string>("");
  const [modalReason, setModalReason] = useState("");

  // Load data on mount + tab change
  useEffect(() => {
    if (adminUid) load();
  }, [adminUid, tab]);

  async function load() {
    if (!adminUid) return;
    setLoading(true);
    try {
      await Promise.all([loadPending(), loadGlobal(), loadUnlistRequests()]);
    } catch (e) {
      console.error("Load failed:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadPending() {
    const queue = await getPendingGemstoneJewelleryQueue();
    if (!queue) {
      setPending([]);
      return;
    }

    const items: QueueItem[] = [];
    for (const [skuId, queueItem] of Object.entries(queue)) {
      const qItem = queueItem as any;
      if (qItem.status !== "PENDING") continue;

      try {
        const submission = await getQueuedGemstoneJewellery(skuId);
        if (submission) {
          items.push({
            ...submission,
            ...qItem,
            status: "PENDING",
          });
        }
      } catch (e) {
        console.error("Failed to load:", skuId, e);
      }
    }

    items.sort((a, b) => (b.queuedAt || 0) - (a.queuedAt || 0));
    setPending(items);
  }

  async function loadGlobal() {
    const listings = await listAllGemstoneJewelleryGlobal();
    setGlobal(listings || []);
  }

  async function loadUnlistRequests() {
    // Unlist requests are in Requests/{gstNumber}/GemstoneJewellery/{skuId}
    // For now, we'll get from queue with status UNLIST_REQUEST
    const queue = await getPendingGemstoneJewelleryQueue();
    if (!queue) {
      setUnlistRequests([]);
      return;
    }

    const items: QueueItem[] = [];
    for (const [skuId, queueItem] of Object.entries(queue)) {
      const qItem = queueItem as any;
      if (qItem.status !== "UNLIST_REQUEST") continue;

      try {
        const submission = await getQueuedGemstoneJewellery(skuId);
        if (submission) {
          items.push({
            ...submission,
            ...qItem,
            status: "UNLIST_REQUEST",
          });
        }
      } catch (e) {
        console.error("Failed to load:", skuId, e);
      }
    }

    setUnlistRequests(items);
  }

  // Actions
  async function onApprove(it: QueueItem) {
    if (!adminUid || !it.gstNumber) return;
    setActing(it.skuId);
    try {
      await approveGemstoneJewellery({
        gstNumber: it.gstNumber,
        skuId: it.skuId,
        adminUid,
      });
      alert("Approved!");
      await load();
    } catch (e: any) {
      alert(e?.message || "Approve failed");
    } finally {
      setActing("");
    }
  }

  async function onReject(it: QueueItem) {
    setModalType("REJECT");
    setModalSkuId(it.skuId);
    setModalReason("");
    setModalOpen(true);
  }

  async function submitReject() {
    if (!adminUid) return;
    const item = pending.find((p) => p.skuId === modalSkuId);
    if (!item?.gstNumber) {
      alert("Item not found");
      return;
    }

    setActing(modalSkuId);
    try {
      await rejectGemstoneJewellery({
        gstNumber: item.gstNumber,
        skuId: modalSkuId,
        adminUid,
        reason: modalReason || "Rejected by admin",
      });
      alert("Rejected!");
      setModalOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.message || "Reject failed");
    } finally {
      setActing("");
    }
  }

  async function onSendBack(it: QueueItem) {
    setModalType("SEND_BACK");
    setModalSkuId(it.skuId);
    setModalReason("");
    setModalOpen(true);
  }

  async function submitSendBack() {
    if (!adminUid) return;
    let item = pending.find((p) => p.skuId === modalSkuId);
    if (!item) item = global.find((g) => g.skuId === modalSkuId);
    if (!item?.gstNumber || !item?.supplierUid) {
      alert("Item not found");
      return;
    }

    setActing(modalSkuId);
    try {
      await sendGemstoneJewelleryBackToSupplierReview({
        gstNumber: item.gstNumber,
        skuId: modalSkuId,
        supplierUid: item.supplierUid,
        adminUid,
        reason: modalReason || "Please review and make corrections",
      });
      alert("Sent back to supplier!");
      setModalOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.message || "Send back failed");
    } finally {
      setActing("");
    }
  }

  async function onHide(it: any) {
    if (!adminUid) return;
    setActing(it.skuId);
    try {
      await hideGemstoneJewelleryFromWebsite({
        skuId: it.skuId,
        adminUid,
        reason: "Hidden by admin",
      });
      alert("Hidden from website!");
      await load();
    } catch (e: any) {
      alert(e?.message || "Hide failed");
    } finally {
      setActing("");
    }
  }

  async function onUnhide(it: any) {
    if (!adminUid || !it.gstNumber) return;
    setActing(it.skuId);
    try {
      await unhideGemstoneJewelleryToWebsite({
        skuId: it.skuId,
        adminUid,
        gstNumber: it.gstNumber,
      });
      alert("Restored to website!");
      await load();
    } catch (e: any) {
      alert(e?.message || "Unhide failed");
    } finally {
      setActing("");
    }
  }

  async function onApproveUnlist(it: QueueItem) {
    if (!adminUid || !it.gstNumber) return;
    setActing(it.skuId);
    try {
      await approveUnlistRequestGemstoneJewellery({
        gstNumber: it.gstNumber,
        skuId: it.skuId,
        adminUid,
        reason: "Approved by admin",
      });
      alert("Deletion approved!");
      await load();
    } catch (e: any) {
      alert(e?.message || "Approve failed");
    } finally {
      setActing("");
    }
  }

  async function onRejectUnlist(it: QueueItem) {
    if (!adminUid || !it.gstNumber) return;
    setActing(it.skuId);
    try {
      await rejectUnlistRequestGemstoneJewellery({
        gstNumber: it.gstNumber,
        skuId: it.skuId,
        adminUid,
        reason: "Deletion rejected",
        notifySupplier: true,
      });
      alert("Request rejected!");
      await load();
    } catch (e: any) {
      alert(e?.message || "Reject failed");
    } finally {
      setActing("");
    }
  }

  // Filtered data
  const filtered = (() => {
    let items: any[] = [];
    const s = search.toLowerCase();

    if (tab === "PENDING") {
      items = pending.filter((it) =>
        `${it.skuId} ${it.itemName || ""} ${it.gstNumber || ""}`.toLowerCase().includes(s)
      );
    } else if (tab === "APPROVED") {
      items = global.filter((it) => !it.isHidden && it.status === "APPROVED");
      items = items.filter((it) =>
        `${it.skuId} ${it.itemName || ""} ${it.gstNumber || ""}`.toLowerCase().includes(s)
      );
    } else if (tab === "HIDDEN") {
      items = global.filter((it) => it.isHidden || it.status === "HIDDEN");
      items = items.filter((it) =>
        `${it.skuId} ${it.itemName || ""} ${it.gstNumber || ""}`.toLowerCase().includes(s)
      );
    } else if (tab === "UNLIST_REQUESTS") {
      items = unlistRequests.filter((it) =>
        `${it.skuId} ${it.itemName || ""} ${it.gstNumber || ""}`.toLowerCase().includes(s)
      );
    } else {
      // ALL
      items = [...pending, ...global];
      items = items.filter((it) =>
        `${it.skuId} ${it.itemName || ""} ${it.gstNumber || ""}`.toLowerCase().includes(s)
      );
    }

    return items;
  })();

  // Render
  if (!adminUid) {
    return <div className="p-6">Loading admin session…</div>;
  }

  const counts = {
    PENDING: pending.length,
    APPROVED: global.filter((g) => g.status === "APPROVED" && !g.isHidden).length,
    HIDDEN: global.filter((g) => g.isHidden || g.status === "HIDDEN").length,
    UNLIST_REQUESTS: unlistRequests.length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm underline">
            ← Back to Admin
          </Link>
          <h1 className="text-2xl font-bold mt-1">Gemstone Jewellery</h1>
          <p className="text-xs text-gray-500 mt-1">
            {loading
              ? "Loading…"
              : `Pending: ${counts.PENDING} • Approved: ${counts.APPROVED} • Hidden: ${counts.HIDDEN} • Deletions: ${counts.UNLIST_REQUESTS}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        {(["PENDING", "APPROVED", "HIDDEN", "UNLIST_REQUESTS", "ALL"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 whitespace-nowrap font-medium ${
              tab === t
                ? "border-b-2 border-black"
                : "text-gray-600 hover:text-black border-b-2 border-transparent"
            }`}
          >
            {t === "UNLIST_REQUESTS" ? "Deletions" : t}
            {t !== "ALL" && ` (${counts[t]})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search by SKU, supplier, or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-600">No items</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Title</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Supplier</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.skuId} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{item.skuId}</td>
                  <td className="px-4 py-3 text-sm">
                    {item.itemName || item.stoneName || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.gstNumber || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status || ""} isHidden={item.isHidden} />
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2 flex">
                    {tab === "PENDING" && (
                      <>
                        <button
                          onClick={() => onApprove(item)}
                          disabled={acting === item.skuId}
                          className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 disabled:opacity-50"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => onSendBack(item)}
                          disabled={acting === item.skuId}
                          className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 disabled:opacity-50"
                        >
                          ↩ Send Back
                        </button>
                        <button
                          onClick={() => onReject(item)}
                          disabled={acting === item.skuId}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 disabled:opacity-50"
                        >
                          ✕ Reject
                        </button>
                      </>
                    )}

                    {tab === "APPROVED" && (
                      <>
                        <button
                          onClick={() => onHide(item)}
                          disabled={acting === item.skuId}
                          className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200 disabled:opacity-50"
                        >
                          👁 Hide
                        </button>
                        <button
                          onClick={() => onSendBack(item)}
                          disabled={acting === item.skuId}
                          className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 disabled:opacity-50"
                        >
                          ↩ Send Back
                        </button>
                      </>
                    )}

                    {tab === "HIDDEN" && (
                      <>
                        <button
                          onClick={() => onUnhide(item)}
                          disabled={acting === item.skuId}
                          className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 disabled:opacity-50"
                        >
                          👁 Show
                        </button>
                        <button
                          onClick={() => onSendBack(item)}
                          disabled={acting === item.skuId}
                          className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 disabled:opacity-50"
                        >
                          ↩ Send Back
                        </button>
                      </>
                    )}

                    {tab === "UNLIST_REQUESTS" && (
                      <>
                        <button
                          onClick={() => onApproveUnlist(item)}
                          disabled={acting === item.skuId}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 disabled:opacity-50"
                        >
                          ✓ Approve Delete
                        </button>
                        <button
                          onClick={() => onRejectUnlist(item)}
                          disabled={acting === item.skuId}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 disabled:opacity-50"
                        >
                          ✕ Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold">
              {modalType === "REJECT" ? "Reject Listing" : "Send Back to Supplier"}
            </h2>

            <textarea
              placeholder="Reason (required)…"
              value={modalReason}
              onChange={(e) => setModalReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none h-24"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 px-3 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={modalType === "REJECT" ? submitReject : submitSendBack}
                disabled={!modalReason || acting === modalSkuId}
                className="flex-1 px-3 py-2 bg-black text-white rounded-lg disabled:opacity-50"
              >
                {acting === modalSkuId ? "Processing…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component
function StatusBadge({ status, isHidden }: { status: string; isHidden?: boolean }) {
  const s = String(status || "").toUpperCase();
  const actualStatus = isHidden ? "HIDDEN" : s;

  const badgeConfig = {
    PENDING: { bg: "bg-blue-100", text: "text-blue-800", label: "Pending" },
    APPROVED: { bg: "bg-green-100", text: "text-green-800", label: "Approved" },
    HIDDEN: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Hidden" },
    SUPPLIER_REVIEW: { bg: "bg-orange-100", text: "text-orange-800", label: "Needs Review" },
    UNLIST_REQUEST: { bg: "bg-red-100", text: "text-red-800", label: "Deletion Req." },
    REJECTED: { bg: "bg-red-100", text: "text-red-800", label: "Rejected" },
  }[actualStatus] || { bg: "bg-gray-100", text: "text-gray-800", label: s };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${badgeConfig.bg} ${badgeConfig.text}`}>
      {badgeConfig.label}
    </span>
  );
}
```

---

## Key Features Implemented

✅ **5 Tabs:**
- PENDING: Items awaiting approval
- APPROVED: Live listings
- HIDDEN: Temporarily hidden
- UNLIST_REQUESTS: Deletion requests
- ALL: All items

✅ **Search:** Filter by SKU, supplier, title

✅ **Actions by Status:**
- PENDING: Approve, Send Back, Reject
- APPROVED: Hide, Send Back
- HIDDEN: Unhide, Send Back
- UNLIST_REQUESTS: Approve Delete, Reject

✅ **Modal:** Reason input for Send Back and Reject

✅ **Real-time Counts:** Tab shows item counts

✅ **Status Badges:** Color-coded status display

---

## Testing Admin UI

1. Create test listings
2. Submit some for approval
3. Open admin panel
4. See PENDING tab
5. Click Approve on one
6. See it move to APPROVED tab
7. Hide one listing
8. See it in HIDDEN tab
9. Send one back to supplier
10. As supplier, verify inbox appears

---

## Imports Needed

```typescript
import {
  getPendingGemstoneJewelleryQueue,
  getQueuedGemstoneJewellery,
  approveGemstoneJewellery,
  rejectGemstoneJewellery,
  listAllGemstoneJewelleryGlobal,
  hideGemstoneJewelleryFromWebsite,
  unhideGemstoneJewelleryToWebsite,
  sendGemstoneJewelleryBackToSupplierReview,
  approveUnlistRequestGemstoneJewellery,
  rejectUnlistRequestGemstoneJewellery,
} from "@/lib/firebase/gemstoneJewelleryAdminDb";
import { getGemstoneJewellerySubmission } from "@/lib/firebase/gemstoneJewelleryDb";
import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";
```

---

## Next Steps

1. Implement Phase 1 (Database functions)
2. Implement Phase 2 (Supplier UI)
3. Implement Phase 3 (This admin page)
4. Test complete workflow
5. Phase 4 (Optional): Add email notifications

---

**End of Phase 3 Guide**

Ready to implement or need adjustments?


