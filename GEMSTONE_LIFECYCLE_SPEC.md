# Gemstone-Jewellery Listing Lifecycle Management: Enhancement Specification

**Date:** February 11, 2026  
**Focus:** UI + Firebase DB/Storage changes for listing state transitions  
**Scope:** Supplier, Admin, Website User interactions  
**Status:** Design & Implementation Ready

---

## 📋 Current State vs Target State

### Current Implementation (Partial)
✅ Supplier can:
- Create draft listings (DRAFT)
- Submit for approval (PENDING)
- Save changes to drafts
- Delete DRAFT/PENDING/REJECTED (hard delete)
- Delete APPROVED listings → UNLIST request only (not implemented fully)

⚠️ Admin can:
- Approve pending listings (APPROVED)
- Reject with reason (REJECTED)
- No hide/unhide functionality
- No "send back to supplier review" feature

❌ Website users:
- See approved listings only
- No status visibility

### Target Implementation
✅ **SUPPLIER** actions:
- Create & edit drafts (DRAFT)
- Submit for approval (→ PENDING)
- Edit APPROVED → triggers re-approval flow (→ PENDING + remove from website)
- Delete DRAFT/PENDING/REJECTED (hard delete)
- Delete APPROVED → UNLIST request (approval required from admin before removal)
- View inbox (when admin sends back for review)

✅ **ADMIN** actions:
- Approve listings (DRAFT/PENDING → APPROVED, publish to website)
- Reject with reason (→ REJECTED, visible to supplier)
- **Hide approved listing** (APPROVED → HIDDEN, remove from website, stay in submission)
- **Unhide listing** (HIDDEN → APPROVED, restore to website)
- **Send back for review** (APPROVED → SUPPLIER_REVIEW, notify supplier via inbox)
- Accept UNLIST requests (APPROVED + UNLIST_REQUEST → deleted)
- View all listings (Pending, Approved, Hidden, Rejected)

✅ **WEBSITE USERS**:
- See APPROVED listings only
- Cannot see DRAFT, PENDING, REJECTED, HIDDEN, SUPPLIER_REVIEW

---

## 🔄 State Machine & Transitions

```
                    ┌─────────┐
                    │  DRAFT  │
                    └────┬────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    [save]         [submit]         [delete]
         │               │               │
         └──────┬────────┘               │
                │                       │
         ┌──────▼───────┐          [hard delete]
         │   PENDING    │               │
         │  (in queue)  │               │
         └──────┬───────┘               │
                │                       │
         ┌──────┴────────┬─────────┐    │
         │               │         │    │
    [approve]       [reject]  [send back to supplier]
         │               │         │    │
         │          ┌────▼──┐      │    │
         │          │REJECTED│     │    │
         │          └────────┘     │    │
         │                         │    │
    ┌────▼─────────┐          ┌────▼──────────────┐
    │   APPROVED   │          │ SUPPLIER_REVIEW   │
    │ (published)  │          │ (notified, inbox) │
    └────┬─────────┘          └───────┬───────────┘
         │                            │
    ┌────┴────────────┬───────────┐   │
    │                 │           │   │
[edit supplier]  [admin hide] [delete supplier] [supplier resubmit]
    │                 │           │   │
    └────┐            │      ┌────▼──┐│
         │       ┌─────▼──────┐        │
         │       │   HIDDEN   │        │
         │       │(unpublished)│       │
         │       └────────────┘        │
         │                             │
         └──────┬──────────────────────┘
                │
         ┌──────▼──────────┐
         │   PENDING       │ (re-approval queue)
         │  (in queue)     │
         └─────────────────┘
                 │
            [cycle repeats]
```

### State Definitions

| State | Meaning | Visible on Website | In Admin Queue | In Supplier Inbox | Notes |
|-------|---------|-------------------|-----------------|-------------------|-------|
| **DRAFT** | Incomplete, not submitted | ❌ | ❌ | ❌ | Supplier only |
| **PENDING** | Submitted, awaiting admin review | ❌ | ✅ PENDING | ❌ | In admin queue |
| **APPROVED** | Admin approved, published | ✅ | ❌ | ❌ | Live on website |
| **REJECTED** | Admin rejected with reason | ❌ | ❌ | ❌ | Supplier sees reason |
| **HIDDEN** | Admin hidden, not visible but approved | ❌ | ❌ | ❌ | Can be unhidden |
| **SUPPLIER_REVIEW** | Admin sent back, awaiting resubmit | ❌ | ✅ SUPPLIER_REVIEW | ✅ | Supplier notified |
| **UNLIST_REQUESTED** | Supplier requested deletion of APPROVED | ❌ | ✅ UNLIST_REQUEST | ❌ | Awaiting admin approval |

