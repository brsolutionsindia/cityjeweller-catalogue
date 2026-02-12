# Phase 1: Database Functions Implementation Guide

**Target File:** `src/lib/firebase/gemstoneJewelleryAdminDb.ts`  
**Time:** 4-5 hours  
**Focus:** New functions for listing lifecycle management

---

## Overview of Changes

You'll add 7 new functions to handle:
1. Hide/unhide listings from website
2. Send back to supplier for review
3. Handle unlist requests
4. Track hidden/review states

All existing functions remain unchanged (backward compatible).

---

## Function 1: Hide from Website

**Purpose:** Admin hides an APPROVED listing without deleting it

```typescript
/**
 * Hide approved listing from website
 * - Removes from Global SKU/{skuId}
 * - Removes from indexes
 * - Sets status = HIDDEN in submission
 * - Tracks who hid and when
 * - Listing stays in submission (can be unhidden)
 */
export async function hideGemstoneJewelleryFromWebsite(params: {
  skuId: string;
  adminUid: string;
  reason?: string;
}): Promise<void> {
  if (!params.skuId) throw new Error("Missing skuId");
  if (!params.adminUid) throw new Error("Missing adminUid");

  const now = Date.now();

  // Read the global listing to get gstNumber
  const globalSnap = await get(dbRef(db, `${GLOBAL_NODE}/${params.skuId}`));
  if (!globalSnap.exists()) throw new Error("Listing not found in Global SKU");

  const listing = globalSnap.val() as GemstoneJewellerySubmission;
  const gstNumber = listing.gstNumber;

  const updates: Record<string, any> = {};

  // Remove from website
  updates[`${GLOBAL_NODE}/${params.skuId}`] = null;

  // Remove all indexes
  const tags = uniqTags(listing.tags || []).map(normalizeTag);
  for (const t of tags) updates[`${GLOBAL_TAG_INDEX}/${t}/${params.skuId}`] = null;
  if (listing.type) updates[`${GLOBAL_TYPE_INDEX}/${listing.type}/${params.skuId}`] = null;
  if (listing.nature) updates[`${GLOBAL_NATURE_INDEX}/${listing.nature}/${params.skuId}`] = null;

  // Update submission status + tracking
  updates[`${SUBMISSION_NODE(gstNumber)}/${params.skuId}/status`] = "HIDDEN";
  updates[`${SUBMISSION_NODE(gstNumber)}/${params.skuId}/hiddenAt`] = now;
  updates[`${SUBMISSION_NODE(gstNumber)}/${params.skuId}/hiddenBy`] = params.adminUid;
  if (params.reason) updates[`${SUBMISSION_NODE(gstNumber)}/${params.skuId}/hiddenReason`] = params.reason;
  updates[`${SUBMISSION_NODE(gstNumber)}/${params.skuId}/updatedAt`] = now;
  updates[`${SUBMISSION_NODE(gstNumber)}/${params.skuId}/_updatedAtServer`] = serverTimestamp();

  await update(dbRef(db), updates);
}
```

---

## Function 2: Unhide to Website

**Purpose:** Admin restores a HIDDEN listing back to website

```typescript
/**
 * Unhide listing - restore to website
 * - Restores to Global SKU/{skuId}
 * - Rebuilds all indexes
 * - Sets status = APPROVED
 * - Clears hidden flags
 */
export async function unhideGemstoneJewelleryToWebsite(params: {
  skuId: string;
  adminUid: string;
  gstNumber: string;
}): Promise<void> {
  if (!params.skuId) throw new Error("Missing skuId");
  if (!params.adminUid) throw new Error("Missing adminUid");
  if (!params.gstNumber) throw new Error("Missing gstNumber");

  const now = Date.now();

  // Read submission to restore
  const subSnap = await get(dbRef(db, `${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}`));
  if (!subSnap.exists()) throw new Error("Submission not found");

  const listing = subSnap.val() as GemstoneJewellerySubmission;

  const updates: Record<string, any> = {};

  // Restore to website
  updates[`${GLOBAL_NODE}/${params.skuId}`] = stripUndefined({
    ...listing,
    status: "APPROVED",
    updatedAt: now,
    _unHiddenAtServer: serverTimestamp(),
  });

  // Rebuild indexes
  Object.assign(updates, buildIndexUpdates(listing));

  // Clear hidden flags, set status back to APPROVED
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}/status`] = "APPROVED";
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}/hiddenAt`] = null;
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}/hiddenBy`] = null;
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}/hiddenReason`] = null;
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}/updatedAt`] = now;
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}/_updatedAtServer`] = serverTimestamp();

  await update(dbRef(db), updates);
}
```

