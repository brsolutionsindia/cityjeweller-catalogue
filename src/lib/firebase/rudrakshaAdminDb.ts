// src/lib/firebase/rudrakshaAdminDb.ts
import { db } from "@/firebaseConfig";
import { get, ref as dbRef, update, remove, serverTimestamp } from "firebase/database";
import type { RudrakshaSubmission, MediaItem, MediaKind } from "@/lib/rudraksha/types";
import { uniqTags, normalizeTag } from "@/lib/rudraksha/options";
import { deleteRudrakshaMedia } from "@/lib/firebase/rudrakshaDb";

const SUBMISSION_NODE = (gstNumber: string) => `GST/${gstNumber}/Submissions/Rudraksha`;
const ADMIN_QUEUE = `AdminQueue/Rudraksha`;

// Published global
const GLOBAL_NODE = `Global SKU/Rudraksha`;
const GLOBAL_TAG_INDEX = `Global SKU/Indexes/Rudraksha/ByTag`;
const GLOBAL_CATEGORY_INDEX = `Global SKU/Indexes/Rudraksha/ByCategory`;
const GLOBAL_MUKHI_INDEX = `Global SKU/Indexes/Rudraksha/ByMukhi`;

// NEW: supplier trigger/inbox (for "send back to supplier review")
const SUPPLIER_INBOX_NODE = (gstNumber: string) => `GST/${gstNumber}/SupplierInbox/Rudraksha`;

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function stripUndefined(obj: any) {
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = stripUndefined(v);
    else out[k] = v;
  }
  return out;
}

function buildIndexUpdates(listing: RudrakshaSubmission) {
  const tags = uniqTags(listing.tags || []).map(normalizeTag);
  const updates: Record<string, any> = {};

  for (const t of tags) updates[`${GLOBAL_TAG_INDEX}/${t}/${listing.skuId}`] = true;
  if (listing.productCategory) updates[`${GLOBAL_CATEGORY_INDEX}/${listing.productCategory}/${listing.skuId}`] = true;
  if (listing.mukhiType) updates[`${GLOBAL_MUKHI_INDEX}/${listing.mukhiType}/${listing.skuId}`] = true;

  return updates;
}

// NEW: remove indexes when hiding/unpublishing/sending back
function buildIndexRemovals(listing: RudrakshaSubmission) {
  const tags = uniqTags(listing.tags || []).map(normalizeTag);
  const updates: Record<string, any> = {};

  for (const t of tags) updates[`${GLOBAL_TAG_INDEX}/${t}/${listing.skuId}`] = null;
  if (listing.productCategory) updates[`${GLOBAL_CATEGORY_INDEX}/${listing.productCategory}/${listing.skuId}`] = null;
  if (listing.mukhiType) updates[`${GLOBAL_MUKHI_INDEX}/${listing.mukhiType}/${listing.skuId}`] = null;

  return updates;
}

// NEW: list approved + hidden from global
export async function listAllGlobalRudraksha() {
  const snap = await get(dbRef(db, GLOBAL_NODE));
  const obj = (snap.val() as Record<string, RudrakshaSubmission> | null) ?? null;

  const arr = Object.values(obj || {}).filter(Boolean);
  arr.sort(
    (a: any, b: any) =>
      toNum(b.updatedAt) - toNum(a.updatedAt) || toNum(b.createdAt) - toNum(a.createdAt)
  );

  return arr;
}

export async function getPendingRudrakshaQueue() {
  const snap = await get(dbRef(db, ADMIN_QUEUE));
  return (snap.val() as Record<string, any> | null) ?? null;
}