---

## 🗄️ Firebase Database Structure

### New Collections/Nodes

#### 1. SupplierInbox (NEW)
```
GST/{gstNumber}/SupplierInbox/GemstoneJewellery/{skuId}
├── skuId
├── gstNumber
├── reason (why sent back)
├── message (optional detailed message)
├── status: "SUPPLIER_REVIEW"
├── createdAt
├── readAt (optional, supplier marks as read)
└── _createdAtServer
```

#### 2. HiddenListings (NEW, optional - for admin tracking)
```
GST/{gstNumber}/HiddenListings/GemstoneJewellery/{skuId}
├── skuId
├── hiddenBy (admin uid)
├── reason (optional)
├── hiddenAt
├── _hiddenAtServer
└── unHideDetails (when unhidden: by, when)
```

#### 3. Admin Queue - Extended
```
AdminQueue/GemstoneJewellery/{skuId}
├── skuId
├── gstNumber
├── supplierUid
├── status: "PENDING" | "SUPPLIER_REVIEW" | "UNLIST_REQUEST"
├── reason
├── thumbUrl
├── updatedAt
├── queuedAt
└── _queuedAtServer
```

#### 4. Submissions - Extended Fields
```
GST/{gstNumber}/Submissions/GemstoneJewellery/{skuId}
├── ...existing fields...
├── status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "SUPPLIER_REVIEW"
├── rejectionReason (when REJECTED or SUPPLIER_REVIEW)
├── hiddenAt (timestamp when hidden)
├── hiddenBy (admin uid when hidden)
├── hiddenReason (why hidden)
├── approvedAt
├── approvedBy
├── rejectedAt
├── rejectedBy
└── _statusHistory[] (audit log)
```

---

## 🔧 Required Database Functions

### Supplier-facing Functions

#### 1. `upsertGemstoneJewellerySubmission()` - ALREADY EXISTS, enhance
```typescript
// Already exists, but enhance trigger:
export async function upsertGemstoneJewellerySubmission(
  input: GemstoneJewellerySubmission,
  opts?: { 
    triggerReapprovalIfApproved?: boolean; // if editing APPROVED → PENDING
  }
)
// Current: ✅ Working
// Status: No changes needed
```

#### 2. `requestUnlistGemstoneJewellery()` - ALREADY EXISTS
```typescript
// Supplier requests deletion of APPROVED listing
// Current: ✅ Working (creates UNLIST_REQUEST in Requests node)
// Status: Keep as is, enhance admin approval handling
```

#### 3. `getSupplierInboxGemstoneJewellery()` - NEW
```typescript
export async function getSupplierInboxGemstoneJewellery(
  gstNumber: string
): Promise<SupplierInboxItem[]>
// Get all inbox items (admin send-backs)
```

#### 4. `markSupplierInboxItemAsRead()` - NEW
```typescript
export async function markSupplierInboxItemAsRead(
  gstNumber: string,
  skuId: string
): Promise<void>
// Supplier marks inbox notification as read
```

### Admin-facing Functions

#### 5. `hideGemstoneJewelleryFromWebsite()` - NEW
```typescript
export async function hideGemstoneJewelleryFromWebsite(params: {
  skuId: string;
  adminUid: string;
  reason?: string;
}): Promise<void>

// Actions:
// - Remove from Global SKU/{skuId}
// - Remove from all indexes (ByTag, ByType, ByNature)
// - Set submission status = "HIDDEN"
// - Store hiddenBy, hiddenAt, reason
// - Keep submission intact (not deleted)
```

#### 6. `unhideGemstoneJewelleryToWebsite()` - NEW
```typescript
export async function unhideGemstoneJewelleryToWebsite(params: {
  skuId: string;
  adminUid: string;
  gstNumber: string;
}): Promise<void>

// Actions:
// - Restore to Global SKU/{skuId}
// - Rebuild all indexes
// - Set submission status = "APPROVED"
// - Clear hidden fields
```

#### 7. `sendGemstoneJewelleryBackToSupplierReview()` - NEW
```typescript
export async function sendGemstoneJewelleryBackToSupplierReview(params: {
  gstNumber: string;
  skuId: string;
  supplierUid: string;
  adminUid: string;
  reason: string;
}): Promise<void>

// Actions:
// - Remove from Global SKU/{skuId}
// - Remove from indexes
// - Set submission status = "SUPPLIER_REVIEW"
// - Create SupplierInbox entry
// - Update AdminQueue with status = "SUPPLIER_REVIEW"
// - Notify supplier somehow (later: email/push)
```