---

## Function 3: Send Back for Review

**Purpose:** Admin sends APPROVED listing back to supplier with reason

```typescript
/**
 * Send listing back to supplier for review
 * - Removes from website + indexes
 * - Sets status = SUPPLIER_REVIEW in submission
 * - Creates entry in SupplierInbox/{gstNumber}/GemstoneJewellery/{skuId}
 * - Updates AdminQueue with status = SUPPLIER_REVIEW for tracking
 * - Supplier gets notification they need to re-submit
 */
export async function sendGemstoneJewelleryBackToSupplierReview(params: {
  gstNumber: string;
  skuId: string;
  supplierUid: string;
  adminUid: string;
  reason: string;
}): Promise<void> {
  if (!params.gstNumber) throw new Error("Missing gstNumber");
  if (!params.skuId) throw new Error("Missing skuId");
  if (!params.supplierUid) throw new Error("Missing supplierUid");
  if (!params.adminUid) throw new Error("Missing adminUid");
  if (!params.reason) throw new Error("Missing reason");

  const now = Date.now();

  // Read submission to get full listing for index removal
  const subSnap = await get(dbRef(db, `${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}`));
  if (!subSnap.exists()) throw new Error("Submission not found");

  const listing = subSnap.val() as GemstoneJewellerySubmission;

  const updates: Record<string, any> = {};

  // Remove from website
  updates[`${GLOBAL_NODE}/${params.skuId}`] = null;

  // Remove indexes
  const tags = uniqTags(listing.tags || []).map(normalizeTag);
  for (const t of tags) updates[`${GLOBAL_TAG_INDEX}/${t}/${params.skuId}`] = null;
  if (listing.type) updates[`${GLOBAL_TYPE_INDEX}/${listing.type}/${params.skuId}`] = null;
  if (listing.nature) updates[`${GLOBAL_NATURE_INDEX}/${listing.nature}/${params.skuId}`] = null;

  // Update submission status
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}/status`] = "SUPPLIER_REVIEW";
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}/rejectionReason`] = params.reason;
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}/updatedAt`] = now;
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}/_updatedAtServer`] = serverTimestamp();

  // Create supplier inbox entry (notifications)
  updates[`GST/${params.gstNumber}/SupplierInbox/GemstoneJewellery/${params.skuId}`] = stripUndefined({
    skuId: params.skuId,
    gstNumber: params.gstNumber,
    status: "SUPPLIER_REVIEW",
    reason: params.reason,
    sentBy: params.adminUid,
    createdAt: now,
    readAt: null,
    _createdAtServer: serverTimestamp(),
  });

  // Update admin queue for tracking
  updates[`${ADMIN_QUEUE}/${params.skuId}`] = stripUndefined({
    skuId: params.skuId,
    gstNumber: params.gstNumber,
    supplierUid: params.supplierUid,
    status: "SUPPLIER_REVIEW",
    reason: params.reason,
    sentBy: params.adminUid,
    updatedAt: now,
    _updatedAtServer: serverTimestamp(),
  });

  await update(dbRef(db), updates);
}
```

---

## Function 4: Get Supplier Inbox

**Purpose:** Supplier sees items admin sent back for review

```typescript
/**
 * Get supplier's inbox - items sent back for review by admin
 */
export async function getSupplierInboxGemstoneJewellery(
  gstNumber: string
): Promise<(GemstoneJewellerySubmission & { inboxItem: any })[]> {
  if (!gstNumber) throw new Error("Missing gstNumber");

  const snap = await get(dbRef(db, `GST/${gstNumber}/SupplierInbox/GemstoneJewellery`));
  if (!snap.exists()) return [];

  const inboxObj = snap.val() as Record<string, any>;
  const items: (GemstoneJewellerySubmission & { inboxItem: any })[] = [];

  for (const [skuId, inboxItem] of Object.entries(inboxObj)) {
    try {
      const subSnap = await get(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`));
      if (subSnap.exists()) {
        const listing = subSnap.val() as GemstoneJewellerySubmission;
        items.push({ ...listing, inboxItem });
      }
    } catch {
      // Skip if listing not found
      continue;
    }
  }

  // Sort by createdAt descending (newest first)
  items.sort((a, b) => (b.inboxItem.createdAt || 0) - (a.inboxItem.createdAt || 0));

  return items;
}
```

---

## Function 5: Mark Inbox Item as Read

**Purpose:** Supplier marks inbox notification as read

```typescript
/**
 * Mark inbox item as read (supplier action)
 */
