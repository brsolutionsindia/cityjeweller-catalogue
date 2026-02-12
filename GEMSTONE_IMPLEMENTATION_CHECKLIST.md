# Gemstone-Jewellery Listing Lifecycle: Implementation Checklist

**Overall Status:** Ready for Implementation  
**Total Effort:** 12-15 hours  
**Start Date:** TBD  
**Target Completion:** TBD

---

## 📋 Phase 1: Database Functions (4-5 hours)

**File:** `src/lib/firebase/gemstoneJewelleryAdminDb.ts`

### 1.1 Add Helper Functions (if not already present)

- [ ] Verify `buildIndexUpdates()` exists and works correctly
- [ ] Verify `buildIndexRemovals()` exists and works correctly
- [ ] Verify `stripUndefined()` exists
- [ ] Test that `getGemstoneJewellerySubmission()` works

### 1.2 Implement New Functions

**Visibility Management:**
- [ ] `hideGemstoneJewelleryFromWebsite()` - Hide APPROVED listing
- [ ] `unhideGemstoneJewelleryToWebsite()` - Restore HIDDEN to approved

**Supplier Review Workflow:**
- [ ] `sendGemstoneJewelleryBackToSupplierReview()` - Send back to supplier
- [ ] `getSupplierInboxGemstoneJewellery()` - Get supplier inbox items
- [ ] `markSupplierInboxItemAsRead()` - Mark inbox as read

**Unlist Request Handling:**
- [ ] `approveUnlistRequestGemstoneJewellery()` - Admin approves deletion
- [ ] `rejectUnlistRequestGemstoneJewellery()` - Admin rejects deletion

**Listing Queries:**
- [ ] `listAllGemstoneJewelleryGlobal()` - Get all global listings
- [ ] `listGemstoneJewelleryByStatus()` - Get listings by status

### 1.3 Update Types (if needed)

**File:** `src/lib/gemstoneJewellery/types.ts`

- [ ] Update `GJStatus` to include "HIDDEN" and "SUPPLIER_REVIEW"
- [ ] Add optional fields to `GemstoneJewellerySubmission`:
  - [ ] `hiddenAt?: number`
  - [ ] `hiddenBy?: string`
  - [ ] `hiddenReason?: string`

### 1.4 Test Phase 1

- [ ] Can hide approved listing (disappears from Global SKU)
- [ ] Can unhide hidden listing (reappears on website)
- [ ] Can send back to supplier (creates inbox entry)
- [ ] Supplier inbox returns correct items
- [ ] Can approve/reject unlist requests
- [ ] Indexes are properly removed when hiding
- [ ] Indexes are properly restored when unhiding

---

## 📱 Phase 2: Supplier UI (3-4 hours)

### 2.1 Update Landing Page

**File:** `src/app/(supplier-protected)/supplier/gemstone-jewellery/page.tsx`

- [ ] Add inbox notification badge
- [ ] Add status filter tabs (ALL, DRAFT, PENDING, APPROVED, REJECTED, SUPPLIER_REVIEW, HIDDEN)
- [ ] Update delete handler with status-specific messages
- [ ] Add inbox counter to header
- [ ] Load inbox data on mount
- [ ] Display alert if items need review

### 2.2 Update Edit Page

**File:** `src/app/(supplier-protected)/supplier/gemstone-jewellery/[skuId]/page.tsx`

- [ ] Add status badge display
- [ ] Show rejection/review reason prominently
- [ ] Update re-approval warning text (clearer messaging)
- [ ] Conditional button labels (Save vs Save & Send for Review)
- [ ] Add delete button for APPROVED listings (creates UNLIST_REQUEST)
- [ ] Add delete button for DRAFT/PENDING/REJECTED (hard delete)
- [ ] Show different UI for SUPPLIER_REVIEW status
- [ ] Link to inbox from review reason display

### 2.3 Create New Inbox Page

**File:** `src/app/(supplier-protected)/supplier/gemstone-jewellery/inbox/page.tsx` (NEW)

- [ ] Create file (use template from GEMSTONE_PHASE2_SUPPLIER_UI.md)
- [ ] Load supplier inbox items
- [ ] Display reason from admin for each item
- [ ] Show "Edit & Resubmit" button
- [ ] Show "Mark as Read" button
- [ ] Sort by newest first
- [ ] Show unread count in header
- [ ] Link back to listings

### 2.4 Test Phase 2

- [ ] See inbox badge with count
- [ ] Filter by different statuses
- [ ] Inbox shows items sent back by admin
- [ ] Click on inbox item shows reason
- [ ] Edit form shows rejection reason
- [ ] Delete DRAFT item (hard delete)
- [ ] Delete APPROVED item (creates UNLIST_REQUEST)
- [ ] Mark inbox item as read
- [ ] Resubmit after review

---

## 👨‍💼 Phase 3: Admin UI (4-5 hours)

### 3.1 Create Admin Dashboard