#### 8. `approveUnlistRequest()` - NEW
```typescript
export async function approveUnlistRequest(params: {
  gstNumber: string;
  skuId: string;
  adminUid: string;
  reason?: string;
}): Promise<void>

// Actions:
// - Hard delete submission (or soft delete with archive flag)
// - Remove from Global SKU
// - Remove from indexes
// - Remove from AdminQueue
// - Remove from Requests/UNLIST_REQUEST
// - Create audit log
```

#### 9. `rejectUnlistRequest()` - NEW
```typescript
export async function rejectUnlistRequest(params: {
  gstNumber: string;
  skuId: string;
  adminUid: string;
  reason?: string;
}): Promise<void>

// Actions:
// - Remove from Requests/UNLIST_REQUEST
// - Optionally notify supplier via inbox
// - Keep submission status = "APPROVED"
```

#### 10. `listAllGemstoneJewelleryGlobal()` - NEW
```typescript
export async function listAllGemstoneJewelleryGlobal(
  filterStatus?: "APPROVED" | "HIDDEN"
): Promise<GemstoneJewellerySubmission[]>

// Admin view of all published/hidden listings
```

#### 11. `listGemstoneJewelleryByStatus()` - NEW
```typescript
export async function listGemstoneJewelleryByStatus(
  gstNumber: string,
  supplierUid: string,
  status: "DRAFT" | "REJECTED" | "SUPPLIER_REVIEW"
): Promise<GemstoneJewellerySubmission[]>

// Supplier view of their listings by status
```

---

## 🎨 UI Changes Required

### Supplier Portal

#### Page: `/supplier/gemstone-jewellery` (Landing)
**Current:**
- Table with all listings
- Status column
- Delete button

**Changes:**
- Add "Inbox" badge/counter (unread SUPPLIER_REVIEW items)
- Add filters: "All | Drafts | Approved | Sent Back | Rejected"
- Show alert if items are awaiting re-approval
- Bulk action: "Delete Selected"

**New Section:**
- "Inbox" tab showing items admin sent back with reasons
- Mark as read button
- Link to re-edit and resubmit

#### Page: `/supplier/gemstone-jewellery/[skuId]` (Edit)
**Current:**
- Form to edit
- Save Draft / Submit buttons
- Alert if APPROVED: "Changes will trigger re-approval"

**Changes:**
- Show current status badge (DRAFT | PENDING | APPROVED | REJECTED | HIDDEN)
- If REJECTED: show rejection reason prominently
- If SUPPLIER_REVIEW: show reason from admin, clear action button
- If APPROVED: show "Editing will send for re-approval" warning
- Add "Delete Listing" button with confirmation

**New Actions:**
- If DRAFT/PENDING/REJECTED: "Delete" → hard delete
- If APPROVED: "Delete" → creates UNLIST_REQUEST (asks admin to approve deletion)
- If SUPPLIER_REVIEW: "Resubmit for Approval" → re-open for editing, then submit

#### New Page: `/supplier/gemstone-jewellery/inbox` (Inbox)
- List all SUPPLIER_REVIEW items
- Show reason from admin
- "View Listing" button → takes to edit page
- "Mark as Read" button
- "Delete Message" button

### Admin Portal

#### New Tab: `/admin/gemstone-jewellery` (Admin Panel)
**Tabs:**
1. **PENDING** - Items awaiting approval
2. **APPROVED** - Items visible on website
3. **HIDDEN** - Items temporarily hidden
4. **UNLIST_REQUESTS** - Supplier deletion requests awaiting approval

**Each Tab:**
- Search by SKU/Name/Supplier
- Table with columns: SKU | Supplier | Title | Status | Actions
- Sort by date (newest first)

**PENDING Tab Actions:**
- ✅ Approve
- ❌ Reject (with reason)
- ↩️ Send Back (to supplier for review with reason)

**APPROVED Tab Actions:**
- 👁️ View on Website
- 🙈 Hide (with optional reason)
- ↩️ Send Back (to supplier for review)
- Edit → Edit & Re-approve

**HIDDEN Tab Actions:**
- 👁️ Show (restore to website)
- ❌ Delete
- ↩️ Send Back

**UNLIST_REQUESTS Tab Actions:**
- ✅ Approve Deletion (hard delete)
- ❌ Reject (keep approved)

---

## 📊 Database Operations Details

### Example: Supplier Edits APPROVED Listing

