import { db, storage } from "@/firebaseConfig";
import {
  get,
  ref as dbRef,
  set,
  update,
  serverTimestamp,
} from "firebase/database";
import {
  ref as sRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import type { GemstoneJewellerySubmission, MediaItem } from "@/lib/gemstoneJewellery/types";
import { uniqTags } from "@/lib/gemstoneJewellery/options";

// ---- Node helpers (follow your Yellow Sapphire style) ----
const SUBMISSION_NODE = (gst: string) => `GST/${gst}/Submissions/GemstoneJewellery`;
const SUPPLIER_INDEX = (gst: string, uid: string) =>
  `GST/${gst}/Indexes/GemstoneJewellerySubmissions/BySupplier/${uid}`;
const ADMIN_QUEUE = `AdminQueue/GemstoneJewellery`;

export async function getGemstoneJewellerySubmission(gst: string, skuId: string) {
  const snap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
  return snap.exists() ? (snap.val() as GemstoneJewellerySubmission) : null;
}

export async function listGemstoneJewellerySubmissionsBySupplier(gst: string, uid: string) {
  // index only stores skuId=true
  const idxSnap = await get(dbRef(db, SUPPLIER_INDEX(gst, uid)));
  if (!idxSnap.exists()) return [] as string[];
  return Object.keys(idxSnap.val() || {});
}

export async function upsertGemstoneJewellerySubmission(input: GemstoneJewellerySubmission) {
  const now = Date.now();
  const cleaned: GemstoneJewellerySubmission = {
    ...input,
    tags: uniqTags(input.tags || []),
    updatedAt: now,
    createdAt: input.createdAt ?? now,
    currency: input.currency ?? "INR",
    media: Array.isArray(input.media) ? input.media : [],
  };

  const submissionPath = `${SUBMISSION_NODE(input.gst)}/${input.skuId}`;

  // use update() for partial merges
  await update(dbRef(db, submissionPath), {
    ...cleaned,
    // Keep server timestamp for admin views if you prefer:
    _updatedAtServer: serverTimestamp(),
  });

  // ensure supplier index exists
  await update(dbRef(db, SUPPLIER_INDEX(input.gst, input.supplierUid)), {
    [input.skuId]: true,
  });

  return cleaned;
}

export async function submitForApproval(gst: string, skuId: string, supplierUid: string) {
  const submissionPath = `${SUBMISSION_NODE(gst)}/${skuId}`;
  await update(dbRef(db, submissionPath), {
    status: "PENDING",
    updatedAt: Date.now(),
    _updatedAtServer: serverTimestamp(),
  });

  // Put into admin queue for listing
  await update(dbRef(db, `${ADMIN_QUEUE}/${skuId}`), {
    gst,
    skuId,
    supplierUid,
    status: "PENDING",
    queuedAt: Date.now(),
    _queuedAtServer: serverTimestamp(),
  });
}

// ---------- Media helpers ----------
// NOTE: Keep MediaUploader logic same. These helpers are optional if you want to
// centralize upload/delete; else reuse your existing functions.

export async function uploadGemstoneJewelleryMedia(params: {
  gst: string;
  skuId: string;
  file: File;
  kind: "IMG" | "VID";
}) {
  const { gst, skuId, file, kind } = params;
  const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "IMG" ? "jpg" : "mp4");
  const id = crypto.randomUUID();
  const storagePath = `GST/${gst}/GemstoneJewellery/${skuId}/${kind}/${id}.${ext}`;
  const storageRef = sRef(storage, storagePath);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type || (kind === "IMG" ? "image/jpeg" : "video/mp4"),
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      () => {},
      (err) => reject(err),
      () => resolve()
    );
  });

  const url = await getDownloadURL(storageRef);

  const media: MediaItem = {
    id,
    kind,
    url,
    storagePath,
    order: 0,
    createdAt: Date.now(),
  };

  return media;
}

export async function deleteGemstoneJewelleryMedia(storagePath: string) {
  await deleteObject(sRef(storage, storagePath));
}
