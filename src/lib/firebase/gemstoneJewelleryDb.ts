import { db, storage } from "@/firebaseConfig";
import { get, ref as dbRef, runTransaction, update, serverTimestamp } from "firebase/database";
import { ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

import type { GemstoneJewellerySubmission, MediaItem } from "@/lib/gemstoneJewellery/types";
import { uniqTags } from "@/lib/gemstoneJewellery/options";

// ---- Node helpers ----
const SUBMISSION_NODE = (gst: string) => `GST/${gst}/Submissions/GemstoneJewellery`;
const SUPPLIER_INDEX = (gst: string, uid: string) =>
  `GST/${gst}/Indexes/GemstoneJewellerySubmissions/BySupplier/${uid}`;
const ADMIN_QUEUE = `AdminQueue/GemstoneJewellery`;

// Storage (published media) – keep GlobalSKU like YellowSapphire
const STORAGE_BASE = (skuId: string) => `GlobalSKU/GemstoneJewellery/${skuId}`;

// -------------- file naming helpers (same pattern as YellowSapphire) --------------
function extFromFile(file: File) {
  const byMime = file.type?.split("/")[1];
  if (byMime) return byMime.toLowerCase().replace("jpeg", "jpg");
  const m = file.name.match(/\.([a-zA-Z0-9]+)$/);
  return (m?.[1] || "bin").toLowerCase();
}
function cleanSku(skuId: string) {
  return skuId.trim().replace(/[^A-Za-z0-9_-]/g, "");
}
function makeMediaFileName(skuId: string, kind: "IMG" | "VID", file: File) {
  const ext = extFromFile(file);
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${cleanSku(skuId)}_${kind}_${ts}_${rnd}.${ext}`;
}

// -------------- common --------------
export async function deleteMediaObject(storagePath: string) {
  if (!storagePath) return;
  await deleteObject(sRef(storage, storagePath));
}

// -------------- SKU allocator (same as YellowSapphire, separate counter) --------------
export async function allocateGemstoneJewellerySku(gst: string, supplierUid: string) {
  const xSnap = await get(dbRef(db, `GST/${gst}/SKUID Code`));
  const x = String(xSnap.val() || "").trim();
  if (!x) throw new Error("Missing /GST/<GST>/SKUID Code");

  const serialRef = dbRef(db, `GST/${gst}/Counters/GemstoneJewellerySerial/${supplierUid}`);
  const txn = await runTransaction(serialRef, (cur) => Number(cur || 0) + 1);
  if (!txn.committed) throw new Error("Could not allocate serial");

  const y = Number(txn.snapshot.val());
  const yPadded = String(y).padStart(3, "0");

  // ✅ Choose your prefix (keep stable forever once public)
  // Example: 8165GJ<SKUIDCode><001>
  const skuId = `8165GJ${x}${yPadded}`;

  return { skuId, x, y, yPadded };
}

// -------------- create stub (optional but recommended like YellowSapphire) --------------
export async function createGemstoneJewellerySubmissionStub(params: {
  skuId: string;
  gstNumber: string;
  supplierUid: string;
}) {
  const { skuId, gstNumber, supplierUid } = params;

  const base = {
    skuId,
    gstNumber: gstNumber,
    supplierUid,
    status: "DRAFT", // you can keep DRAFT until Submit; or PENDING if you want immediate queue
    media: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const updates: Record<string, any> = {};
  updates[`${SUBMISSION_NODE(gstNumber)}/${skuId}`] = base;
  updates[`${SUPPLIER_INDEX(gstNumber, supplierUid)}/${skuId}`] = true;

  await update(dbRef(db), updates);
}

export async function getGemstoneJewellerySubmission(gst: string, skuId: string) {
  const snap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
  return snap.exists() ? (snap.val() as GemstoneJewellerySubmission) : null;
}

export async function listGemstoneJewellerySubmissionsBySupplier(gst: string, uid: string) {
  const idxSnap = await get(dbRef(db, SUPPLIER_INDEX(gst, uid)));
  if (!idxSnap.exists()) return [] as string[];
  return Object.keys(idxSnap.val() || {});
}

export async function upsertGemstoneJewellerySubmission(
  input: GemstoneJewellerySubmission
) {
  const now = Date.now();

  // ✅ normalize gstNumber FIRST
  const gstNumber =
    (input as any).gstNumber ??
    (input as any).gst; // backward compatibility if any old code exists

  if (!gstNumber) {
    throw new Error("Missing gstNumber in GemstoneJewellerySubmission");
  }

  const cleaned: GemstoneJewellerySubmission = {
    ...input,
    gstNumber, // ✅ force consistency
    tags: uniqTags(input.tags || []),
    updatedAt: now,
    createdAt: input.createdAt ?? now,
    currency: input.currency ?? "INR",
    media: Array.isArray(input.media) ? input.media : [],
  };

  const submissionPath = `${SUBMISSION_NODE(gstNumber)}/${cleaned.skuId}`;

  await update(dbRef(db, submissionPath), {
    ...cleaned,
    _updatedAtServer: serverTimestamp(),
  });

  await update(dbRef(db, SUPPLIER_INDEX(gstNumber, cleaned.supplierUid)), {
    [cleaned.skuId]: true,
  });

  return cleaned;
}


export async function submitForApproval(gst: string, skuId: string, supplierUid: string) {
  const now = Date.now();
  const submissionPath = `${SUBMISSION_NODE(gst)}/${skuId}`;

  // 1) mark submission as PENDING
  await update(dbRef(db, submissionPath), {
    status: "PENDING",
    updatedAt: now,
    _updatedAtServer: serverTimestamp(),
  });

  // 2) add to admin queue
  await update(dbRef(db, `${ADMIN_QUEUE}/${skuId}`), {
    gstNumber: gst,
    skuId,
    supplierUid,
    status: "PENDING",
    thumbUrl: "", // you can fill from first image URL if you want
    queuedAt: now,
    updatedAt: now,
    _queuedAtServer: serverTimestamp(),
  });
}

// -------------- Media upload (same storage pattern as YellowSapphire) --------------
export async function uploadGemstoneJewelleryMediaBatch(params: {
  gst: string; // signature consistent
  skuId: string;
  kind: "IMG" | "VID";
  files: File[];
}): Promise<MediaItem[]> {
  const { skuId, kind, files } = params;

  const uploaded: MediaItem[] = [];
  const folder = kind === "VID" ? "videos" : "images";
  const basePath = STORAGE_BASE(skuId);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = makeMediaFileName(skuId, kind, file);

    const storagePath = `${basePath}/${folder}/${fileName}`;
    const storageRef = sRef(storage, storagePath);

    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || undefined,
      });
      task.on("state_changed", undefined, reject, () => resolve());
    });

    const url = await getDownloadURL(storageRef);
    const now = Date.now();

    uploaded.push({
      url,
      type: kind === "VID" ? "video" : "image",
      storagePath,
      fileName,
      contentType: file.type || undefined,
      createdAt: now,
      updatedAt: now,
      order: i,
      isPrimary: i === 0 && kind === "IMG",
    } as any);
  }

  return uploaded;
}

export async function deleteGemstoneJewelleryMedia(storagePath: string) {
  if (!storagePath) return;
  await deleteObject(sRef(storage, storagePath));
}