**File:** `src/app/(admin)/admin/gemstone-jewellery/page.tsx` (NEW)

- [ ] Create file (use complete template from GEMSTONE_PHASE3_ADMIN_UI.md)
- [ ] Implement 5 tabs: PENDING, APPROVED, HIDDEN, UNLIST_REQUESTS, ALL
- [ ] Implement search/filter
- [ ] Load pending queue items
- [ ] Load global listings
- [ ] Load unlist requests
- [ ] Implement real-time counts for each tab

### 3.2 Implement Admin Actions

- [ ] PENDING tab:
  - [ ] Approve button (moves to Global SKU + APPROVED)
  - [ ] Send Back button (creates inbox entry)
  - [ ] Reject button (sets to REJECTED + reason)
- [ ] APPROVED tab:
  - [ ] Hide button (unpublishes, keeps in submissions)
  - [ ] Send Back button
- [ ] HIDDEN tab:
  - [ ] Unhide button (republishes)
  - [ ] Send Back button
- [ ] UNLIST_REQUESTS tab:
  - [ ] Approve Delete button (hard deletes)
  - [ ] Reject button (keeps approved)

### 3.3 Implement Modal Dialogs

- [ ] Reject reason modal
- [ ] Send back reason modal
- [ ] Reason input is required
- [ ] Submit button disabled if no reason

### 3.4 Implement Status Badges

- [ ] Color-coded by status
- [ ] Show "Pending", "Approved", "Hidden", "Needs Review", etc.

### 3.5 Test Phase 3

- [ ] Navigate to admin gemstone-jewellery page
- [ ] See PENDING items in PENDING tab
- [ ] See APPROVED items in APPROVED tab
- [ ] Approve pending item → moves to APPROVED tab
- [ ] Send back item → creates inbox for supplier
- [ ] Reject item → shows REJECTED to supplier
- [ ] Hide approved item → disappears from website but in HIDDEN tab
- [ ] Unhide item → reappears on website
- [ ] Approve unlist request → item deleted
- [ ] Search/filter works across all tabs

---

## 🔀 Phase 4: Apply to Rudraksha (Optional, Later)

**Effort:** 2-3 hours per file set  
**Status:** Can do after Gemstone is tested

- [ ] Create `rudrakshaAdminDb.ts` functions (copy + adapt from Gemstone)
  - [ ] hideRudrakshaFromWebsite()
  - [ ] unhideRudrakshaToWebsite()
  - [ ] sendRudrakshaBackToSupplierReview()
  - [ ] etc.
- [ ] Update Rudraksha supplier UI (similar changes)
- [ ] Update Rudraksha admin UI (similar structure)
- [ ] Test Rudraksha workflow
- [ ] Update Rudraksha types if needed

---

## 🧪 Integration Testing

### Test Scenario 1: Supplier Creates → Admin Approves

- [ ] Supplier creates new listing (DRAFT)
- [ ] Supplier submits (PENDING, in admin queue)
- [ ] Admin sees in PENDING tab
- [ ] Admin approves
- [ ] Listing appears on website (Global SKU)
- [ ] Supplier sees APPROVED in their list

### Test Scenario 2: Supplier Edits Approved Listing

- [ ] Supplier edits APPROVED listing
- [ ] Submission status → PENDING
- [ ] Removed from Global SKU (website)
- [ ] Added to admin queue
- [ ] Admin approves again
- [ ] Back on website

### Test Scenario 3: Admin Hides Listing

- [ ] Listing is APPROVED
- [ ] Admin hides it
- [ ] Disappears from website
- [ ] Still in database (can unhide)
- [ ] Supplier still sees it as APPROVED in their list

### Test Scenario 4: Admin Sends Back to Supplier

- [ ] Listing is APPROVED or PENDING
- [ ] Admin sends back with reason
- [ ] Removed from website
- [ ] Created in supplier inbox
- [ ] Supplier notified (sees badge)
- [ ] Supplier views inbox, sees reason
- [ ] Supplier edits and resubmits

### Test Scenario 5: Supplier Requests Deletion

- [ ] Listing is APPROVED
- [ ] Supplier clicks "Delete"
- [ ] Creates UNLIST_REQUEST (not immediately deleted)
- [ ] Admin sees in UNLIST_REQUESTS tab
- [ ] Admin approves deletion
- [ ] Listing hard deleted

### Test Scenario 6: Admin Rejects Deletion

- [ ] Supplier requested deletion
- [ ] Admin rejects
- [ ] Listing stays APPROVED
- [ ] Supplier notified via inbox (optional)

---

## 📝 Code Review Checklist

Before merging each phase:

**Phase 1 (Database):**
- [ ] All functions properly handle null/undefined (Firebase RTDB safety)
- [ ] Indexes are correctly built/removed
- [ ] Server timestamps used where appropriate
- [ ] Error handling and validation present
- [ ] No hardcoded values except constants

