# Phase 1 Implementation: COMPLETE ✅

**Date Completed:** February 11, 2026  
**Status:** Ready for Review  

---

## What Was Done

### 1. ✅ Updated Types (`src/lib/gemstoneJewellery/types.ts`)

**Added new status values to `GJStatus`:**
```typescript
// OLD:
export type GJStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

// NEW:
export type GJStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "SUPPLIER_REVIEW";
```

**Added new tracking fields to `GemstoneJewellerySubmission`:**
```typescript
// NEW: tracking when hidden from website
hiddenAt?: number;        // timestamp when hidden
hiddenBy?: string;        // admin uid who hid it
hiddenReason?: string;    // why it was hidden
```

### 2. ✅ Added Database Functions (`src/lib/firebase/gemstoneJewelleryAdminDb.ts`)

**9 New Functions Added:**

#### A. `hideGemstoneJewelleryFromWebsite()`
- **Purpose:** Admin hides approved listing
- **Input:** { skuId, adminUid, reason? }
- **Actions:**
  - Removes from `Global SKU/GemstoneJewellery/{skuId}`
  - Removes from all indexes
  - Sets status = "HIDDEN"
  - Tracks hiddenAt, hiddenBy, hiddenReason

#### B. `unhideGemstoneJewelleryToWebsite()`
- **Purpose:** Restore hidden listing
- **Input:** { skuId, adminUid, gstNumber }
- **Actions:**
  - Restores to `Global SKU/GemstoneJewellery/{skuId}`
  - Rebuilds all indexes
  - Sets status = "APPROVED"
  - Clears hidden flags

#### C. `sendGemstoneJewelleryBackToSupplierReview()`
- **Purpose:** Admin sends back to supplier
- **Input:** { gstNumber, skuId, supplierUid, adminUid, reason }
- **Actions:**
  - Removes from website + indexes
  - Sets status = "SUPPLIER_REVIEW"
  - Creates inbox entry in `GST/{gst}/SupplierInbox/GemstoneJewellery/{skuId}`
  - Updates AdminQueue with status = "SUPPLIER_REVIEW"

#### D. `getSupplierInboxGemstoneJewellery()`
- **Purpose:** Supplier gets inbox items
- **Input:** gstNumber
- **Returns:** Array of items admin sent back with inbox metadata
- **Sorted:** By createdAt descending (newest first)

#### E. `markSupplierInboxItemAsRead()`
- **Purpose:** Supplier marks notification as read
- **Input:** gstNumber, skuId
- **Actions:** Sets readAt timestamp

#### F. `approveUnlistRequestGemstoneJewellery()`
- **Purpose:** Admin approves supplier deletion request
- **Input:** { gstNumber, skuId, adminUid, reason? }
- **Actions:**
  - Hard deletes submission
  - Removes from website + indexes
  - Removes from AdminQueue
  - Removes from Requests

#### G. `rejectUnlistRequestGemstoneJewellery()`
- **Purpose:** Admin rejects deletion request
- **Input:** { gstNumber, skuId, adminUid, reason?, notifySupplier? }
- **Actions:**
  - Removes from Requests
  - Optionally creates inbox notification for supplier

#### H. `listAllGemstoneJewelleryGlobal()`
- **Purpose:** Admin lists all published listings
- **Input:** filter? ("APPROVED" | "HIDDEN")
- **Returns:** Array of global listings with isHidden flag
- **Sorted:** By updatedAt descending

#### I. `listGemstoneJewelleryByStatus()`
- **Purpose:** List supplier's submissions by status
- **Input:** gstNumber, supplierUid, status
- **Status Options:** "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "SUPPLIER_REVIEW"
- **Returns:** Array of submissions with that status
- **Sorted:** By updatedAt descending

### 3. ✅ Added Helper Function

**`buildIndexRemovals()`**
- Removes listings from all indexes when unpublishing
- Used by hide, send back, and delete operations

---

## Database Structure Changes

### New Collection: SupplierInbox
```
GST/{gstNumber}/SupplierInbox/GemstoneJewellery/{skuId}
├── skuId
├── gstNumber
├── status: "SUPPLIER_REVIEW" | "UNLIST_REJECTED"
├── reason
├── sentBy (admin uid)
├── createdAt
├── readAt (optional)
└── _createdAtServer
```

### Updated AdminQueue
Now tracks 3 statuses instead of 1:
- `PENDING` - Awaiting approval
- `SUPPLIER_REVIEW` - Sent back to supplier
- `UNLIST_REQUEST` - Supplier requested deletion

### Updated Submissions Fields
All optional, backward compatible:
- `hiddenAt` - When hidden
- `hiddenBy` - Admin who hid
- `hiddenReason` - Why hidden

---

## Listing State Transitions Enabled

```
DRAFT
  ↓ [submit]
PENDING → [approve] → APPROVED
  ↓                      ↓
[reject]        [admin hide] → HIDDEN
  ↓                   ↓        ↓
REJECTED    [admin send back] [admin unhide]
                  ↓               ↓
            SUPPLIER_REVIEW ← [supplier resubmit]
                  ↓ (loops back to PENDING)

APPROVED/HIDDEN
  ↓ [supplier delete]
UNLIST_REQUEST
  ↓ [admin approve/reject]
DELETED or APPROVED
```

---

## Ready for Review

✅ **All 9 functions implemented**  
✅ **Types updated (2 new status values)**  
✅ **New tracking fields added**  
✅ **Helper functions included**  
✅ **Fully backward compatible**  
✅ **Complete error handling**  

---

## Next Step: Phase 2

Ready to review Phase 1? Once approved, we'll proceed with:
- **Phase 2:** Supplier UI changes (landing page, edit page, new inbox page)
- **Phase 3:** Admin UI (complete dashboard with all tabs and actions)

Let me know if:
1. ✅ Phase 1 looks good
2. ❌ Any changes needed
3. ⚠️ Any clarifications

Then we'll move to Phase 2!


