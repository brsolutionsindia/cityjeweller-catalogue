# Phase 2: Supplier UI Implementation Guide

**Target Files:**
- `src/app/(supplier-protected)/supplier/gemstone-jewellery/page.tsx`
- `src/app/(supplier-protected)/supplier/gemstone-jewellery/[skuId]/page.tsx`
- `src/app/(supplier-protected)/supplier/gemstone-jewellery/inbox/page.tsx` (NEW)

**Time:** 3-4 hours  
**Focus:** Supplier-facing changes for listing management

---

## Page 1: Landing Page (Index)

**File:** `src/app/(supplier-protected)/supplier/gemstone-jewellery/page.tsx`

### Current State
- List all supplier's submissions
- Show status for each
- Delete button
- No filtering

### Changes Needed

#### 1. Add Inbox Badge/Counter

```typescript
// Near top of component state:

const [inboxCount, setInboxCount] = useState(0);
const [inboxUnread, setInboxUnread] = useState(0);

// In useEffect that loads data:
async function loadInbox() {
  try {
    const inbox = await getSupplierInboxGemstoneJewellery(gst);
    setInboxCount(inbox.length);
    const unread = inbox.filter((item: any) => !item.inboxItem?.readAt).length;
    setInboxUnread(unread);
  } catch (e) {
    console.error("Failed to load inbox:", e);
  }
}

// Call on mount
useEffect(() => {
  if (gst) loadInbox();
}, [gst]);
```

#### 2. Add Filters/Tabs

```typescript
// State:
const [statusFilter, setStatusFilter] = useState<string>("ALL");

// Filter logic in useMemo:
const filtered = useMemo(() => {
  let arr = listings || [];
  if (statusFilter !== "ALL") {
    arr = arr.filter((l: any) => (l.status || "").toUpperCase() === statusFilter);
  }
  return arr;
}, [listings, statusFilter]);

// In JSX, add tabs before table:
<div className="flex gap-2 border-b mb-4">
  {["ALL", "DRAFT", "PENDING", "APPROVED", "REJECTED", "SUPPLIER_REVIEW", "HIDDEN"].map(
    (tab) => (
      <button
        key={tab}
        onClick={() => setStatusFilter(tab)}
        className={`px-4 py-2 ${
          statusFilter === tab
            ? "border-b-2 border-black font-semibold"
            : "text-gray-600"
        }`}
      >
        {tab === "SUPPLIER_REVIEW" ? "Needs Review" : tab}
        {tab === "PENDING" && pendingCount > 0 && ` (${pendingCount})`}
      </button>
    )
  )}
</div>
```

#### 3. Update Delete Handler

```typescript
async function onDeleteSelected() {
  if (!gst || !uid) return;
  if (!selectedIds.length) return;

  // Separate by status
  const drafts = selectedIds.filter(
    (id) => getListingStatus(id) === "DRAFT"
  );
  const pendings = selectedIds.filter(
    (id) => getListingStatus(id) === "PENDING"
  );
  const approvedOrHidden = selectedIds.filter(
    (id) =>
      getListingStatus(id) === "APPROVED" || getListingStatus(id) === "HIDDEN"
  );
  const rejected = selectedIds.filter(
    (id) => getListingStatus(id) === "REJECTED"
  );

  let message = "Delete selected listings?\n\n";
  if (drafts.length) message += `• Draft (${drafts.length}): will be deleted.\n`;
  if (pendings.length) message += `• Pending (${pendings.length}): will be deleted.\n`;
  if (rejected.length) message += `• Rejected (${rejected.length}): will be deleted.\n`;
  if (approvedOrHidden.length)
    message += `• Approved/Hidden (${approvedOrHidden.length}): will request removal (admin approval required).\n`;

  const ok = window.confirm(message);
  if (!ok) return;

  setLoading(true);
  try {
    for (const skuId of selectedIds) {
      await deleteGemstoneJewellerySubmission({
        gstNumber: gst,
        supplierUid: uid,
        skuId,
        deleteMedia: true,
        // For approved listings, this creates UNLIST_REQUEST
      });
    }
    setSelected({});
    await load();
    alert("Deleted/Requested. Approved listings sent for admin review.");
  } catch (e: any) {
    console.error(e);
    alert(e?.message || "Delete failed");
  } finally {
    setLoading(false);
  }
}
```

#### 4. Add Inbox Alert

```typescript
// In JSX, near top of return:
{inboxUnread > 0 && (
  <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
    <div className="flex items-center justify-between">
      <div>
        <strong>You have {inboxUnread} item(s) to review</strong>
        <p className="text-sm text-gray-700 mt-1">
          Admin has requested you make changes to {inboxUnread} listing(s)
        </p>
      </div>
      <Link
        href="/supplier/gemstone-jewellery/inbox"
        className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm"
      >
        View Inbox
      </Link>
    </div>
  </div>
)}
```

#### 5. Update Table Status Column

