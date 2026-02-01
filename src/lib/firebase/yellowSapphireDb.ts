import {
  get,
  ref as dbRef,
  runTransaction,
  update,
  serverTimestamp,
} from "firebase/database";

import {
  ref as sRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { db, storage } from "./firebaseClient";
import type {
  MediaItem,
  YellowSapphireListing,
  YellowSapphireSubmission,
} from "@/lib/yellowSapphire/types";


const PUBLIC_LISTING_NODE = (skuId: string) => `GlobalSKU/YellowSapphires/${skuId}`;

const SUBMISSION_NODE = (gst: string) => `GST/${gst}/Submissions/YellowSapphires`;
const SUPPLIER_INDEX = (gst: string, uid: string) =>
  `GST/${gst}/Indexes/YellowSapphiresSubmissions/BySupplier/${uid}`;
const ADMIN_QUEUE = `AdminQueue/YellowSapphires`;

/* -------------------- file naming helpers -------------------- */

function extFromFile(file: File) {
  const byMime = file.type?.split("/")[1];
  if (byMime) return byMime.toLowerCase().replace("jpeg", "jpg");
  const m = file.name.match(/\.([a-zA-Z0-9]+)$/);
  return (m?.[1] || "bin").toLowerCase();
}

function cleanSku(skuId: string) {
  return skuId.trim().replace(/[^A-Za-z0-9_-]/g, "");
}

function makeMediaFileName(
  skuId: string,
  kind: "IMG" | "VID",
  index1Based: number,
  file: File
) {
  const ext = extFromFile(file);
  const nn = String(index1Based).padStart(2, "0");
  return `${cleanSku(skuId)}_${kind}_${nn}.${ext}`;
}

/* -------------------- utils -------------------- */

function stripUndefinedDeep<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(stripUndefinedDeep) as any;
  if (obj && typeof obj === "object") {
    const out: any = {};
    Object.entries(obj as any).forEach(([k, v]) => {
      if (v === undefined) return;
      out[k] = stripUndefinedDeep(v);
    });
    return out;
  }
  return obj;
}

const pickSupplierDefaults = (data: any) =>
  stripUndefinedDeep({
    ratePerCaratInr: data?.ratePerCaratInr ?? null,
    treatmentStatus: data?.treatmentStatus ?? null,
    luster: data?.luster ?? null,
    origin: data?.origin ?? null,
    certified: data?.certified ?? null,
    remarks: data?.remarks ?? null,
    measurementMm: data?.measurementMm ?? null,
    stoneLocalCode: data?.stoneLocalCode ?? null,
    updatedAt: Date.now(),
  });

/* -------------------- storage helpers -------------------- */

export async function deleteMediaObject(storagePath: string) {
  if (!storagePath) return;
  await deleteObject(sRef(storage, storagePath));
}

/* -------------------- sku allocator -------------------- */

export async function allocateYellowSapphireSku(gst: string, supplierUid: string) {
  const xSnap = await get(dbRef(db, `GST/${gst}/SKUID Code`));
  const x = String(xSnap.val() || "").trim();
  if (!x) throw new Error("Missing /GST/<GST>/SKUID Code");

  const serialRef = dbRef(db, `GST/${gst}/Counters/YellowSapphireSerial/${supplierUid}`);
  const txn = await runTransaction(serialRef, (cur) => Number(cur || 0) + 1);
  if (!txn.committed) throw new Error("Could not allocate serial");

  const y = Number(txn.snapshot.val());
  const yPadded = String(y).padStart(3, "0");
  const skuId = `8165YSAPPHIRE${x}${yPadded}`;
  return { skuId, x, y, yPadded };
}

/* -------------------- submission stub -------------------- */

export async function createSubmissionStub(params: {
  skuId: string;
  gst: string;
  supplierUid: string;
}) {
  const { skuId, gst, supplierUid } = params;

  const base = {
    skuId,
    gstNumber: gst,
    supplierUid,
    status: "PENDING",
    media: { images: [], videos: [], thumbUrl: "" },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const updates: Record<string, any> = {};
  updates[`${SUBMISSION_NODE(gst)}/${skuId}`] = base;
  updates[`${SUPPLIER_INDEX(gst, supplierUid)}/${skuId}`] = true;

  updates[`${ADMIN_QUEUE}/${skuId}`] = {
    skuId,
    gstNumber: gst,
    supplierUid,
    status: "PENDING",
    thumbUrl: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await update(dbRef(db), updates);
}

/* -------------------- upload media -------------------- */

export async function uploadMediaBatch(
  files: File[],
  skuId: string,
  kind: "IMG" | "VID",
  gst: string
): Promise<MediaItem[]> {
  if (!gst) throw new Error("GST is required for upload.");

  const uploaded: MediaItem[] = [];
  const basePath = `GlobalSKU/YellowSapphires/${skuId}`;
  const folder = kind === "VID" ? "videos" : "images";

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    const fileName = makeMediaFileName(skuId, kind, i + 1, file);
    const storagePath = `${basePath}/${folder}/${fileName}`;
    const storageRef = sRef(storage, storagePath);

    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || undefined,
      });
      task.on("state_changed", undefined, reject, () => resolve());
    });

    const url = await getDownloadURL(storageRef);

    // ✅ No "as any" — proper TS fields
    uploaded.push({
      url,
      type: kind === "VID" ? "video" : "image",
      storagePath,
      fileName,
      contentType: file.type || undefined,
      createdAt: Date.now(),
    });
  }

  return uploaded;
}

