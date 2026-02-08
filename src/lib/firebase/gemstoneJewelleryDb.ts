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
import { uniqTags, normalizeTag } from "@/lib/gemstoneJewellery/options";

/**
 * ✅ Fixes included:
 * - Firebase update() cannot contain undefined -> we sanitize deep (undefined -> null)
 * - stoneName/lookName/material/closure become null when empty (never undefined)
 * - Supplier defaults store uses nulls too
 * - NEW: Supplier edit on APPROVED listing can auto trigger re-approval:
 *   - status -> PENDING
 *   - push AdminQueue
 *   - remove from Global SKU + indexes (hide from website)
 */

/* -------------------- DB nodes -------------------- */
const SUBMISSION_NODE = (gstNumber: string) => `GST/${gstNumber}/Submissions/GemstoneJewellery`;
const SUPPLIER_INDEX = (gstNumber: string, uid: string) =>
  `GST/${gstNumber}/Indexes/GemstoneJewellerySubmissions/BySupplier/${uid}`;
const SUPPLIER_DEFAULTS = (gstNumber: string, uid: string) =>
  `GST/${gstNumber}/SupplierDefaults/GemstoneJewellery/${uid}`;
const ADMIN_QUEUE = `AdminQueue/GemstoneJewellery`;

// Published global
const GLOBAL_NODE = `Global SKU/GemstoneJewellery`;
const GLOBAL_TAG_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByTag`;
const GLOBAL_TYPE_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByType`;
const GLOBAL_NATURE_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByNature`;

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

/** Safe build for removing website indexes */
function buildIndexRemovals(listing: GemstoneJewellerySubmission) {
  const tags = uniqTags(listing.tags || []).map(normalizeTag);
  const updates: Record<string, any> = {};

  for (const t of tags) updates[`${GLOBAL_TAG_INDEX}/${t}/${listing.skuId}`] = null;
  if (listing.type) updates[`${GLOBAL_TYPE_INDEX}/${listing.type}/${listing.skuId}`] = null;
  if (listing.nature) updates[`${GLOBAL_NATURE_INDEX}/${listing.nature}/${listing.skuId}`] = null;

  return updates;
}

/* -------------------- common -------------------- */
export async function deleteMediaObject(storagePath: string) {
  if (!storagePath) return;
  await deleteObject(sRef(storage, storagePath));
}

export async function deleteGemstoneJewelleryMedia(storagePath: string) {
  if (!storagePath) return;
  await deleteObject(sRef(storage, storagePath));
}

/* -------------------- NEW: supplier edit => reapproval + hide from website -------------------- */
/**
 * Call this after supplier edits an already-approved listing.
 * - Sets submission status PENDING
 * - Adds/updates AdminQueue item (admin sees it)
 * - Removes Global SKU + indexes (so it disappears from website)
 */
export async function markGemstoneJewelleryForReapproval(params: {
  gstNumber: string;
  skuId: string;
  supplierUid: string;
  thumbUrl?: string;
  reason?: string; // e.g. "SUPPLIER_EDITED"
}) {
  const gst = normalizeGstNumber(params.gstNumber);
  if (!gst) throw new Error("Missing gstNumber");
  if (!params.skuId) throw new Error("Missing skuId");
  if (!params.supplierUid) throw new Error("Missing supplierUid");

  const now = Date.now();
  const submissionPath = `${SUBMISSION_NODE(gst)}/${params.skuId}`;

  // Read current submission to remove indexes safely
  const snap = await get(dbRef(db, submissionPath));
  const sub = snap.exists() ? (snap.val() as GemstoneJewellerySubmission) : null;

  // thumb fallback
  let thumbUrl = params.thumbUrl || "";
  if (!thumbUrl && sub) {
    const imgs = sortByOrder(
      safeArray<MediaItem>((sub as any).media).filter((m: any) => (m?.kind || (m?.type === "image" ? "IMG" : "")) === "IMG")
    );
    thumbUrl = (imgs?.[0] as any)?.url || "";
  }

  const updates: Record<string, any> = {};

  // Mark pending
  updates[`${submissionPath}/status`] = "PENDING";
  updates[`${submissionPath}/updatedAt`] = now;
  updates[`${submissionPath}/_updatedAtServer`] = serverTimestamp();

  // Admin queue item
  updates[`${ADMIN_QUEUE}/${params.skuId}`] = stripUndefinedDeep({
    gstNumber: gst,
    skuId: params.skuId,
    supplierUid: params.supplierUid,
    status: "PENDING",
    thumbUrl,
    updatedAt: now,
    queuedAt: now,
    reason: params.reason || "SUPPLIER_EDITED",
    _queuedAtServer: serverTimestamp(),
  });

  // Remove from website
  updates[`${GLOBAL_NODE}/${params.skuId}`] = null;
  if (sub) Object.assign(updates, buildIndexRemovals(sub));

  await update(dbRef(db), stripUndefinedDeep(updates));
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
      _createdAtServer: serverTimestamp(),
      _updatedAtServer: serverTimestamp(),
    });
  });

  // ensure supplier index exists
  await update(
    dbRef(db),
    stripUndefinedDeep({
      [`${SUPPLIER_INDEX(gstNumberNorm, supplierUid)}/${skuId}`]: true,
    })
  );

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
/**
 * Upserts submission.
 * If you pass `triggerReapprovalIfApproved: true`, then:
 * - if existing status is APPROVED -> it will auto push to AdminQueue + remove from website.
 */
export async function upsertGemstoneJewellerySubmission(
  input: GemstoneJewellerySubmission,
  opts?: { triggerReapprovalIfApproved?: boolean }
) {
  const now = Date.now();

  const gstNumber = normalizeGstNumber(input);
  if (!gstNumber) throw new Error("Missing gstNumber in GemstoneJewellerySubmission");
  if (!input.skuId) throw new Error("Missing skuId");
  if (!input.supplierUid) throw new Error("Missing supplierUid");

  const submissionPath = `${SUBMISSION_NODE(gstNumber)}/${input.skuId}`;

  // detect prior status
  let priorStatus: string | null = null;
  try {
    const snap = await get(dbRef(db, submissionPath));
    if (snap.exists()) priorStatus = String((snap.val() as any)?.status || "");
  } catch {
    priorStatus = null;
  }

  // ✅ normalize media + kill undefineds
  const mediaNorm = safeArray<MediaItem>((input as any).media).map((m, i) => {
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

  const cleaned: GemstoneJewellerySubmission = stripUndefinedDeep({
    ...input,
    gstNumber,
    tags: uniqTags(input.tags || []),
    updatedAt: now,
    createdAt: (input as any).createdAt ?? now,
    currency: (input as any).currency ?? "INR",
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

    // pricing mode fields (optional)
    priceMode: (input as any).priceMode ?? null,
    ratePerGm: numOrNull((input as any).ratePerGm),
  }) as any;

  // ✅ sanitize payload before update()
  const payload = stripUndefinedDeep({
    ...cleaned,
    _updatedAtServer: serverTimestamp(),
  });

  await update(dbRef(db, submissionPath), payload);

  // ensure supplier index exists
  await update(
    dbRef(db, SUPPLIER_INDEX(gstNumber, cleaned.supplierUid)),
    stripUndefinedDeep({ [cleaned.skuId]: true })
  );

  // ✅ Save supplier defaults (all null-safe)
  await update(
    dbRef(db, SUPPLIER_DEFAULTS(gstNumber, cleaned.supplierUid)),
    stripUndefinedDeep({
      nature: (cleaned as any).nature ?? null,
      type: (cleaned as any).type ?? null,
      stoneName: (cleaned as any).stoneName ?? null,
      lookName: (cleaned as any).lookName ?? null,
      material: (cleaned as any).material ?? null,
      closure: (cleaned as any).closure ?? null,
      beadSizeMm: (cleaned as any).beadSizeMm ?? null,
      lengthInch: (cleaned as any).lengthInch ?? null,
      weightGm: (cleaned as any).weightGm ?? null,
      priceMode: (cleaned as any).priceMode ?? null,
      ratePerGm: (cleaned as any).ratePerGm ?? null,
      mrp: (cleaned as any).mrp ?? null,
      offerPrice: (cleaned as any).offerPrice ?? null,
      updatedAt: now,
      _updatedAtServer: serverTimestamp(),
    })
  );

  // ✅ auto trigger reapproval if supplier edited an already approved listing
  if (opts?.triggerReapprovalIfApproved && String(priorStatus || "").toUpperCase() === "APPROVED") {
    // Best: use first image as thumb if available
    const imgs = sortByOrder(
      safeArray<MediaItem>((cleaned as any).media).filter((m: any) => (m?.kind || (m?.type === "image" ? "IMG" : "")) === "IMG")
    );
    const thumbUrl = (imgs?.[0] as any)?.url || "";

    await markGemstoneJewelleryForReapproval({
      gstNumber,
      skuId: cleaned.skuId,
      supplierUid: cleaned.supplierUid,
      thumbUrl,
      reason: "SUPPLIER_EDITED",
    });
  }

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
  const sub = subSnap.exists() ? (subSnap.val() as GemstoneJewellerySubmission) : null;

  const imgs = sortByOrder(
    safeArray<MediaItem>((sub as any)?.media).filter((m: any) => (m?.kind || (m?.type === "image" ? "IMG" : "")) === "IMG")
  );
  const thumbUrl = (imgs?.[0] as any)?.url || "";

  await update(
    dbRef(db, `${ADMIN_QUEUE}/${skuId}`),
    stripUndefinedDeep({
      gstNumber: gst,
      skuId,
      supplierUid,
      status: "PENDING",
      thumbUrl,
      reason: "SUPPLIER_SUBMITTED",
      queuedAt: now,
      updatedAt: now,
      _queuedAtServer: serverTimestamp(),
    })
  );
}

/* -------------------- media upload -------------------- */
export async function uploadGemstoneJewelleryMediaBatch(params: {
  gst: string; // kept for compatibility
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

  // Also remove from website if any
  await remove(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
}


/* -------------------- delete submission (draft/pending/rejected) -------------------- */
export async function deleteGemstoneJewellerySubmission(params: {
  gstNumber: string;
  skuId: string;
  supplierUid: string;
  deleteMedia?: boolean; // default true

  // ✅ NEW: only admin should set this true
  alsoDeleteFromAdminQueue?: boolean; // default false
  alsoDeleteFromGlobalSku?: boolean;  // default false
}) {
  const gst = normalizeGstNumber(params.gstNumber);
  const { skuId, supplierUid } = params;

  if (!gst) throw new Error("Missing gstNumber");
  if (!skuId) throw new Error("Missing skuId");
  if (!supplierUid) throw new Error("Missing supplierUid");

  const submissionPath = `${SUBMISSION_NODE(gst)}/${skuId}`;

  // 1) Read submission once (for index removals + media paths)
  const snap = await get(dbRef(db, submissionPath));
  const sub = snap.exists() ? (snap.val() as GemstoneJewellerySubmission) : null;

  // If it doesn't exist, treat as already deleted
  if (!sub) {
    // still try to clean supplier index (safe)
    const updates: Record<string, any> = {};
    updates[`${SUPPLIER_INDEX(gst, supplierUid)}/${skuId}`] = null;
    await update(dbRef(db), stripUndefinedDeep(updates));
    return true;
  }

  // ✅ Safety: prevent deleting someone else's SKU (client-side check)
  if (String((sub as any).supplierUid || "") !== supplierUid) {
    throw new Error("Not allowed: SKU does not belong to this supplier");
  }

  // 2) Build multi-location delete updates (RTDB)
  const updates: Record<string, any> = {};

  // ✅ always allowed paths (supplier-owned under GST)
  updates[submissionPath] = null;
  updates[`${SUPPLIER_INDEX(gst, supplierUid)}/${skuId}`] = null;

  // ✅ remove any submission indexes (these are under GST => supplier allowed by your GST rules)
  Object.assign(updates, buildIndexRemovals(sub));

  // ❗ DO NOT delete AdminQueue / Global SKU for suppliers by default
  // Only do it if you are calling this from an admin UI (or you updated rules accordingly)
  if (params.alsoDeleteFromAdminQueue) {
    updates[`${ADMIN_QUEUE}/${skuId}`] = null;
  }

  if (params.alsoDeleteFromGlobalSku) {
    updates[`${GLOBAL_NODE}/${skuId}`] = null;
  }

  await update(dbRef(db), stripUndefinedDeep(updates));

  // 3) Delete media from Storage (best-effort)
  const doDeleteMedia = params.deleteMedia !== false;
  if (doDeleteMedia) {
    const media = safeArray<MediaItem>((sub as any).media);
    const paths = media.map((m: any) => String(m?.storagePath || "")).filter(Boolean);
    await Promise.allSettled(paths.map((p) => deleteGemstoneJewelleryMedia(p)));
  }

  return true;
}