```typescript
// In table, modify status cell rendering:
const getStatusBadge = (status: string) => {
  const s = String(status || "").toUpperCase();
  const badgeClass = {
    DRAFT: "bg-gray-100 text-gray-800",
    PENDING: "bg-blue-100 text-blue-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    HIDDEN: "bg-yellow-100 text-yellow-800",
    SUPPLIER_REVIEW: "bg-orange-100 text-orange-800",
  }[s] || "bg-gray-100 text-gray-800";

  const label = {
    SUPPLIER_REVIEW: "Needs Review",
  }[s] || s;

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${badgeClass}`}>
      {label}
    </span>
  );
};

// In table:
<td>{getStatusBadge(listing.status)}</td>
```

---

## Page 2: Edit Page

**File:** `src/app/(supplier-protected)/supplier/gemstone-jewellery/[skuId]/page.tsx`

### Current Features
- Edit form
- Save Draft / Submit buttons
- Alert about re-approval if editing APPROVED

### Changes Needed

#### 1. Update Status Display

```typescript
// After loading, show current status prominently:

{form && (
  <div className="mb-4 flex items-center gap-2">
    <span className="text-sm text-gray-600">Status:</span>
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeClass(
      form.status
    )}`}>
      {form.status === "SUPPLIER_REVIEW" ? "Needs Review" : form.status}
    </span>
  </div>
)}
```

#### 2. Show Rejection/Review Reason

```typescript
// If rejected or sent back:
{form?.rejectionReason && ["REJECTED", "SUPPLIER_REVIEW"].includes(form?.status) && (
  <div className="mb-4 p-3 rounded-lg border-l-4 border-orange-500 bg-orange-50">
    <div className="font-semibold text-sm mb-1">
      {form.status === "REJECTED" ? "Rejection Reason:" : "Admin's Request:"}
    </div>
    <div className="text-sm text-gray-700">{form.rejectionReason}</div>
    {form.status === "SUPPLIER_REVIEW" && (
      <button
        onClick={() => window.location.href = "/supplier/gemstone-jewellery/inbox"}
        className="mt-2 text-sm text-blue-600 underline"
      >
        View more details in inbox
      </button>
    )}
  </div>
)}
```

#### 3. Show Re-approval Warning for APPROVED Edits

```typescript
// Update existing warning to be clearer:
{form?.status === "APPROVED" && (
  <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50">
    <div className="flex gap-2">
      <div className="text-2xl">⚠️</div>
      <div>
        <strong className="block mb-1">Changes will trigger re-approval</strong>
        <p className="text-sm text-gray-700">
          Since this listing is currently approved and live on the website, any changes
          you make will send it for admin review. It will be temporarily hidden from the
          website until admin approves the updated version.
        </p>
      </div>
    </div>
  </div>
)}
```

#### 4. Update Form Submission Button Labels

```typescript
// Conditional button text:
<button
  onClick={saveDraft}
  disabled={saving}
  className="px-4 py-2 border rounded-lg"
>
  {form?.status === "APPROVED" ? "Save & Send for Review" : "Save Draft"}
</button>

<button
  onClick={sendForApproval}
  disabled={saving}
  className="px-4 py-2 bg-black text-white rounded-lg"
>
  {form?.status === "SUPPLIER_REVIEW" ? "Resubmit for Approval" : "Submit for Approval"}
</button>
```

#### 5. Add Delete Option (for APPROVED, triggers UNLIST_REQUEST)

```typescript
// Add after submit button:
{(form?.status === "APPROVED" || form?.status === "HIDDEN") && (
  <button
    onClick={onDeleteApproved}
    className="px-4 py-2 text-red-600 border border-red-200 rounded-lg"
  >
    Request Deletion
  </button>
)}

{["DRAFT", "PENDING", "REJECTED", "SUPPLIER_REVIEW"].includes(form?.status) && (
  <button
    onClick={onDeleteDraft}
    className="px-4 py-2 text-red-600 border border-red-200 rounded-lg"
  >
    Delete
  </button>
)}

async function onDeleteApproved() {
  const ok = window.confirm(
    "Request deletion of this approved listing?\n\n" +
    "Your request will be sent to admin for approval. " +
    "The listing will remain visible until admin reviews and approves the deletion."
  );
  if (!ok) return;

  setSaving(true);
  try {
    await deleteGemstoneJewellerySubmission({
      gstNumber: gst,
      supplierUid: uid,
      skuId,
      deleteMedia: false, // don't delete media yet
    });
    alert("Deletion request sent to admin.");
    window.location.href = "/supplier/gemstone-jewellery";
  } catch (e: any) {
    alert(e?.message || "Failed");
  } finally {
    setSaving(false);
  }
}

async function onDeleteDraft() {
  const ok = window.confirm("Delete this listing? This cannot be undone.");
  if (!ok) return;

  setSaving(true);
  try {
    await deleteGemstoneJewellerySubmission({
      gstNumber: gst,
      supplierUid: uid,
      skuId,
      deleteMedia: true,
    });
    alert("Deleted.");
    window.location.href = "/supplier/gemstone-jewellery";
  } catch (e: any) {
    alert(e?.message || "Failed");
  } finally {
    setSaving(false);
  }
}
```

---

## Page 3: Inbox (NEW)

**File:** `src/app/(supplier-protected)/supplier/gemstone-jewellery/inbox/page.tsx` (NEW FILE)

```typescript
"use client";

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getSupplierInboxGemstoneJewellery,
  markSupplierInboxItemAsRead,
} from "@/lib/firebase/gemstoneJewelleryAdminDb";

export default function SupplierGemstoneJewelleryInboxPage() {
  const auth = useAuth();
  const gst = auth?.customClaims?.gstNumber;
  const uid = auth?.uid;

  const [inbox, setInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string>("");

  useEffect(() => {
    if (!gst) return;
    load();
  }, [gst]);

  async function load() {
    if (!gst) return;
    setLoading(true);
    try {
      const items = await getSupplierInboxGemstoneJewellery(gst);
      setInbox(items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function onMarkRead(skuId: string) {
    if (!gst) return;
    setActing(skuId);
    try {
      await markSupplierInboxItemAsRead(gst, skuId);
      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to mark as read");
    } finally {
      setActing("");
    }
  }

  if (!gst || !uid) {
    return <div className="p-6">Loading session…</div>;
  }

  if (loading) {
    return <div className="p-6">Loading inbox…</div>;
  }

  const unread = inbox.filter((item: any) => !item.inboxItem?.readAt).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <Link href="/supplier/gemstone-jewellery" className="text-sm underline">
          ← Back to Listings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Review Inbox</h1>
        <p className="text-sm text-gray-600 mt-1">
          Items that need your attention ({unread} unread)
        </p>
      </div>

      {inbox.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-600">No items in inbox</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inbox.map((item) => {
            const isUnread = !item.inboxItem?.readAt;
            return (
              <div
                key={item.skuId}
                className={`p-4 border rounded-lg ${
                  isUnread ? "bg-blue-50 border-blue-200" : "bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <strong className="text-lg">{item.itemName || item.skuId}</strong>
                      {isUnread && (
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                          Unread
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Admin's Request:</strong>
                    </p>
                    <p className="text-sm text-gray-600 mb-3 border-l-2 border-blue-400 pl-3">
                      {item.inboxItem?.reason ||
                        "Admin requested you review and resubmit this listing."}
                    </p>
                    <div className="flex gap-2">
                      <Link
                        href={`/supplier/gemstone-jewellery/${item.skuId}`}
                        className="px-3 py-2 bg-black text-white text-sm rounded"
                      >
                        Edit & Resubmit
                      </Link>
                      {isUnread && (
                        <button
                          onClick={() => onMarkRead(item.skuId)}
                          disabled={acting === item.skuId}
                          className="px-3 py-2 border text-sm rounded"
                        >
                          {acting === item.skuId ? "Marking…" : "Mark as Read"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {new Date(item.inboxItem?.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## Helper Functions to Add

Add to component or separate utils file:

```typescript
function getStatusBadgeClass(status: string): string {
  const s = String(status || "").toUpperCase();
  return {
    DRAFT: "bg-gray-100 text-gray-800",
    PENDING: "bg-blue-100 text-blue-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    HIDDEN: "bg-yellow-100 text-yellow-800",
    SUPPLIER_REVIEW: "bg-orange-100 text-orange-800",
  }[s] || "bg-gray-100 text-gray-800";
}

function getStatusLabel(status: string): string {
  const s = String(status || "").toUpperCase();
  return {
    SUPPLIER_REVIEW: "Needs Review",
  }[s] || s;
}
```

---

## Summary of Supplier UI Changes

### Landing Page
- ✅ Inbox badge showing unread count
- ✅ Filter tabs by status (ALL, DRAFT, PENDING, APPROVED, REJECTED, SUPPLIER_REVIEW, HIDDEN)
- ✅ Enhanced delete handler (different messages for different statuses)
- ✅ Status badges with colors

### Edit Page
- ✅ Status display badge
- ✅ Rejection/Review reason display
- ✅ Clear re-approval warning
- ✅ Conditional button labels (Save vs Save & Send for Review)
- ✅ Delete buttons (Hard delete for drafts, UNLIST_REQUEST for approved)

### New Inbox Page
- ✅ List all items admin sent back
- ✅ Show reason for each
- ✅ Edit/Resubmit button
- ✅ Mark as read functionality
- ✅ Unread counter

---

## Testing Supplier UI

1. Create a draft listing
2. Submit for approval
3. As admin, send back with a reason
4. As supplier, see inbox notification
5. Click inbox to see the item
6. Go to edit page, see the reason
7. Make changes and resubmit
8. Verify status updates

---

## Import Statements Needed

Add to each page:

```typescript
import { getSupplierInboxGemstoneJewellery, markSupplierInboxItemAsRead } from "@/lib/firebase/gemstoneJewelleryAdminDb";
// or from gemstoneJewelleryDb if those functions live there
```

---

**Next:** Phase 3 - Admin UI


