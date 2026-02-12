// src/lib/firebase/rudrakshaPublicDb.ts
import { db } from "@/firebaseConfig";
import { get, ref as dbRef } from "firebase/database";

export type PublicRudraksha = {
  skuId: string;

  productCategory?: string | null;
  productCategoryOther?: string | null;

  // Rudraksha identity
  type?: string | null;            // ✅ added (used by page.tsx)
  mukhiType?: string | null;
  mukhi?: number | null;

  origin?: string | null;
  originLegacy?: string | null;

  // Product copy
  productTitle?: string | null;
  shortDescription?: string | null;

  // Specs (used by page.tsx)
  sizeMm?: number | null;          // ✅ added
  material?: string | null;        // ✅ added
  labCertified?: boolean | null;   // ✅ added

  tags?: string[] | null;
  media?: any[] | null;

  // ✅ pricing (support both new + legacy)
  suggestedMrp?: number | null;
  mrp?: number | null;
  offerPrice?: number | null;
  price?: number | null;
  amount?: number | null;

  adminMarginPct?: number | null;
  computedBasePrice?: number | null;
  computedPublicPrice?: number | null;

  updatedAt?: number | null;
  createdAt?: number | null;
  approvedAt?: number | null;

  status?: string | null;
};

const GLOBAL_NODE = `Global SKU/Rudraksha`;

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: any): boolean | null {
  if (v === true || v === false) return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return true;
  if (["false", "no", "0"].includes(s)) return false;
  return null;
}

function isApprovedLike(status: any): boolean {
  const s = String(status ?? "").trim().toUpperCase();
  return !s || s === "APPROVED";
}

/** Normalize raw Firebase value to a consistent shape */
function normalize(it: any): PublicRudraksha {
  const skuId = String(it?.skuId ?? it?.id ?? it?.key ?? "");
  return {
    skuId,

    productCategory: it?.productCategory ?? null,
    productCategoryOther: it?.productCategoryOther ?? null,

    // ✅ identity/spec
    type: it?.type ?? it?.rudrakshaType ?? it?.productType ?? it?.nameType ?? null,
    mukhiType: it?.mukhiType ?? null,
    mukhi: toNum(it?.mukhi) ?? null,

    origin: it?.origin ?? it?.originNew ?? null,
    originLegacy: it?.originLegacy ?? null,

    productTitle: it?.productTitle ?? it?.itemName ?? it?.title ?? it?.name ?? null,
    shortDescription: it?.shortDescription ?? null,

    // ✅ specs used by product page
    sizeMm: toNum(it?.sizeMm ?? it?.size_mm ?? it?.beadSizeMm ?? it?.beadSize) ?? null,
    material: it?.material ?? it?.materialType ?? null,
    labCertified: toBool(it?.labCertified ?? it?.certified ?? it?.isCertified) ?? null,

    tags: Array.isArray(it?.tags) ? it.tags : null,
    media: Array.isArray(it?.media) ? it.media : null,

    // ✅ include all possible pricing fields
    computedPublicPrice: toNum(it?.computedPublicPrice) ?? null,
    computedBasePrice: toNum(it?.computedBasePrice) ?? null,
    adminMarginPct: toNum(it?.adminMarginPct) ?? null,

    offerPrice: toNum(it?.offerPrice) ?? null,
    mrp: toNum(it?.mrp) ?? null,
    suggestedMrp: toNum(it?.suggestedMrp) ?? null,
    price: toNum(it?.price) ?? null,
    amount: toNum(it?.amount) ?? null,

    updatedAt: toNum(it?.updatedAt) ?? null,
    createdAt: toNum(it?.createdAt) ?? null,
    approvedAt: toNum(it?.approvedAt) ?? null,

    status: it?.status ?? null,
  };
}

export async function listPublicRudraksha(): Promise<PublicRudraksha[]> {
  const snap = await get(dbRef(db, GLOBAL_NODE));
  const obj = (snap.val() as Record<string, any> | null) ?? null;

  const arr = Object.values(obj || {})
    .filter(Boolean)
    .map(normalize)
    .filter((it) => it.skuId)
    .filter((it) => isApprovedLike(it.status));

  // Sort newest first (approvedAt > updatedAt > createdAt)
  arr.sort((a, b) => {
    const ta = (a.approvedAt ?? a.updatedAt ?? a.createdAt ?? 0) as number;
    const tb = (b.approvedAt ?? b.updatedAt ?? b.createdAt ?? 0) as number;
    return tb - ta;
  });

  return arr;
}

export async function getPublicRudrakshaBySku(skuId: string): Promise<PublicRudraksha | null> {
  const snap = await get(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
  if (!snap.exists()) return null;

  const it = normalize(snap.val());
  if (!it.skuId) return null;
  if (!isApprovedLike(it.status)) return null;

  return it;
}

function asKind(m: any): "IMG" | "VID" | "CERT" {
  if (m?.kind === "IMG" || m?.kind === "VID" || m?.kind === "CERT") return m.kind;
  if (m?.type === "video") return "VID";
  if (m?.type === "file") return "CERT";
  return "IMG";
}

export function pickCoverUrl(media: any[] | undefined | null): string {
  const arr = Array.isArray(media) ? media : [];

  const imgs = arr
    .map((m) => ({
      ...m,
      kind: asKind(m),
      order: m?.order ?? 9999,
      url: m?.url ?? m?.src ?? "",
    }))
    .filter((m) => m.kind === "IMG" && m.url)
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  return imgs?.[0]?.url || "";
}

/**
 * ✅ Robust display price for public UI
 * Priority: computedPublicPrice → offerPrice → mrp → suggestedMrp → price → amount
 */
export function pickDisplayPrice(it: PublicRudraksha): number | null {
  const cand = [
    (it as any).computedPublicPrice,
    (it as any).offerPrice,
    (it as any).mrp,
    (it as any).suggestedMrp,
    (it as any).price,
    (it as any).amount,
  ];

  for (const x of cand) {
    const n = toNum(x);
    if (n != null && n > 0) return n;
  }
  return null;
}

/**
 * ✅ MRP helper for strike-through
 * Priority: suggestedMrp → mrp
 */
export function pickMrpPrice(it: PublicRudraksha): number | null {
  const cand = [(it as any).suggestedMrp, (it as any).mrp];
  for (const x of cand) {
    const n = toNum(x);
    if (n != null && n > 0) return n;
  }
  return null;
}

export function formatINR(n: number) {
  try {
    return `₹${Number(n).toLocaleString("en-IN")}`;
  } catch {
    return `₹${n}`;
  }
}
