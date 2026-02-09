// src/lib/firebase/rudrakshaDb.ts
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

import { getFunctions, httpsCallable } from "firebase/functions";

import type { RudrakshaSubmission, MediaItem, MediaKind } from "@/lib/rudraksha/types";
import { uniqTags, normalizeTag } from "@/lib/rudraksha/options";

/* -------------------- DB nodes -------------------- */
const SUBMISSION_NODE = (gstNumber: string) => `GST/${gstNumber}/Submissions/Rudraksha`;
const SUPPLIER_INDEX = (gstNumber: string, uid: string) =>
  `GST/${gstNumber}/Indexes/RudrakshaSubmissions/BySupplier/${uid}`;
const SUPPLIER_DEFAULTS = (gstNumber: string, uid: string) =>
  `GST/${gstNumber}/SupplierDefaults/Rudraksha/${uid}`;
const ADMIN_QUEUE = `AdminQueue/Rudraksha`;

// Published global
const GLOBAL_NODE = `Global SKU/Rudraksha`;
const GLOBAL_TAG_INDEX = `Global SKU/Indexes/Rudraksha/ByTag`;
const GLOBAL_CATEGORY_INDEX = `Global SKU/Indexes/Rudraksha/ByCategory`;
const GLOBAL_MUKHI_INDEX = `Global SKU/Indexes/Rudraksha/ByMukhi`;

// Requests
const REQUESTS_NODE = (gstNumber: string) => `GST/${gstNumber}/Requests/Rudraksha`;

// Storage
const STORAGE_BASE = (skuId: string) => `GlobalSKU/Rudraksha/${skuId}`;

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
function makeMediaFileName(skuId: string, kind: MediaKind, file: File) {
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

function stripUndefinedDeep<T>(input: T): T {
  if (input === undefined) return null as any;
  if (input === null) return input;
  if (Array.isArray(input)) return input.map((x) => stripUndefinedDeep(x)) as any;
  if (typeof input === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(input as any)) {
      out[k] = v === undefined ? null : stripUndefinedDeep(v);
    }
    return out;
  }
  return input;
}

function asKind(m: any): MediaKind {
  if (m?.kind === "IMG" || m?.kind === "VID" || m?.kind === "CERT") return m.kind;
  if (m?.type === "video") return "VID";
  if (m?.type === "file") return "CERT";
  return "IMG";
}

function pickThumbFromSubmission(sub: any): string {
  const imgs = sortByOrder(
    safeArray<MediaItem>(sub?.media).filter((m: any) => asKind(m) === "IMG")
  );
  return (imgs?.[0] as any)?.url || "";
}

function buildIndexRemovals(listing: RudrakshaSubmission) {
  const tags = uniqTags(listing.tags || []).map(normalizeTag);
  const updates: Record<string, any> = {};

  for (const t of tags) updates[`${GLOBAL_TAG_INDEX}/${t}/${listing.skuId}`] = null;
  if (listing.productCategory) updates[`${GLOBAL_CATEGORY_INDEX}/${listing.productCategory}/${listing.skuId}`] = null;
  if (listing.mukhiType) updates[`${GLOBAL_MUKHI_INDEX}/${listing.mukhiType}/${listing.skuId}`] = null;

  return updates;
}

/* -------------------- common -------------------- */
export async function deleteRudrakshaMedia(storagePath: string) {
  if (!storagePath) return;
  await deleteObject(sRef(storage, storagePath));
}

/* -------------------- Requests: supplier approved delete => UNLIST -------------------- */
export async function requestUnlistRudraksha(params: {
  gstNumber: string;
  skuId: string;
  supplierUid: string;
  reason?: string;
}) {
  const gst = normalizeGstNumber(params.gstNumber);
  if (!gst) throw new Error("Missing gstNumber");
  if (!params.skuId) throw new Error("Missing skuId");
  if (!params.supplierUid) throw new Error("Missing supplierUid");

  const now = Date.now();
  const reqPath = `${REQUESTS_NODE(gst)}/${params.skuId}`;

  await update(
    dbRef(db, reqPath),
    stripUndefinedDeep({
      action: "UNLIST",
      gstNumber: gst,
      skuId: params.skuId,
      supplierUid: params.supplierUid,
      reason: params.reason || "SUPPLIER_UNLIST",
      createdAt: now,
      _createdAtServer: serverTimestamp(),
    })
  );

  return true;
}

