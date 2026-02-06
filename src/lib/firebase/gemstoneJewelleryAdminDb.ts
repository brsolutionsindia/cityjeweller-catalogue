import { db } from "@/firebaseConfig";
import { get, ref as dbRef, update, remove, serverTimestamp } from "firebase/database";
import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";
import { uniqTags, normalizeTag } from "@/lib/gemstoneJewellery/options";

const SUBMISSION_NODE = (gst: string) => `GST/${gst}/Submissions/GemstoneJewellery`;
const ADMIN_QUEUE = `AdminQueue/GemstoneJewellery`;

// Published global
const GLOBAL_NODE = `Global SKU/GemstoneJewellery`;
const GLOBAL_TAG_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByTag`;
const GLOBAL_TYPE_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByType`;
const GLOBAL_NATURE_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByNature`;

export async function getQueuedGemstoneJewellery(skuId: string) {
  const qSnap = await get(dbRef(db, `${ADMIN_QUEUE}/${skuId}`));
  if (!qSnap.exists()) return null;

  const { gst } = qSnap.val() as { gst: string };
  const sSnap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
  return sSnap.exists() ? (sSnap.val() as GemstoneJewellerySubmission) : null;
}

function buildIndexUpdates(listing: GemstoneJewellerySubmission) {
  const tags = uniqTags(listing.tags || []).map(normalizeTag);
  const updates: Record<string, any> = {};

  // tag indexes
  for (const t of tags) {
    updates[`${GLOBAL_TAG_INDEX}/${t}/${listing.skuId}`] = true;
  }

  // type index
  updates[`${GLOBAL_TYPE_INDEX}/${listing.type}/${listing.skuId}`] = true;

  // nature index
  updates[`${GLOBAL_NATURE_INDEX}/${listing.nature}/${listing.skuId}`] = true;

  return updates;
}

export async function approveGemstoneJewellery(params: {
  gst: string;
  skuId: string;
  adminUid: string;
  finalPatch?: Partial<GemstoneJewellerySubmission>; // admin can normalize name/tags
}) {
  const { gst, skuId, adminUid, finalPatch } = params;

  const snap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
  if (!snap.exists()) throw new Error("Submission not found");
  const submission = snap.val() as GemstoneJewellerySubmission;

  const finalListing: GemstoneJewellerySubmission = {
    ...submission,
    ...(finalPatch || {}),
    tags: uniqTags([...(submission.tags || []), ...((finalPatch?.tags as string[] | undefined) || [])]),
    status: "APPROVED",
    updatedAt: Date.now(),
  };

  const updates: Record<string, any> = {};

  // Publish
  updates[`${GLOBAL_NODE}/${skuId}`] = {
    ...finalListing,
    // optional server timestamps
    _approvedAtServer: serverTimestamp(),
    approvedAt: Date.now(),
    approvedBy: adminUid,
  };

  // Indexes
  Object.assign(updates, buildIndexUpdates(finalListing));

  // Update submission status
  updates[`${SUBMISSION_NODE(gst)}/${skuId}/status`] = "APPROVED";
  updates[`${SUBMISSION_NODE(gst)}/${skuId}/approvedAt`] = Date.now();
  updates[`${SUBMISSION_NODE(gst)}/${skuId}/approvedBy`] = adminUid;
  updates[`${SUBMISSION_NODE(gst)}/${skuId}/rejectionReason`] = null;
  updates[`${SUBMISSION_NODE(gst)}/${skuId}/_approvedAtServer`] = serverTimestamp();

  // Remove from queue
  updates[`${ADMIN_QUEUE}/${skuId}`] = null;

  await update(dbRef(db), updates);
}

export async function rejectGemstoneJewellery(params: {
  gst: string;
  skuId: string;
  adminUid: string;
  reason: string;
}) {
  const { gst, skuId, adminUid, reason } = params;

  const updates: Record<string, any> = {};
  updates[`${SUBMISSION_NODE(gst)}/${skuId}/status`] = "REJECTED";
  updates[`${SUBMISSION_NODE(gst)}/${skuId}/rejectionReason`] = reason;
  updates[`${SUBMISSION_NODE(gst)}/${skuId}/rejectedAt`] = Date.now();
  updates[`${SUBMISSION_NODE(gst)}/${skuId}/rejectedBy`] = adminUid;
  updates[`${SUBMISSION_NODE(gst)}/${skuId}/_rejectedAtServer`] = serverTimestamp();

  // Remove from queue
  updates[`${ADMIN_QUEUE}/${skuId}`] = null;

  await update(dbRef(db), updates);
}

// Optional utility if you ever need to unpublish
export async function unpublishGemstoneJewellery(skuId: string) {
  await remove(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
}