export async function markSupplierInboxItemAsRead(
  gstNumber: string,
  skuId: string
): Promise<void> {
  if (!gstNumber) throw new Error("Missing gstNumber");
  if (!skuId) throw new Error("Missing skuId");

  const now = Date.now();

  await update(
    dbRef(db, `GST/${gstNumber}/SupplierInbox/GemstoneJewellery/${skuId}`),
    {
      readAt: now,
      _readAtServer: serverTimestamp(),
    }
  );
}
```

---

## Function 6: Approve Unlist Request

**Purpose:** Admin approves supplier's request to delete APPROVED listing

```typescript
/**
 * Approve supplier's unlist request
 * - Deletes submission (or archives it)
 * - Removes from website + indexes
 * - Removes from AdminQueue
 * - Removes from Requests/UNLIST_REQUEST
 * - Supplier listing is gone
 */
export async function approveUnlistRequestGemstoneJewellery(params: {
  gstNumber: string;
  skuId: string;
  adminUid: string;
  reason?: string;
}): Promise<void> {
  if (!params.gstNumber) throw new Error("Missing gstNumber");
  if (!params.skuId) throw new Error("Missing skuId");
  if (!params.adminUid) throw new Error("Missing adminUid");

  const now = Date.now();

  // Read submission to get full listing
  const subSnap = await get(dbRef(db, `${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}`));
  if (!subSnap.exists()) throw new Error("Submission not found");

  const listing = subSnap.val() as GemstoneJewellerySubmission;

  const updates: Record<string, any> = {};

  // Hard delete submission
  updates[`${SUBMISSION_NODE(params.gstNumber)}/${params.skuId}`] = null;

  // Remove from website + indexes
  updates[`${GLOBAL_NODE}/${params.skuId}`] = null;

  const tags = uniqTags(listing.tags || []).map(normalizeTag);
  for (const t of tags) updates[`${GLOBAL_TAG_INDEX}/${t}/${params.skuId}`] = null;
  if (listing.type) updates[`${GLOBAL_TYPE_INDEX}/${listing.type}/${params.skuId}`] = null;
  if (listing.nature) updates[`${GLOBAL_NATURE_INDEX}/${listing.nature}/${params.skuId}`] = null;

  // Clean up queue + requests
  updates[`${ADMIN_QUEUE}/${params.skuId}`] = null;
  updates[`GST/${params.gstNumber}/Requests/GemstoneJewellery/${params.skuId}`] = null;

  // Optional: Log to archive
  if (false) { // set to true if you want to keep deleted items in audit log
    updates[`GST/${params.gstNumber}/DeletedListings/GemstoneJewellery/${params.skuId}`] = stripUndefined({
      skuId: params.skuId,
      deletedBy: params.adminUid,
      reason: params.reason || "APPROVED_UNLIST_REQUEST",
      deletedAt: now,
      _deletedAtServer: serverTimestamp(),
    });
  }

  await update(dbRef(db), updates);
}
```

---

## Function 7: Reject Unlist Request

**Purpose:** Admin rejects supplier's deletion request, keeps listing APPROVED

```typescript
/**
 * Reject supplier's unlist request
 * - Removes from Requests
 * - Keeps listing status = APPROVED
 * - Optionally notifies supplier via inbox
 */
export async function rejectUnlistRequestGemstoneJewellery(params: {
  gstNumber: string;
  skuId: string;
  adminUid: string;
  reason?: string;
  notifySupplier?: boolean;
}): Promise<void> {
  if (!params.gstNumber) throw new Error("Missing gstNumber");
  if (!params.skuId) throw new Error("Missing skuId");
  if (!params.adminUid) throw new Error("Missing adminUid");

  const now = Date.now();

  const updates: Record<string, any> = {};

  // Remove unlist request
  updates[`GST/${params.gstNumber}/Requests/GemstoneJewellery/${params.skuId}`] = null;

  // Optionally notify supplier
  if (params.notifySupplier) {
    updates[`GST/${params.gstNumber}/SupplierInbox/GemstoneJewellery/${params.skuId}`] = stripUndefined({
      skuId: params.skuId,
      gstNumber: params.gstNumber,
      status: "UNLIST_REJECTED",
      reason: params.reason || "Your deletion request was rejected. Listing remains approved.",
      sentBy: params.adminUid,
      createdAt: now,
      readAt: null,
      _createdAtServer: serverTimestamp(),
    });
  }

  await update(dbRef(db), updates);
}
```

---

## Function 8: List All Global Listings

**Purpose:** Admin sees all listings currently on website (with filters)

```typescript
/**
 * Get all published (APPROVED or HIDDEN) listings
 * Used by admin to see what's visible on website
 */