/* -------------------- supplier edit => reapproval + hide from website -------------------- */
export async function markRudrakshaForReapproval(params: {
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

  // ✅ Server-first (optional): cloud function rudrakshaShiftToReview
  try {
    const fn = httpsCallable(getFunctions(), "rudrakshaShiftToReview");
    await fn({ gstNumber: gst, skuId: params.skuId });
    return;
  } catch {
    // fallback continues below
  }

  // fallback client-side (your gemstone pattern)
  const now = Date.now();
  const submissionPath = `${SUBMISSION_NODE(gst)}/${params.skuId}`;

  const snap = await get(dbRef(db, submissionPath));
  const sub = snap.exists() ? (snap.val() as RudrakshaSubmission) : null;

  let thumbUrl = params.thumbUrl || "";
  if (!thumbUrl && sub) thumbUrl = pickThumbFromSubmission(sub);

  const updates: Record<string, any> = {};

  updates[`${submissionPath}/status`] = "PENDING";
  updates[`${submissionPath}/updatedAt`] = now;
  updates[`${submissionPath}/_updatedAtServer`] = serverTimestamp();

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

  // Remove from website + indexes
  updates[`${GLOBAL_NODE}/${params.skuId}`] = null;
  if (sub) Object.assign(updates, buildIndexRemovals(sub));

  await update(dbRef(db), stripUndefinedDeep(updates));
}

/* -------------------- SKU allocator -------------------- */
export async function allocateRudrakshaSku(gstNumber: string, supplierUid: string) {
  const gst = normalizeGstNumber(gstNumber);
  if (!gst) throw new Error("GST is required");

  const xSnap = await get(dbRef(db, `GST/${gst}/SKUID Code`));
  const x = String(xSnap.val() || "").trim();
  if (!x) throw new Error("Missing /GST/<GST>/SKUID Code");

  const serialRef = dbRef(db, `GST/${gst}/Counters/RudrakshaSerial/${supplierUid}`);
  const txn = await runTransaction(serialRef, (cur) => Number(cur || 0) + 1);
  if (!txn.committed) throw new Error("Could not allocate serial");

  const y = Number(txn.snapshot.val());
  const yPadded = String(y).padStart(3, "0");

  // ✅ choose your own prefix; keep it consistent & searchable
  const skuId = `8165RD${x}${yPadded}`;

  return { skuId, x, y, yPadded };
}

/* -------------------- submission stub (create once) -------------------- */
export async function createRudrakshaSubmissionStub(params: {
  skuId: string;
  gstNumber: string;
  supplierUid: string;
}) {
  const { skuId, supplierUid } = params;
  const gstNumberNorm = normalizeGstNumber(params.gstNumber);
  if (!gstNumberNorm) throw new Error("Missing gstNumber");

  const docRef = dbRef(db, `${SUBMISSION_NODE(gstNumberNorm)}/${skuId}`);

  await runTransaction(docRef, (cur) => {
    if (cur) return cur;
    return stripUndefinedDeep({
      skuId,
      gstNumber: gstNumberNorm,
      supplierUid,
      status: "DRAFT",
      media: [],
      tags: ["rudraksha"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      _createdAtServer: serverTimestamp(),
      _updatedAtServer: serverTimestamp(),
    });
  });

  await update(
    dbRef(db),
    stripUndefinedDeep({
      [`${SUPPLIER_INDEX(gstNumberNorm, supplierUid)}/${skuId}`]: true,
    })
  );

  return { skuId };
}

/* -------------------- read helpers -------------------- */
export async function getRudrakshaSubmission(gstNumber: string, skuId: string) {
  const gst = normalizeGstNumber(gstNumber);
  const snap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
  return snap.exists() ? (snap.val() as RudrakshaSubmission) : null;
}

export async function listRudrakshaSubmissionsBySupplier(gstNumber: string, uid: string) {
  const gst = normalizeGstNumber(gstNumber);
  const idxSnap = await get(dbRef(db, SUPPLIER_INDEX(gst, uid)));
  if (!idxSnap.exists()) return [] as string[];
  return Object.keys(idxSnap.val() || {});
}

export async function getSupplierDefaultsRudraksha(
  gstNumber: string,
  supplierUid: string
): Promise<Partial<RudrakshaSubmission> | null> {
  const gst = normalizeGstNumber(gstNumber);
  const snap = await get(dbRef(db, SUPPLIER_DEFAULTS(gst, supplierUid)));
  return snap.exists() ? (snap.val() as any) : null;
}

/* -------------------- upsert submission -------------------- */
export async function upsertRudrakshaSubmission(
  input: RudrakshaSubmission,
  opts?: { triggerReapprovalIfApproved?: boolean }
) {
  const now = Date.now();

  const gstNumber = normalizeGstNumber(input);
  if (!gstNumber) throw new Error("Missing gstNumber in RudrakshaSubmission");
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

  // normalize media
  const mediaNorm = safeArray<MediaItem>((input as any).media).map((m, i) => {
    const kind = asKind(m);
    return stripUndefinedDeep({
      ...(m as any),
      kind,
      id: (m as any).id || (m as any).storagePath || `${input.skuId}_${i}`,
      order: typeof (m as any).order === "number" ? (m as any).order : i,
      createdAt: (m as any).createdAt ?? now,
      updatedAt: (m as any).updatedAt ?? now,
      type: kind === "VID" ? "video" : kind === "CERT" ? "file" : "image",
    }) as any;
  }) as any;

  const cleaned: RudrakshaSubmission = stripUndefinedDeep({
    ...input,
    gstNumber,
    tags: uniqTags(input.tags || []),
    updatedAt: now,
    createdAt: (input as any).createdAt ?? now,
    media: mediaNorm,

    // normalize optional strings
    productCategoryOther: strOrNull((input as any).productCategoryOther),
    mukhiOther: strOrNull((input as any).mukhiOther),
    originOther: strOrNull((input as any).originOther),
    labProcessDetails: strOrNull((input as any).labProcessDetails),
    metalPurity: strOrNull((input as any).metalPurity),
    additionalStonesOther: strOrNull((input as any).additionalStonesOther),
    productTitle: strOrNull((input as any).productTitle),
    shortDescription: strOrNull((input as any).shortDescription),
    detailedDescription: strOrNull((input as any).detailedDescription),
    careInstructions: strOrNull((input as any).careInstructions),

    // normalize optional numbers
    beadSizeMinMm: numOrNull((input as any).beadSizeMinMm),
    beadSizeMaxMm: numOrNull((input as any).beadSizeMaxMm),
    numberOfBeadsCustom: numOrNull((input as any).numberOfBeadsCustom),
    metalWeightGm: numOrNull((input as any).metalWeightGm),
    costPrice: numOrNull((input as any).costPrice),
    suggestedMrp: numOrNull((input as any).suggestedMrp),
    moq: numOrNull((input as any).moq),
    availableQty: numOrNull((input as any).availableQty),
    returnPolicyDays: numOrNull((input as any).returnPolicyDays),
  }) as any;

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

  // supplier defaults (light)
  await update(
    dbRef(db, SUPPLIER_DEFAULTS(gstNumber, cleaned.supplierUid)),
    stripUndefinedDeep({
      productCategory: (cleaned as any).productCategory ?? null,
      mukhiType: (cleaned as any).mukhiType ?? null,
      origin: (cleaned as any).origin ?? null,
      jewelleryType: (cleaned as any).jewelleryType ?? null,
      metalUsed: (cleaned as any).metalUsed ?? null,
      packagingType: (cleaned as any).packagingType ?? null,
      updatedAt: now,
      _updatedAtServer: serverTimestamp(),
    })
  );

  // auto trigger reapproval if supplier edited an approved listing
  if (opts?.triggerReapprovalIfApproved && String(priorStatus || "").toUpperCase() === "APPROVED") {
    const thumbUrl = pickThumbFromSubmission(cleaned);
    await markRudrakshaForReapproval({
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
export async function submitForApprovalRudraksha(gstNumber: string, skuId: string, supplierUid: string) {
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
  const sub = subSnap.exists() ? (subSnap.val() as RudrakshaSubmission) : null;

  const thumbUrl = pickThumbFromSubmission(sub);

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
export async function uploadRudrakshaMediaBatch(params: {
  gst: string; // kept for compatibility like your gemstone function
  skuId: string;
  kind: MediaKind; // IMG | VID | CERT
  files: File[];
}): Promise<MediaItem[]> {
  const { skuId, kind, files } = params;

  if (!skuId) throw new Error("Missing skuId for media upload");
  if (!files?.length) return [];

  const uploaded: MediaItem[] = [];
  const folder = kind === "VID" ? "videos" : kind === "CERT" ? "certificates" : "images";
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
        type: kind === "VID" ? "video" : kind === "CERT" ? "file" : "image",
      }) as any
    );
  }

  return uploaded;
}

/* -------------------- delete submission (draft/pending/rejected) -------------------- */
export async function deleteRudrakshaSubmission(params: {
  gstNumber: string;
  skuId: string;
  supplierUid: string;
  deleteMedia?: boolean; // default true

  alsoDeleteFromAdminQueue?: boolean; // default false
  alsoDeleteFromGlobalSku?: boolean;  // default false
}) {
  const gst = normalizeGstNumber(params.gstNumber);
  const { skuId, supplierUid } = params;

  if (!gst) throw new Error("Missing gstNumber");
  if (!skuId) throw new Error("Missing skuId");
  if (!supplierUid) throw new Error("Missing supplierUid");

  const submissionPath = `${SUBMISSION_NODE(gst)}/${skuId}`;

  const snap = await get(dbRef(db, submissionPath));
  const sub = snap.exists() ? (snap.val() as RudrakshaSubmission) : null;

  if (!sub) {
    await update(dbRef(db), stripUndefinedDeep({ [`${SUPPLIER_INDEX(gst, supplierUid)}/${skuId}`]: null }));
    return true;
  }

  if (String((sub as any).supplierUid || "") !== supplierUid) {
    throw new Error("Not allowed: SKU does not belong to this supplier");
  }

  const status = String((sub as any).status || "").toUpperCase();

  // supplier delete of APPROVED -> UNLIST request (unless admin flags)
  if (status === "APPROVED" && !params.alsoDeleteFromGlobalSku && !params.alsoDeleteFromAdminQueue) {
    await requestUnlistRudraksha({
      gstNumber: gst,
      skuId,
      supplierUid,
      reason: "SUPPLIER_DELETE_REQUEST",
    });
    return true;
  }

  const updates: Record<string, any> = {};
  updates[submissionPath] = null;
  updates[`${SUPPLIER_INDEX(gst, supplierUid)}/${skuId}`] = null;

  if (params.alsoDeleteFromGlobalSku) {
    updates[`${GLOBAL_NODE}/${skuId}`] = null;
    Object.assign(updates, buildIndexRemovals(sub));
  }

  if (params.alsoDeleteFromAdminQueue) {
    updates[`${ADMIN_QUEUE}/${skuId}`] = null;
  }

  await update(dbRef(db), stripUndefinedDeep(updates));

  const doDeleteMedia = params.deleteMedia !== false;
  if (doDeleteMedia) {
    const media = safeArray<MediaItem>((sub as any).media);
    const paths = media.map((m: any) => String(m?.storagePath || "")).filter(Boolean);
    await Promise.allSettled(paths.map((p) => deleteRudrakshaMedia(p)));
  }

  return true;
}