/* -------------------- read / save / delete -------------------- */

export async function getSubmission(gst: string, skuId: string) {
  const snap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
  return (snap.val() as YellowSapphireSubmission | null) ?? null;
}

export async function saveSubmission(params: {
  skuId: string;
  gst: string;
  supplierUid: string;
  data: Partial<YellowSapphireSubmission>;
}) {
  const { skuId, gst, supplierUid, data } = params;

  const thumbUrl = data.media?.thumbUrl || data.media?.images?.[0]?.url || "";

  const submissionPayload = stripUndefinedDeep({
    ...data,
    skuId,
    gstNumber: gst,
    supplierUid,
    status: "PENDING", // supplier cannot override
    updatedAt: serverTimestamp(),
  });

  const updates: Record<string, any> = {};
  updates[`${SUBMISSION_NODE(gst)}/${skuId}`] = submissionPayload;

  updates[`GST/${gst}/SupplierDefaults/YellowSapphires/${supplierUid}`] =
    pickSupplierDefaults(data);

  updates[`${SUPPLIER_INDEX(gst, supplierUid)}/${skuId}`] = true;

  updates[`${ADMIN_QUEUE}/${skuId}`] = stripUndefinedDeep({
    skuId,
    gstNumber: gst,
    supplierUid,
    status: "PENDING",
    thumbUrl: thumbUrl || "",
    updatedAt: serverTimestamp(),
  });

  await update(dbRef(db), updates);
}


export async function deleteSubmission(params: {
  skuId: string;
  gst: string;
  supplierUid: string;
}) {
  const { skuId, gst, supplierUid } = params;

  const submission = await getSubmission(gst, skuId);

  const mediaPaths: string[] = [];
  const imgs = submission?.media?.images || [];
  const vids = submission?.media?.videos || [];

  for (const m of imgs) {
  const p = m.storagePath;
  if (p) mediaPaths.push(p);
}
for (const m of vids) {
  const p = m.storagePath;
  if (p) mediaPaths.push(p);
}

  await Promise.allSettled(
    mediaPaths.map((p) => (p ? deleteObject(sRef(storage, p)) : Promise.resolve()))
  );

  const updates: Record<string, any> = {};
  updates[`${SUBMISSION_NODE(gst)}/${skuId}`] = null;
  updates[`${SUPPLIER_INDEX(gst, supplierUid)}/${skuId}`] = null;
  updates[`${ADMIN_QUEUE}/${skuId}`] = null;

  await update(dbRef(db), updates);
}

export async function getSupplierDefaults(gst: string, supplierUid: string) {
  const s = await get(dbRef(db, `GST/${gst}/SupplierDefaults/YellowSapphires/${supplierUid}`));
  return s.exists() ? s.val() : null;
}

/* -------------------- public listing -------------------- */

export async function getListing(skuId: string) {
  const snap = await get(dbRef(db, PUBLIC_LISTING_NODE(skuId)));
  return (snap.val() as YellowSapphireListing | null) ?? null;
}

/* -------------------- public listing: bulk read + helpers -------------------- */

/* -------------------- public listing: bulk read + helpers -------------------- */

export type PublicYellowSapphire = YellowSapphireListing & { id: string };

function normalizeArray(v: unknown): MediaItem[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean) as MediaItem[];
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).filter(Boolean) as MediaItem[];
  return [];
}


export function getPrimaryImageUrl(item: YellowSapphireListing | null | undefined): string | null {
  const imgs = normalizeArray(item?.media?.images);
  const first = imgs[0];
  return first?.url || item?.media?.thumbUrl || null;
}

export function getAllMedia(item: YellowSapphireListing | null | undefined): MediaItem[] {
  const imgs = normalizeArray(item?.media?.images);
  const vids = normalizeArray(item?.media?.videos);
  return [...imgs, ...vids].filter((m) => !!m?.url);
}


/** Prefer stored publicRatePerCaratInr (already computed by admin pipeline) */
export function getPublicPricePerCaratInr(item: YellowSapphireListing | null | undefined): number | null {
  const p = item?.publicRatePerCaratInr;
  return typeof p === "number" && Number.isFinite(p) ? p : null;
}

/** Total price = publicRatePerCaratInr * weightCarat */
export function getTotalPriceInr(item: YellowSapphireListing | null | undefined): number | null {
  const ppc = getPublicPricePerCaratInr(item);
  const carat = item?.weightCarat;
  if (ppc == null) return null;
  if (typeof carat !== "number" || !Number.isFinite(carat)) return null;
  return Math.round(ppc * carat);
}

/**
 * Bulk fetch all public listings.
 * Node: /Global SKU/YellowSapphires
 */
export async function fetchAllPublicListings(): Promise<PublicYellowSapphire[]> {
  const snap = await get(dbRef(db, "Global SKU/YellowSapphires"));
  if (!snap.exists()) return [];
  const raw = snap.val() as Record<string, YellowSapphireListing>;
  return Object.entries(raw).map(([id, value]) => ({
    id,
    ...(value || ({} as YellowSapphireListing)),
  }));
}