export async function getQueuedRudraksha(skuId: string) {
  const qSnap = await get(dbRef(db, `${ADMIN_QUEUE}/${skuId}`));
  if (!qSnap.exists()) return null;

  const { gstNumber } = qSnap.val() as { gstNumber: string };
  if (!gstNumber) return null;

  const sSnap = await get(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`));
  return sSnap.exists() ? (sSnap.val() as RudrakshaSubmission) : null;
}

/**
 * Rudraksha pricing:
 * final MRP (computedPublicPrice) = supplier price * (1 + adminMarginPct/100)
 * supplier price resolved from: weight mode -> ratePerGm*weightGm, else supplierPrice|supplierRate|price|suggestedMrp
 */
function computeBaseAndPublic(listing: any) {
  const marginPct = toNum(listing?.adminMarginPct ?? listing?.marginPct ?? 0);

  // Determine supplier base price
  let supplierBase = 0;
  const pm = String(listing?.priceMode || "MRP").toUpperCase();
  if (pm === "WEIGHT" || pm === "PRICE_PER_WEIGHT" || pm === "RATE_PER_WEIGHT") {
    const rate = toNum(listing?.ratePerGm ?? listing?.supplierRate ?? listing?.supplierPrice ?? listing?.price);
    const wt = toNum(listing?.weightGm ?? listing?.weight);
    supplierBase = rate > 0 && wt > 0 ? Math.round(rate * wt) : 0;
  } else {
    // Try supplier-specific fields first, then fall back to suggestedMRP/mrp
    supplierBase =
      toNum(listing?.supplierPrice) ||
      toNum(listing?.supplierRate) ||
      toNum(listing?.price) ||
      toNum(listing?.suggestedMrp) ||
      toNum(listing?.mrp) ||
      0;
    supplierBase = Math.round(supplierBase || 0);
  }

  const computedPublicPrice = supplierBase > 0 ? Math.round(supplierBase * (1 + marginPct / 100)) : 0;
  const source = supplierBase > 0 ? (pm.startsWith("WEIGHT") ? "WEIGHT(supplierRate*weight)" : "SUPPLIER_PRICE") : "NONE";

  return { marginPct, base: supplierBase, publicPrice: computedPublicPrice, source };
}

export async function approveRudraksha(params: {
  gstNumber: string;
  skuId: string;
  adminUid: string;
  finalPatch?: Partial<RudrakshaSubmission>;
}) {
  const { gstNumber, skuId, adminUid, finalPatch } = params;

  const snap = await get(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`));
  if (!snap.exists()) throw new Error("Submission not found");
  const submission = snap.val() as RudrakshaSubmission;

  const merged: any = stripUndefined({
    ...submission,
    ...(finalPatch || {}),
  });

  if (merged.adminMarginPct === undefined || merged.adminMarginPct === null) {
    merged.adminMarginPct = 20;
  }

  const { marginPct, base, publicPrice, source } = computeBaseAndPublic(merged);

  const finalListing: any = stripUndefined({
    ...merged,
    tags: uniqTags([...(submission.tags || []), ...(((finalPatch?.tags as string[]) || []))]),
    status: "APPROVED",
    updatedAt: Date.now(),

    adminMarginPct: marginPct,
    computedBasePrice: base,
    computedPublicPrice: publicPrice,
    computedPriceSource: source,
  });

  const updates: Record<string, any> = {};

  updates[`${GLOBAL_NODE}/${skuId}`] = stripUndefined({
    ...finalListing,
    _approvedAtServer: serverTimestamp(),
    approvedAt: Date.now(),
    approvedBy: adminUid,
  });

  Object.assign(updates, buildIndexUpdates(finalListing));

  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}`] = stripUndefined({
    ...finalListing,
    approvedAt: Date.now(),
    approvedBy: adminUid,
    rejectionReason: null,
    _approvedAtServer: serverTimestamp(),
  });

  updates[`${ADMIN_QUEUE}/${skuId}`] = null;

  await update(dbRef(db), updates);
}

export async function rejectRudraksha(params: {
  gstNumber: string;
  skuId: string;
  adminUid: string;
  reason: string;
}) {
  const { gstNumber, skuId, adminUid, reason } = params;

  const updates: Record<string, any> = {};
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/status`] = "REJECTED";
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/rejectionReason`] = reason;
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/rejectedAt`] = Date.now();
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/rejectedBy`] = adminUid;
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/_rejectedAtServer`] = serverTimestamp();

  updates[`${ADMIN_QUEUE}/${skuId}`] = null;

  await update(dbRef(db), updates);
}

/**
 * NEW: Hide from website (no supplier trigger)
 * - keep global record, but mark status HIDDEN
 * - remove indexes so it won't appear via public filters
 */
