import { db, storage } from "@/firebaseConfig";
import {
  get,
  ref as dbRef,
  runTransaction,
  update,
  serverTimestamp,
  remove,
} from "firebase/database";
import {
  ref as sRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import type { GemstoneJewellerySubmission, MediaItem } from "@/lib/gemstoneJewellery/types";
import { uniqTags } from "@/lib/gemstoneJewellery/options";

/**
 * ✅ Fixes included:
 * - Firebase update() cannot contain undefined -> we sanitize deep (undefined -> null)
 * - stoneName/lookName/material/closure become null when empty (never undefined)
 * - Supplier defaults store uses nulls too
 */

/* -------------------- DB nodes -------------------- */
const SUBMISSION_NODE = (gstNumber: string) => `GST/${gstNumber}/Submissions/GemstoneJewellery`;
const SUPPLIER_INDEX = (gstNumber: string, uid: string) =>
  `GST/${gstNumber}/Indexes/GemstoneJewellerySubmissions/BySupplier/${uid}`;
const SUPPLIER_DEFAULTS = (gstNumber: string, uid: string) =>
  `GST/${gstNumber}/SupplierDefaults/GemstoneJewellery/${uid}`;
const ADMIN_QUEUE = `AdminQueue/GemstoneJewellery`;

// Storage – keep GlobalSKU like YellowSapphire
const STORAGE_BASE = (skuId: string) => `GlobalSKU/GemstoneJewellery/${skuId}`;

/* -------------------- helpers -------------------- */
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

function normalizeGstNumber(gstOrObj: any): string {
  const gst =
    (typeof gstOrObj === "string" ? gstOrObj : null) ??
    gstOrObj?.gstNumber ??
    gstOrObj?.gst ??
    "";
  return String(gst || "").trim();
}

function safeArray<T>(v: any): T[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "object") return Object.values(v).filter(Boolean) as T[];
  return [];
}

function sortByOrder<T extends { order?: number; createdAt?: number }>(arr: T[]) {
  return [...arr].sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : 9999;
    const bo = typeof b.order === "number" ? b.order : 9999;
    if (ao !== bo) return ao - bo;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function strOrNull(v: any): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function numOrNull(v: any): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * ✅ Firebase RTDB rejects undefined anywhere inside payload.
 * We convert undefined -> null recursively.
 */
function stripUndefinedDeep<T>(input: T): T {
  if (input === undefined) return null as any;
  if (input === null) return input;

  if (Array.isArray(input)) {
    return input.map((x) => stripUndefinedDeep(x)) as any;
  }

  if (typeof input === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(input as any)) {
      out[k] = v === undefined ? null : stripUndefinedDeep(v);
    }
    return out;
  }

  return input;
}

/* -------------------- common -------------------- */
export async function deleteMediaObject(storagePath: string) {
  if (!storagePath) return;
  await deleteObject(sRef(storage, storagePath));
}

/* -------------------- SKU allocator -------------------- */
export async function allocateGemstoneJewellerySku(gstNumber: string, supplierUid: string) {
  const gst = normalizeGstNumber(gstNumber);
  if (!gst) throw new Error("GST is required");

  const xSnap = await get(dbRef(db, `GST/${gst}/SKUID Code`));
  const x = String(xSnap.val() || "").trim();
  if (!x) throw new Error("Missing /GST/<GST>/SKUID Code");

  const serialRef = dbRef(db, `GST/${gst}/Counters/GemstoneJewellerySerial/${supplierUid}`);
  const txn = await runTransaction(serialRef, (cur) => Number(cur || 0) + 1);
  if (!txn.committed) throw new Error("Could not allocate serial");

  const y = Number(txn.snapshot.val());
  const yPadded = String(y).padStart(3, "0");
  const skuId = `8165GJ${x}${yPadded}`;

  return { skuId, x, y, yPadded };
}

