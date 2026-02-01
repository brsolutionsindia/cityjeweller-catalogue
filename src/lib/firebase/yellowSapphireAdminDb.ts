import { db } from "./firebaseClient";
import {
  get,
  ref as dbRef,
  update,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";

import type { YellowSapphireSubmission, YellowSapphireListing } from "@/lib/yellowSapphire/types";

const SUBMISSION_NODE = (gst: string, skuId: string) =>
  `GST/${gst}/Submissions/YellowSapphires/${skuId}`;

const ADMIN_QUEUE_NODE = (skuId: string) => `AdminQueue/YellowSapphires/${skuId}`;
const PUBLIC_NODE = (skuId: string) => `GlobalSKU/YellowSapphires/${skuId}`;

// ✅ read all pending queue items
export async function getPendingYellowSapphireQueue() {
  const q = query(
    dbRef(db, "AdminQueue/YellowSapphires"),
    orderByChild("status"),
    equalTo("PENDING")
  );
  const snap = await get(q);
  return (snap.val() || {}) as Record<
    string,
    { skuId: string; gstNumber: string; supplierUid: string; thumbUrl?: string; createdAt?: any; updatedAt?: any; status: string }
  >;
}

// ✅ read full submission (admin needs gst)
export async function getYellowSapphireSubmission(gst: string, skuId: string) {
  const snap = await get(dbRef(db, SUBMISSION_NODE(gst, skuId)));
  return (snap.val() as YellowSapphireSubmission | null) ?? null;
}

// ✅ media reorder (admin “minor adjustment”)
export async function updateSubmissionMedia(params: {
  gst: string;
  skuId: string;
  images: YellowSapphireSubmission["media"]["images"];
  videos: YellowSapphireSubmission["media"]["videos"];
}) {
  const { gst, skuId, images, videos } = params;
  const thumbUrl = images?.[0]?.url || "";

  const updatesObj: Record<string, any> = {};
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/media/images`] = images;
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/media/videos`] = videos;
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/media/thumbUrl`] = thumbUrl;
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/updatedAt`] = serverTimestamp();

  // keep queue thumb fresh
  updatesObj[`${ADMIN_QUEUE_NODE(skuId)}/thumbUrl`] = thumbUrl;
  updatesObj[`${ADMIN_QUEUE_NODE(skuId)}/updatedAt`] = serverTimestamp();

  await update(dbRef(db), updatesObj);
}

// ✅ approve
export async function approveYellowSapphire(params: {
  gst: string;
  skuId: string;
  adminId: string; // uid/email
  marginPct: number; // default 20
}) {
  const { gst, skuId, adminId, marginPct } = params;

  const submission = await getYellowSapphireSubmission(gst, skuId);
  if (!submission) throw new Error("Submission not found.");

  const base = Number(submission.ratePerCaratInr || 0);
  const m = Number(marginPct || 0);
  const publicRate = Math.round(base * (1 + m / 100));

  const listing: YellowSapphireListing = {
    skuId: submission.skuId,
    stoneLocalCode: submission.stoneLocalCode,

    shapeCut: submission.shapeCut,
    clarity: submission.clarity,
    color: submission.color,

    treatmentStatus: submission.treatmentStatus,
    luster: submission.luster,
    origin: submission.origin,
    certified: submission.certified,

    weightCarat: submission.weightCarat,
    measurementMm: submission.measurementMm,

    baseRatePerCaratInr: base,
    marginPct: m,
    publicRatePerCaratInr: publicRate,

    remarks: submission.remarks,

    media: submission.media,
    status: "AVAILABLE",

    approvedBy: adminId,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  const updatesObj: Record<string, any> = {};

  // publish public listing
  updatesObj[PUBLIC_NODE(skuId)] = listing;

  // update submission status + admin fields
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/status`] = "APPROVED";
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/adminMarginPct`] = m;
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/adminRemarks`] = null;
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/approvedAt`] = serverTimestamp();
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/updatedAt`] = serverTimestamp();

  // update queue status
  updatesObj[`${ADMIN_QUEUE_NODE(skuId)}/status`] = "APPROVED";
  updatesObj[`${ADMIN_QUEUE_NODE(skuId)}/updatedAt`] = serverTimestamp();

  await update(dbRef(db), updatesObj);
}

// ✅ reject
export async function rejectYellowSapphire(params: {
  gst: string;
  skuId: string;
  adminId: string;
  remarks: string;
}) {
  const { gst, skuId, remarks } = params;

  const updatesObj: Record<string, any> = {};
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/status`] = "REJECTED";
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/adminRemarks`] = (remarks || "").trim();
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/rejectedAt`] = serverTimestamp();
  updatesObj[`${SUBMISSION_NODE(gst, skuId)}/updatedAt`] = serverTimestamp();

  updatesObj[`${ADMIN_QUEUE_NODE(skuId)}/status`] = "REJECTED";
  updatesObj[`${ADMIN_QUEUE_NODE(skuId)}/updatedAt`] = serverTimestamp();

  await update(dbRef(db), updatesObj);
}