export async function hideRudrakshaFromWebsite(params: { skuId: string; adminUid: string }) {
  const { skuId, adminUid } = params;

  const gSnap = await get(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
  if (!gSnap.exists()) throw new Error("Global listing not found");

  const listing = gSnap.val() as RudrakshaSubmission;

  const updates: Record<string, any> = {};
  Object.assign(updates, buildIndexRemovals(listing));

  updates[`${GLOBAL_NODE}/${skuId}/status`] = "HIDDEN";
  updates[`${GLOBAL_NODE}/${skuId}/hiddenAt`] = Date.now();
  updates[`${GLOBAL_NODE}/${skuId}/hiddenBy`] = adminUid;
  updates[`${GLOBAL_NODE}/${skuId}/_hiddenAtServer`] = serverTimestamp();
  updates[`${GLOBAL_NODE}/${skuId}/updatedAt`] = Date.now();
  updates[`${GLOBAL_NODE}/${skuId}/_updatedAtServer`] = serverTimestamp();

  await update(dbRef(db), updates);
}

/**
 * NEW: Unhide (make visible on website again, no supplier trigger)
 * - status back to APPROVED
 * - rebuild indexes
 */
export async function unhideRudrakshaToWebsite(params: { skuId: string; adminUid: string }) {
  const { skuId, adminUid } = params;

  const gSnap = await get(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
  if (!gSnap.exists()) throw new Error("Global listing not found");

  const listing = gSnap.val() as RudrakshaSubmission;

  const finalListing: any = stripUndefined({
    ...listing,
    status: "APPROVED",
    updatedAt: Date.now(),
  });

  const updates: Record<string, any> = {};
  updates[`${GLOBAL_NODE}/${skuId}`] = stripUndefined({
    ...finalListing,
    unhiddenAt: Date.now(),
    unhiddenBy: adminUid,
    _unhiddenAtServer: serverTimestamp(),
    _updatedAtServer: serverTimestamp(),
  });

  Object.assign(updates, buildIndexUpdates(finalListing));

  await update(dbRef(db), updates);
}

/**
 * UPDATED: Unpublish should also remove indexes
 * (This is "remove from website" style delete)
 */
export async function unpublishRudraksha(skuId: string) {
  const gSnap = await get(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
  if (!gSnap.exists()) {
    // fallback to old behavior
    await remove(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
    return;
  }

  const listing = gSnap.val() as RudrakshaSubmission;

  const updates: Record<string, any> = {};
  Object.assign(updates, buildIndexRemovals(listing));
  updates[`${GLOBAL_NODE}/${skuId}`] = null;

  await update(dbRef(db), updates);
}

/**
 * NEW: Send back to supplier review (TRIGGERS supplier)
 * - remove from global + indexes
 * - set submission status to SUPPLIER_REVIEW + reason
 * - create supplier inbox entry
 * - add to admin queue as SUPPLIER_REVIEW so admin can track
 */
export async function sendRudrakshaBackToSupplierReview(params: {
  gstNumber: string;
  skuId: string;
  supplierUid: string;
  adminUid: string;
  reason: string;
}) {
  const { gstNumber, skuId, supplierUid, adminUid, reason } = params;

  const updates: Record<string, any> = {};

  // remove from global + indexes (if exists)
  const gSnap = await get(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
  if (gSnap.exists()) {
    const listing = gSnap.val() as RudrakshaSubmission;
    Object.assign(updates, buildIndexRemovals(listing));
    updates[`${GLOBAL_NODE}/${skuId}`] = null;
  }

  // supplier submission update
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/status`] = "SUPPLIER_REVIEW";
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/reviewReason`] =
    reason || "Please review and resubmit.";
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/reviewRequestedAt`] = Date.now();
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/reviewRequestedBy`] = adminUid;
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/_reviewRequestedAtServer`] = serverTimestamp();
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/updatedAt`] = Date.now();
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}/_updatedAtServer`] = serverTimestamp();

  // supplier inbox trigger
  updates[`${SUPPLIER_INBOX_NODE(gstNumber)}/${skuId}`] = stripUndefined({
    skuId,
    gstNumber,
    supplierUid,
    status: "SUPPLIER_REVIEW",
    reason,
    createdAt: Date.now(),
    _createdAtServer: serverTimestamp(),
  });

  // admin queue track (this is what your admin list reads)
  updates[`${ADMIN_QUEUE}/${skuId}`] = stripUndefined({
    skuId,
    gstNumber,
    supplierUid,
    status: "SUPPLIER_REVIEW",
    reason,
    updatedAt: Date.now(),
    _updatedAtServer: serverTimestamp(),
  });

  await update(dbRef(db), updates);
}

/* ------------------------------ media helpers ------------------------------ */

function normalizeKind(m: any): MediaKind {
  if (m?.kind === "IMG" || m?.kind === "VID" || m?.kind === "CERT") return m.kind;
  if (m?.type === "video") return "VID";
  if (m?.type === "file") return "CERT";
  return "IMG";
}

export async function updateRudrakshaSubmissionMedia(params: {
  gstNumber: string;
  skuId: string;
  images: MediaItem[];
  videos: MediaItem[];
  certificates: MediaItem[];
}) {
  const { gstNumber, skuId, images, videos, certificates } = params;
  const now = Date.now();

  const cleanedImages = (images || [])
    .filter(Boolean)
    .map((m: any, i) => stripUndefined({ ...m, kind: "IMG", type: "image", order: i, updatedAt: now }));

  const cleanedVideos = (videos || [])
    .filter(Boolean)
    .map((m: any, i) => stripUndefined({ ...m, kind: "VID", type: "video", order: i, updatedAt: now }));

  const cleanedCerts = (certificates || [])
    .filter(Boolean)
    .map((m: any, i) => stripUndefined({ ...m, kind: "CERT", type: "file", order: i, updatedAt: now }));

  await update(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`), {
    media: [...cleanedImages, ...cleanedVideos, ...cleanedCerts],
    updatedAt: now,
    _updatedAtServer: serverTimestamp(),
  });
}

