import { deleteMediaObject } from "@/lib/firebase/yellowSapphireDb";
import type { MediaItem } from "@/lib/yellowSapphire/types";

import { db } from "@/firebaseConfig";
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
const PUBLIC_NODE = (skuId: string) => `Global SKU/YellowSapphires/${skuId}`;

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


function normalizeOrders(images: MediaItem[]) {
  return images.map((m, i) => ({
    ...m,
    order: i,
    isPrimary: i === 0, // cover is first
  }));
}

function normalizeVideoOrders(videos: MediaItem[]) {
  return videos.map((m, i) => ({
    ...m,
    order: i,
    isPrimary: false,
  }));
}

export async function removeSubmissionMediaItem(params: {
  gst: string;
  skuId: string;
  kind: "IMG" | "VID";
  index: number;
  deleteFromStorage?: boolean;
}) {
  const { gst, skuId, kind, index, deleteFromStorage } = params;

  const submission = await getYellowSapphireSubmission(gst, skuId);
  if (!submission) throw new Error("Submission not found.");

  const curImages = Array.isArray(submission.media?.images) ? submission.media.images : [];
  const curVideos = Array.isArray(submission.media?.videos) ? submission.media.videos : [];

  if (kind === "IMG") {
    const target = curImages[index];
    if (!target) throw new Error("Image not found at index.");

    if (deleteFromStorage && target.storagePath) {
      await deleteMediaObject(target.storagePath);
    }

    const nextImages = normalizeOrders(curImages.filter((_, i) => i !== index));
    const thumbUrl = nextImages?.[0]?.url || "";

    await updateSubmissionMedia({ gst, skuId, images: nextImages, videos: curVideos });
    return { thumbUrl };
  } else {
    const target = curVideos[index];
    if (!target) throw new Error("Video not found at index.");

    if (deleteFromStorage && target.storagePath) {
      await deleteMediaObject(target.storagePath);
    }

    const nextVideos = normalizeVideoOrders(curVideos.filter((_, i) => i !== index));
    await updateSubmissionMedia({ gst, skuId, images: curImages, videos: nextVideos });
    return {};
  }
}
