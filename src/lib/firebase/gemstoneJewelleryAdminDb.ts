// src/lib/firebase/gemstoneJewelleryAdminDb.ts
import { db } from "@/firebaseConfig";
import { get, ref as dbRef, update, remove, serverTimestamp } from "firebase/database";
import type { GemstoneJewellerySubmission, MediaItem } from "@/lib/gemstoneJewellery/types";
import { uniqTags, normalizeTag } from "@/lib/gemstoneJewellery/options";
import { deleteGemstoneJewelleryMedia } from "@/lib/firebase/gemstoneJewelleryDb";

const SUBMISSION_NODE = (gstNumber: string) => `GST/${gstNumber}/Submissions/GemstoneJewellery`;
const ADMIN_QUEUE = `AdminQueue/GemstoneJewellery`;

// Published global
const GLOBAL_NODE = `Global SKU/GemstoneJewellery`;
const GLOBAL_TAG_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByTag`;
const GLOBAL_TYPE_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByType`;
const GLOBAL_NATURE_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByNature`;

export async function getPendingGemstoneJewelleryQueue() {
  const snap = await get(dbRef(db, ADMIN_QUEUE));
  return (snap.val() as Record<string, any> | null) ?? null;
}

export async function getQueuedGemstoneJewellery(skuId: string) {
  const qSnap = await get(dbRef(db, `${ADMIN_QUEUE}/${skuId}`));
  if (!qSnap.exists()) return null;

  const { gstNumber } = qSnap.val() as { gstNumber: string };
  if (!gstNumber) return null;

  const sSnap = await get(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`));
  return sSnap.exists() ? (sSnap.val() as GemstoneJewellerySubmission) : null;
}