export async function listAllGemstoneJewelleryGlobal(
  filter?: "APPROVED" | "HIDDEN"
): Promise<(GemstoneJewellerySubmission & { isHidden: boolean })[]> {
  const snap = await get(dbRef(db, GLOBAL_NODE));
  if (!snap.exists()) return [];

  const obj = snap.val() as Record<string, GemstoneJewellerySubmission>;

  let listings = Object.values(obj).filter(Boolean) as (GemstoneJewellerySubmission & { isHidden: boolean })[];

  // Add isHidden flag based on status
  listings = listings.map(listing => ({
    ...listing,
    isHidden: listing.status === "HIDDEN",
  }));

  // Apply filter
  if (filter === "APPROVED") {
    listings = listings.filter(l => l.status === "APPROVED");
  } else if (filter === "HIDDEN") {
    listings = listings.filter(l => l.status === "HIDDEN");
  }

  // Sort by updatedAt descending
  listings.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return listings;
}
```

---

## Function 9: List Supplier Listings by Status

**Purpose:** Supplier/Admin sees supplier's listings filtered by status

```typescript
/**
 * List supplier's submissions by status
 * Status: DRAFT | PENDING | APPROVED | REJECTED | HIDDEN | SUPPLIER_REVIEW
 */
export async function listGemstoneJewelleryByStatus(
  gstNumber: string,
  supplierUid: string,
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "SUPPLIER_REVIEW"
): Promise<GemstoneJewellerySubmission[]> {
  if (!gstNumber) throw new Error("Missing gstNumber");
  if (!supplierUid) throw new Error("Missing supplierUid");
  if (!status) throw new Error("Missing status");

  // Get all supplier's submissions via index
  const idxSnap = await get(dbRef(db, `GST/${gstNumber}/Indexes/GemstoneJewellerySubmissions/BySupplier/${supplierUid}`));
  if (!idxSnap.exists()) return [];

  const skuIds = Object.keys(idxSnap.val() || {});
  const results: GemstoneJewellerySubmission[] = [];

  for (const skuId of skuIds) {
    const subSnap = await get(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`));
    if (subSnap.exists()) {
      const listing = subSnap.val() as GemstoneJewellerySubmission;
      if (listing.status === status) {
        results.push(listing);
      }
    }
  }

  // Sort by updatedAt descending
  results.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return results;
}
```

---

## Summary of Additions

**Add to `gemstoneJewelleryAdminDb.ts`:**

```typescript
// NEW: Listing visibility management
export async function hideGemstoneJewelleryFromWebsite(params: {...}) { ... }
export async function unhideGemstoneJewelleryToWebsite(params: {...}) { ... }

// NEW: Supplier review workflow
export async function sendGemstoneJewelleryBackToSupplierReview(params: {...}) { ... }
export async function getSupplierInboxGemstoneJewellery(gstNumber: string) { ... }
export async function markSupplierInboxItemAsRead(gstNumber: string, skuId: string) { ... }

// NEW: Unlist request handling
export async function approveUnlistRequestGemstoneJewellery(params: {...}) { ... }
export async function rejectUnlistRequestGemstoneJewellery(params: {...}) { ... }

// NEW: Listing queries
export async function listAllGemstoneJewelleryGlobal(filter?: ...) { ... }
export async function listGemstoneJewelleryByStatus(gstNumber, uid, status) { ... }
```

---

## Testing These Functions

```typescript
// Test: Hide listing
await hideGemstoneJewelleryFromWebsite({
  skuId: "8165GJ001001",
  adminUid: "admin123",
  reason: "Out of stock",
});

// Test: Unhide listing
await unhideGemstoneJewelleryToWebsite({
  skuId: "8165GJ001001",
  adminUid: "admin123",
  gstNumber: "18AABCT1234H1Z0",
});

// Test: Send back
await sendGemstoneJewelleryBackToSupplierReview({
  gstNumber: "18AABCT1234H1Z0",
  skuId: "8165GJ001001",
  supplierUid: "supplier123",
  adminUid: "admin123",
  reason: "Please provide clearer product images",
});

// Test: Get inbox
const inbox = await getSupplierInboxGemstoneJewellery("18AABCT1234H1Z0");
console.log(inbox); // Items sent back for review
```

---

## Next Steps

1. Add these 9 functions to `gemstoneJewelleryAdminDb.ts`
2. Update types if needed (add HIDDEN, SUPPLIER_REVIEW to status enum)
3. Move to Phase 2: Supplier UI changes
4. Then Phase 3: Admin UI changes

Ready to proceed with UI?


