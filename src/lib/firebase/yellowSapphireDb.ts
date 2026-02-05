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

import { db, storage } from "@/firebaseConfig";
import type {
  MediaItem,
  YellowSapphireListing,
  YellowSapphireSubmission,
} from "@/lib/yellowSapphire/types";


const PUBLIC_LISTING_NODE = (skuId: string) => `Global SKU/YellowSapphires/${skuId}`;

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
  file: File
) {
  const ext = extFromFile(file);
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${cleanSku(skuId)}_${kind}_${ts}_${rnd}.${ext}`;
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
  // optional convenience url for supplier preview (fine to keep)
  url,

  type: kind === "VID" ? "video" : "image",
  storagePath,
  fileName,
  contentType: file.type || undefined,

  createdAt: now,
  updatedAt: now,

  // default ordering in the returned batch
  order: i,                // caller will normalize to full list order later
  isPrimary: i === 0 && kind === "IMG", // only first image in batch gets primary; caller will fix overall
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


export async function resolveUrlFromStoragePath(storagePath: string): Promise<string> {
  const u = await getDownloadURL(sRef(storage, storagePath));
  return u;
}

export function sortMedia(items: MediaItem[]) {
  return [...items].sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : 9999;
    const bo = typeof b.order === "number" ? b.order : 9999;
    if (ao !== bo) return ao - bo;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

export function getPrimaryImageItem(item: YellowSapphireListing | null | undefined): MediaItem | null {
  const imgs = normalizeArray(item?.media?.images);
  if (!imgs.length) return null;
  const sorted = sortMedia(imgs);

  const primary = sorted.find((m) => m.isPrimary);
  return primary || sorted[0] || null;
}

export function getAllMediaItems(item: YellowSapphireListing | null | undefined): MediaItem[] {
  const imgs = sortMedia(normalizeArray(item?.media?.images));
  const vids = sortMedia(normalizeArray(item?.media?.videos));
  return [...imgs, ...vids];
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


export async function overwriteMediaAtPath(params: {
  storagePath: string;
  file: File;
  dbNodesToUpdate?: string[]; // ✅ multiple locations
}) {
  const { storagePath, file, dbNodesToUpdate } = params;

  const storageRef = sRef(storage, storagePath);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || undefined,
      cacheControl: "public,max-age=60",
    });
    task.on("state_changed", undefined, reject, () => resolve());
  });

  const newUrl = await getDownloadURL(storageRef);

  // ✅ update all DB nodes (submission + public listing)
  if (dbNodesToUpdate?.length) {
    const updatesObj: Record<string, any> = {};
    const now = Date.now();

    for (const node of dbNodesToUpdate) {
      updatesObj[`${node}/url`] = newUrl;
      updatesObj[`${node}/updatedAt`] = now;
      updatesObj[`${node}/contentType`] = file.type || null;
    }

    await update(dbRef(db), updatesObj);
  }

  return newUrl;
}


export async function getDownloadUrlForPath(storagePath: string): Promise<string> {
  if (!storagePath) throw new Error("Missing storagePath");
  return await getDownloadURL(sRef(storage, storagePath));
}