/* -------------------- submission stub (create once) -------------------- */
export async function createGemstoneJewellerySubmissionStub(params: {
  skuId: string;
  gstNumber: string;
  supplierUid: string;
}) {
  const { skuId, supplierUid } = params;
  const gstNumberNorm = normalizeGstNumber(params.gstNumber);
  if (!gstNumberNorm) throw new Error("Missing gstNumber");

  const docRef = dbRef(db, `${SUBMISSION_NODE(gstNumberNorm)}/${skuId}`);

  await runTransaction(docRef, (cur) => {
    if (cur) return cur; // already exists
    return stripUndefinedDeep({
      skuId,
      gstNumber: gstNumberNorm,
      supplierUid,
      status: "DRAFT",
      media: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // ensure supplier index exists
  await update(dbRef(db), stripUndefinedDeep({
    [`${SUPPLIER_INDEX(gstNumberNorm, supplierUid)}/${skuId}`]: true,
  }));

  return { skuId };
}

/* -------------------- read helpers -------------------- */
export async function getGemstoneJewellerySubmission(gstNumber: string, skuId: string) {
  const gst = normalizeGstNumber(gstNumber);
  const snap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
  return snap.exists() ? (snap.val() as GemstoneJewellerySubmission) : null;
}

export async function listGemstoneJewellerySubmissionsBySupplier(gstNumber: string, uid: string) {
  const gst = normalizeGstNumber(gstNumber);
  const idxSnap = await get(dbRef(db, SUPPLIER_INDEX(gst, uid)));
  if (!idxSnap.exists()) return [] as string[];
  return Object.keys(idxSnap.val() || {});
}

export async function getSupplierDefaultsGemstoneJewellery(
  gstNumber: string,
  supplierUid: string
): Promise<Partial<GemstoneJewellerySubmission> | null> {
  const gst = normalizeGstNumber(gstNumber);
  const snap = await get(dbRef(db, SUPPLIER_DEFAULTS(gst, supplierUid)));
  return snap.exists() ? (snap.val() as any) : null;
}

/* -------------------- upsert submission -------------------- */
export async function upsertGemstoneJewellerySubmission(input: GemstoneJewellerySubmission) {
  const now = Date.now();

  const gstNumber = normalizeGstNumber(input);
  if (!gstNumber) throw new Error("Missing gstNumber in GemstoneJewellerySubmission");
  if (!input.skuId) throw new Error("Missing skuId");
  if (!input.supplierUid) throw new Error("Missing supplierUid");

  // ✅ normalize media + kill undefineds
  const mediaNorm = safeArray<MediaItem>(input.media).map((m, i) => {
    const kind = (m as any).kind || ((m as any).type === "video" ? "VID" : "IMG");
    return stripUndefinedDeep({
      ...(m as any),
      kind,
      id: (m as any).id || (m as any).storagePath || `${input.skuId}_${i}`,
      order: typeof (m as any).order === "number" ? (m as any).order : i,
      createdAt: (m as any).createdAt ?? now,
      updatedAt: (m as any).updatedAt ?? now,
    }) as any;
  }) as any;

  // ✅ CRITICAL: stoneName must never be undefined
  // If nature=ARTIFICIAL then stoneName can be null, but not undefined.
  const cleaned: GemstoneJewellerySubmission = stripUndefinedDeep({
    ...input,
    gstNumber,
    tags: uniqTags(input.tags || []),
    updatedAt: now,
    createdAt: input.createdAt ?? now,
    currency: input.currency ?? "INR",
    media: mediaNorm,

    // normalize optional strings -> null
    stoneName: strOrNull((input as any).stoneName),
    lookName: strOrNull((input as any).lookName),
    material: strOrNull((input as any).material),
    closure: strOrNull((input as any).closure),

    // normalize optional numbers -> null
    beadSizeMm: numOrNull((input as any).beadSizeMm),
    lengthInch: numOrNull((input as any).lengthInch),
    weightGm: numOrNull((input as any).weightGm),
    mrp: numOrNull((input as any).mrp),
    offerPrice: numOrNull((input as any).offerPrice),

    // if you added these fields
    priceMode: (input as any).priceMode ?? null,
    ratePerGm: numOrNull((input as any).ratePerGm),
  }) as any;

  const submissionPath = `${SUBMISSION_NODE(gstNumber)}/${cleaned.skuId}`;

  // ✅ sanitize payload before update()
  const payload = stripUndefinedDeep({
    ...cleaned,
    _updatedAtServer: serverTimestamp(),
  });

  await update(dbRef(db, submissionPath), payload);

  await update(
    dbRef(db, SUPPLIER_INDEX(gstNumber, cleaned.supplierUid)),
    stripUndefinedDeep({ [cleaned.skuId]: true })
  );

  // ✅ Save supplier defaults (all null-safe)
  await update(
    dbRef(db, SUPPLIER_DEFAULTS(gstNumber, cleaned.supplierUid)),
    stripUndefinedDeep({
      nature: cleaned.nature ?? null,
      type: cleaned.type ?? null,
      stoneName: cleaned.stoneName ?? null,
      lookName: cleaned.lookName ?? null,
      material: cleaned.material ?? null,
      closure: cleaned.closure ?? null,
      beadSizeMm: cleaned.beadSizeMm ?? null,
      lengthInch: cleaned.lengthInch ?? null,
      weightGm: (cleaned as any).weightGm ?? null,
      priceMode: (cleaned as any).priceMode ?? null,
      ratePerGm: (cleaned as any).ratePerGm ?? null,
      mrp: cleaned.mrp ?? null,
      offerPrice: cleaned.offerPrice ?? null,
      updatedAt: now,
      _updatedAtServer: serverTimestamp(),
    })
  );

  return cleaned;
}

/* -------------------- submit for approval -------------------- */
export async function submitForApproval(gstNumber: string, skuId: string, supplierUid: string) {
  const gst = normalizeGstNumber(gstNumber);
  if (!gst) throw new Error("Missing gstNumber");
  const now = Date.now();

  const submissionPath = `${SUBMISSION_NODE(gst)}/${skuId}`;

  await update(
    dbRef(db, submissionPath),
    stripUndefinedDeep({
      status: "PENDING",
      updatedAt: now,
      _updatedAtServer: serverTimestamp(),
    })
  );

  const subSnap = await get(dbRef(db, submissionPath));
  const sub = subSnap.val() as GemstoneJewellerySubmission | null;

  const imgs = sortByOrder(
    safeArray<MediaItem>(sub?.media).filter((m: any) => m?.kind === "IMG")
  );
  const thumbUrl = imgs?.[0]?.url || "";

  await update(
    dbRef(db, `${ADMIN_QUEUE}/${skuId}`),
    stripUndefinedDeep({
      gstNumber: gst,
      skuId,
      supplierUid,
      status: "PENDING",
      thumbUrl,
      queuedAt: now,
      updatedAt: now,
      _queuedAtServer: serverTimestamp(),
    })
  );
}

/* -------------------- media upload -------------------- */
export async function uploadGemstoneJewelleryMediaBatch(params: {
  gst: string;
  skuId: string;
  kind: "IMG" | "VID";
  files: File[];
}): Promise<MediaItem[]> {
  const { skuId, kind, files } = params;

  if (!skuId) throw new Error("Missing skuId for media upload");
  if (!files?.length) return [];

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
        cacheControl: "public,max-age=60",
      });
      task.on("state_changed", undefined, reject, () => resolve());
    });

    const url = await getDownloadURL(storageRef);
    const now = Date.now();

    uploaded.push(
      stripUndefinedDeep({
        id: fileName,
        kind,
        url,
        storagePath,
        order: i,
        createdAt: now,
        updatedAt: now,
      }) as any
    );
  }

  return uploaded;
}

export async function deleteGemstoneJewelleryMedia(storagePath: string) {
  if (!storagePath) return;
  await deleteObject(sRef(storage, storagePath));
}

/* -------------------- optional cleanup -------------------- */
export async function deleteGemstoneJewelleryDraft(params: {
  gstNumber: string;
  skuId: string;
  supplierUid: string;
}) {
  const gst = normalizeGstNumber(params.gstNumber);
  const { skuId, supplierUid } = params;

  await remove(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
  await remove(dbRef(db, `${SUPPLIER_INDEX(gst, supplierUid)}/${skuId}`));
  await remove(dbRef(db, `${ADMIN_QUEUE}/${skuId}`));
}