export async function removeRudrakshaSubmissionMediaItem(params: {
  gstNumber: string;
  skuId: string;
  kind: MediaKind;
  index: number;
  deleteFromStorage: boolean;
}) {
  const { gstNumber, skuId, kind, index, deleteFromStorage } = params;

  const subSnap = await get(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`));
  if (!subSnap.exists()) throw new Error("Submission not found");

  const submission = subSnap.val() as RudrakshaSubmission;
  const all = Array.isArray((submission as any).media) ? ((submission as any).media as any[]) : [];

  const list = all
    .map((m: any) => ({ ...m, kind: normalizeKind(m) }))
    .filter((m: any) => m?.kind === kind)
    .sort((a: any, b: any) => (a?.order ?? 9999) - (b?.order ?? 9999));

  const target: any = list[index];
  if (!target) throw new Error("Media item not found at index");

  if (deleteFromStorage && target.storagePath) {
    await deleteRudrakshaMedia(target.storagePath);
  }

  const nextAll = all.filter((m: any) => {
    const sameStorage = target.storagePath && m?.storagePath === target.storagePath;
    const sameUrl = !target.storagePath && target.url && m?.url === target.url;
    return !(sameStorage || sameUrl);
  });

  const nextImgs = nextAll
    .map((m: any) => ({ ...m, kind: normalizeKind(m) }))
    .filter((m: any) => m.kind === "IMG")
    .sort((a: any, b: any) => (a?.order ?? 9999) - (b?.order ?? 9999))
    .map((m: any, i) => stripUndefined({ ...m, kind: "IMG", type: "image", order: i }));

  const nextVids = nextAll
    .map((m: any) => ({ ...m, kind: normalizeKind(m) }))
    .filter((m: any) => m.kind === "VID")
    .sort((a: any, b: any) => (a?.order ?? 9999) - (b?.order ?? 9999))
    .map((m: any, i) => stripUndefined({ ...m, kind: "VID", type: "video", order: i }));

  const nextCerts = nextAll
    .map((m: any) => ({ ...m, kind: normalizeKind(m) }))
    .filter((m: any) => m.kind === "CERT")
    .sort((a: any, b: any) => (a?.order ?? 9999) - (b?.order ?? 9999))
    .map((m: any, i) => stripUndefined({ ...m, kind: "CERT", type: "file", order: i }));

  await update(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`), {
    media: [...nextImgs, ...nextVids, ...nextCerts],
    updatedAt: Date.now(),
    _updatedAtServer: serverTimestamp(),
  });
}