**Phase 2 (Supplier UI):**
- [ ] All imports present and correct
- [ ] Loading states handled
- [ ] Error messages user-friendly
- [ ] Modal forms validate inputs
- [ ] Button states (disabled while loading) work
- [ ] Navigation/links work correctly

**Phase 3 (Admin UI):**
- [ ] Table renders correctly
- [ ] Sorting/filtering works
- [ ] Action buttons call correct functions
- [ ] Modal submits correct data
- [ ] Counts update after actions
- [ ] No console errors

---

## 🐛 Known Issues & Workarounds

### Issue 1: Database Rules May Need Updates
**Status:** TBD (depends on your rules)  
**Action:** Verify Firestore rules allow:
- Suppliers can read/write own submissions
- Admins can read/write all submissions + global
- Admins can write to supplier inbox
- Public can read global SKU only

### Issue 2: Email Notifications Not Implemented
**Status:** Phase 4 (optional later)  
**Action:** Use Cloud Functions to send emails:
- When sent back for review
- When approved
- When rejected
- When deletion approved

### Issue 3: Bulk Actions Not Implemented
**Status:** Can add in future
**Action:** Add checkboxes + bulk approve/reject/hide

---

## 📚 Dependencies & Imports

### New Imports Needed

```typescript
// gemstoneJewelleryAdminDb.ts additions:
import { serverTimestamp } from "firebase/database";

// Component imports:
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useState, useEffect } from "react";

// From new database functions:
import {
  hideGemstoneJewelleryFromWebsite,
  unhideGemstoneJewelleryToWebsite,
  sendGemstoneJewelleryBackToSupplierReview,
  getSupplierInboxGemstoneJewellery,
  markSupplierInboxItemAsRead,
  approveUnlistRequestGemstoneJewellery,
  rejectUnlistRequestGemstoneJewellery,
  listAllGemstoneJewelleryGlobal,
  listGemstoneJewelleryByStatus,
} from "@/lib/firebase/gemstoneJewelleryAdminDb";
```

---

## 🎯 Success Criteria

### Phase 1 Completion
- ✅ All 9 database functions implemented
- ✅ All functions tested and working
- ✅ Types updated (HIDDEN, SUPPLIER_REVIEW statuses)
- ✅ No TypeScript errors
- ✅ No console errors when calling functions

### Phase 2 Completion
- ✅ Landing page shows inbox badge
- ✅ Status filters work
- ✅ Edit page shows reason/status
- ✅ Inbox page displays items
- ✅ Delete behavior is correct (hard vs UNLIST_REQUEST)
- ✅ All links/navigation work

### Phase 3 Completion
- ✅ Admin page loads all listings
- ✅ 5 tabs working correctly
- ✅ All action buttons work
- ✅ Modals display and submit correctly
- ✅ Counts update in real-time
- ✅ Search/filter working

### End-to-End Completion
- ✅ Full workflow testable end-to-end
- ✅ No data inconsistencies
- ✅ All edge cases handled
- ✅ Ready for production

---

## 📅 Timeline Estimate

| Phase | Task | Hours | Estimated |
|-------|------|-------|-----------|
| 1 | Database functions | 4-5 | Day 1 |
| 1 | Testing Phase 1 | 1-2 | Day 1 |
| 2 | Supplier UI | 3-4 | Day 2 |
| 2 | Testing Phase 2 | 1-2 | Day 2 |
| 3 | Admin UI | 4-5 | Day 3 |
| 3 | Testing Phase 3 | 1-2 | Day 3 |
| E2E | Full testing + fixes | 2-3 | Day 4 |
| **TOTAL** | | **12-15 hours** | **4 days** |

---

## 🚀 Deployment Checklist

Before going live:

- [ ] All phases completed
- [ ] Full end-to-end testing done
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Database rules verified
- [ ] Backup current database (if production)
- [ ] Test with real suppliers
- [ ] Test with real admins
- [ ] Performance is acceptable
- [ ] Load time is acceptable
- [ ] Mobile UI works (if applicable)
- [ ] Error messages are clear
- [ ] Documentation updated (if applicable)

---

## 📞 Support & Questions

Refer to detailed guides:
- **GEMSTONE_LIFECYCLE_SPEC.md** - Overall design
- **GEMSTONE_PHASE1_DATABASE.md** - Database functions
- **GEMSTONE_PHASE2_SUPPLIER_UI.md** - Supplier UI
- **GEMSTONE_PHASE3_ADMIN_UI.md** - Admin UI

---

## 🎉 Completion

Once all phases are done and tested:

1. Mark as complete in this checklist
2. Document any changes made
3. Update team on new features
4. Plan Phase 4 (Rudraksha) if needed
5. Consider Phase 4 Optional Features:
   - Email notifications
   - Bulk actions
   - Activity audit log
   - Supplier ratings
   - Auto-rejection rules

---

**Ready to start? Begin with Phase 1: Database Functions**


