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

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Rudraksha pricing:
 * base picks: suggestedMrp > 0 ? suggestedMrp : 0
 * then apply adminMarginPct always
 */
function computeBaseAndPublic(listing: any) {
  const marginPct = toNum(listing?.adminMarginPct ?? listing?.marginPct ?? 0);
  const mrp = toNum(listing?.suggestedMrp);

  const base = mrp > 0 ? Math.round(mrp) : 0;
  const publicPrice = base > 0 ? Math.round(base * (1 + marginPct / 100)) : 0;
  const source = mrp > 0 ? "SUGGESTED_MRP" : "NONE";

  return { marginPct, base, publicPrice, source };
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
    tags: uniqTags([
      ...(submission.tags || []),
      ...(((finalPatch?.tags as string[] | undefined) || [])),
    ]),
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

export async function unpublishRudraksha(skuId: string) {
  await remove(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
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