function buildIndexUpdates(listing: GemstoneJewellerySubmission) {
  const tags = uniqTags(listing.tags || []).map(normalizeTag);
  const updates: Record<string, any> = {};

  for (const t of tags) updates[`${GLOBAL_TAG_INDEX}/${t}/${listing.skuId}`] = true;
  updates[`${GLOBAL_TYPE_INDEX}/${listing.type}/${listing.skuId}`] = true;
  updates[`${GLOBAL_NATURE_INDEX}/${listing.nature}/${listing.skuId}`] = true;

  return updates;
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

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isWeightMode(pm: any) {
  const x = String(pm || "").toUpperCase();
  return x === "WEIGHT" || x === "PRICE_PER_WEIGHT" || x === "RATE_PER_WEIGHT";
}

/**
 * ✅ Margin ALWAYS applies:
 * basePrice is selected from:
 * - weight mode: ratePerGm * weightGm
 * - else: offerPrice > mrp > 0
 */
function computeBaseAndPublic(listing: any) {
  const pm = String(listing?.priceMode || "MRP");
  const marginPct = toNum(listing?.adminMarginPct ?? listing?.marginPct ?? 0);

  let base = 0;
  let source = "";

  if (isWeightMode(pm)) {
    const rate = toNum(listing?.ratePerGm);
    const wt = toNum(listing?.weightGm);
    base = rate > 0 && wt > 0 ? Math.round(rate * wt) : 0;
    source = "WEIGHT(ratePerGm*weightGm)";
  } else {
    const offer = toNum(listing?.offerPrice);
    const mrp = toNum(listing?.mrp);

    if (offer > 0) {
      base = Math.round(offer);
      source = "OFFER_PRICE";
    } else if (mrp > 0) {
      base = Math.round(mrp);
      source = "MRP";
    } else {
      base = 0;
      source = "NONE";
    }
  }

  const publicPrice = base > 0 ? Math.round(base * (1 + marginPct / 100)) : 0;

  return { marginPct, base, publicPrice, source };
}

export async function approveGemstoneJewellery(params: {
  gstNumber: string;
  skuId: string;
  adminUid: string;
  finalPatch?: Partial<GemstoneJewellerySubmission>;
}) {
  const { gstNumber, skuId, adminUid, finalPatch } = params;

  const snap = await get(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`));
  if (!snap.exists()) throw new Error("Submission not found");
  const submission = snap.val() as GemstoneJewellerySubmission;

  // Merge submission + admin patch first
  const merged: any = stripUndefined({
    ...submission,
    ...(finalPatch || {}),
  });

  // ✅ Ensure margin fields exist (default 20 if missing)
  if (merged.adminMarginPct === undefined || merged.adminMarginPct === null) {
    merged.adminMarginPct = 20;
  }

  // ✅ Compute ALWAYS (weight or non-weight)
  const { marginPct, base, publicPrice, source } = computeBaseAndPublic(merged);

  const finalListing: any = stripUndefined({
    ...merged,
    tags: uniqTags([
      ...(submission.tags || []),
      ...(((finalPatch?.tags as string[] | undefined) || [])),
    ]),
    status: "APPROVED",
    updatedAt: Date.now(),

    // ✅ store computed values
    adminMarginPct: marginPct,
    computedBasePrice: base,
    computedPublicPrice: publicPrice,
    computedPriceSource: source,
  });

  const updates: Record<string, any> = {};

  // Publish
  updates[`${GLOBAL_NODE}/${skuId}`] = stripUndefined({
    ...finalListing,
    _approvedAtServer: serverTimestamp(),
    approvedAt: Date.now(),
    approvedBy: adminUid,
  });

  Object.assign(updates, buildIndexUpdates(finalListing));

  // Update submission (store same computed info)
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}`] = stripUndefined({
    ...finalListing,
    approvedAt: Date.now(),
    approvedBy: adminUid,
    rejectionReason: null,
    _approvedAtServer: serverTimestamp(),
  });

  // Remove from queue
  updates[`${ADMIN_QUEUE}/${skuId}`] = null;

  await update(dbRef(db), updates);
}

export async function rejectGemstoneJewellery(params: {
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

export async function unpublishGemstoneJewellery(skuId: string) {
  await remove(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
}

/* ------------------------------ media helpers ------------------------------ */

export async function updateGemstoneJewellerySubmissionMedia(params: {
  gstNumber: string;
  skuId: string;
  images: MediaItem[];
  videos: MediaItem[];
}) {
  const { gstNumber, skuId, images, videos } = params;
  const now = Date.now();

  const cleanedImages = (images || [])
    .filter(Boolean)
    .map((m: any, i) => stripUndefined({ ...m, kind: "IMG", order: i, updatedAt: now }));

  const cleanedVideos = (videos || [])
    .filter(Boolean)
    .map((m: any, i) => stripUndefined({ ...m, kind: "VID", order: i, updatedAt: now }));

  await update(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`), {
    media: [...cleanedImages, ...cleanedVideos],
    updatedAt: now,
    _updatedAtServer: serverTimestamp(),
  });
}

export async function removeGemstoneJewellerySubmissionMediaItem(params: {
  gstNumber: string;
  skuId: string;
  kind: "IMG" | "VID";
  index: number;
  deleteFromStorage: boolean;
}) {
  const { gstNumber, skuId, kind, index, deleteFromStorage } = params;

  const subSnap = await get(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`));
  if (!subSnap.exists()) throw new Error("Submission not found");

  const submission = subSnap.val() as GemstoneJewellerySubmission;
  const all = Array.isArray((submission as any).media) ? ((submission as any).media as any[]) : [];

  const list = all
    .filter(
      (m: any) =>
        m?.kind === kind ||
        (kind === "IMG" && m?.type === "image") ||
        (kind === "VID" && m?.type === "video")
    )
    .sort((a: any, b: any) => (a?.order ?? 9999) - (b?.order ?? 9999));

  const target: any = list[index];
  if (!target) throw new Error("Media item not found at index");

  if (deleteFromStorage && target.storagePath) {
    await deleteGemstoneJewelleryMedia(target.storagePath);
  }

  const nextAll = all.filter((m: any) => {
    const sameStorage = target.storagePath && m?.storagePath === target.storagePath;
    const sameUrl = !target.storagePath && target.url && m?.url === target.url;
    return !(sameStorage || sameUrl);
  });

  const nextImages = nextAll
    .map((m: any) => ({
      ...m,
      kind: m?.kind || (m?.type === "image" ? "IMG" : m?.type === "video" ? "VID" : m?.kind),
    }))
    .filter((m: any) => m.kind === "IMG")
    .sort((a: any, b: any) => (a?.order ?? 9999) - (b?.order ?? 9999))
    .map((m: any, i) => stripUndefined({ ...m, kind: "IMG", order: i }));

  const nextVideos = nextAll
    .map((m: any) => ({
      ...m,
      kind: m?.kind || (m?.type === "video" ? "VID" : m?.type === "image" ? "IMG" : m?.kind),
    }))
    .filter((m: any) => m.kind === "VID")
    .sort((a: any, b: any) => (a?.order ?? 9999) - (b?.order ?? 9999))
    .map((m: any, i) => stripUndefined({ ...m, kind: "VID", order: i }));

  await update(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}`), {
    media: [...nextImages, ...nextVideos],
    updatedAt: Date.now(),
    _updatedAtServer: serverTimestamp(),
  });
}