```
BEFORE:
GST/{gst}/Submissions/GemstoneJewellery/{skuId}
├── status: "APPROVED"
├── ...data...

Global SKU/GemstoneJewellery/{skuId}
├── ...same data (published)...

AdminQueue/GemstoneJewellery/{skuId}
├── NOT PRESENT

AFTER upsertGemstoneJewellerySubmission(..., { triggerReapprovalIfApproved: true }):

GST/{gst}/Submissions/GemstoneJewellery/{skuId}
├── status: "PENDING"
├── updatedAt: <new timestamp>
├── ...updated data...

Global SKU/GemstoneJewellery/{skuId}
├── NULL (removed from website)

Global SKU/Indexes/GemstoneJewellery/By*/{...}
├── NULL (all index entries removed)

AdminQueue/GemstoneJewellery/{skuId}
├── status: "PENDING"
├── reason: "SUPPLIER_EDITED"
├── queuedAt: <timestamp>
```

### Example: Admin Hides APPROVED Listing

```
BEFORE:
Global SKU/GemstoneJewellery/{skuId}
├── status: "APPROVED"
├── ...data...

GST/{gst}/Submissions/GemstoneJewellery/{skuId}
├── status: "APPROVED"

AFTER hideGemstoneJewelleryFromWebsite():

Global SKU/GemstoneJewellery/{skuId}
├── NULL (removed from website)

Global SKU/Indexes/GemstoneJewellery/By*/{...}
├── NULL (all index entries removed)

GST/{gst}/Submissions/GemstoneJewellery/{skuId}
├── status: "HIDDEN"
├── hiddenAt: <timestamp>
├── hiddenBy: <admin uid>
├── hiddenReason: "Pending restock"
```

### Example: Admin Sends Back to Supplier

```
AFTER sendGemstoneJewelleryBackToSupplierReview():

GST/{gst}/Submissions/GemstoneJewellery/{skuId}
├── status: "SUPPLIER_REVIEW"
├── rejectionReason: "Please add better product photos"

GST/{gst}/SupplierInbox/GemstoneJewellery/{skuId}
├── skuId
├── status: "SUPPLIER_REVIEW"
├── reason: "Please add better product photos"
├── createdAt
├── readAt: null

AdminQueue/GemstoneJewellery/{skuId}
├── status: "SUPPLIER_REVIEW"
├── reason: "Please add better product photos"

Global SKU/GemstoneJewellery/{skuId}
├── NULL (removed from website)
```

---

## 🎯 Implementation Priority

### Phase 1: Core State Management (Database)
**Effort: 4-5 hours**
- [ ] Add new DB functions (functions 5-11 above)
- [ ] Enhance submissions to track state history
- [ ] Update indexes on all transitions
- [ ] Test all state transitions

### Phase 2: Supplier UI
**Effort: 3-4 hours**
- [ ] Update gemstone-jewellery landing page (filters, inbox badge)
- [ ] Update edit page (status display, re-approval warning)
- [ ] Create inbox page
- [ ] Add inline actions (delete, resubmit)

### Phase 3: Admin UI
**Effort: 4-5 hours**
- [ ] Create admin gemstone-jewellery panel
- [ ] Implement 4 tabs (PENDING, APPROVED, HIDDEN, UNLIST_REQUESTS)
- [ ] Add action buttons for each state
- [ ] Modal forms for reason input
- [ ] Real-time listing count badges

### Phase 4: Notifications (Optional, can do later)
**Effort: 2-3 hours**
- [ ] Email when sent back for review
- [ ] Email when approved
- [ ] Email when rejected
- [ ] In-app toast notifications

---

## 🔀 Apply to Rudraksha Later

Once working in Gemstone, the same pattern can be applied to Rudraksha:
- Copy all database functions (just change collection names)
- Copy UI structure
- Reuse components where possible
- Expected effort: 2-3 hours (copy + adapt)

---

## ✅ Backward Compatibility

All changes are backward compatible:
- New fields (HIDDEN, SUPPLIER_REVIEW statuses) are additions
- Existing DRAFT/PENDING/APPROVED/REJECTED continue to work
- No data migration needed
- Supplier and admin UIs can be rolled out independently

---

## 📝 Summary

**Total Implementation Time:** ~12-15 hours
- Database: 4-5 hours
- Supplier UI: 3-4 hours
- Admin UI: 4-5 hours
- Testing: 1-2 hours
- (Optional) Notifications: 2-3 hours

**Business Value:**
- Complete lifecycle management
- Better control for suppliers and admins
- Professional state tracking
- Audit trail for changes
- Foundation for notifications later

**Risk:** LOW (all backward compatible)
**Complexity:** MEDIUM (multi-state management)

---

Ready to implement? Want detailed file changes next?


