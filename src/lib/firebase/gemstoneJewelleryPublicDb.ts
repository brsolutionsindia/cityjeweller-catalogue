import { db } from "@/firebaseConfig";
import { get, ref as dbRef } from "firebase/database";

export type PublicGemstoneJewellery = {
  skuId: string;
  itemName?: string;
  nature?: string;   // NATURAL | ARTIFICIAL
  type?: string;     // BRACELET | RING | ...
  stoneName?: string;
  lookName?: string;
  material?: string;
  tags?: string[];
  media?: any[];     // flat array of IMG/VID items
  mrp?: number;
  offerPrice?: number;

  // admin computed fields (recommended)
  adminMarginPct?: number;
  computedBasePrice?: number;
  computedPublicPrice?: number;

  updatedAt?: number;
  createdAt?: number;
  status?: string;   // APPROVED etc
};

const GLOBAL_NODE = `Global SKU/GemstoneJewellery`;

export async function listPublicGemstoneJewellery(): Promise<PublicGemstoneJewellery[]> {
  const snap = await get(dbRef(db, GLOBAL_NODE));
  const obj = (snap.val() as Record<string, PublicGemstoneJewellery> | null) ?? null;
  const arr = Object.values(obj || {});
  // newest first
  const toNum = (v: any) => (typeof v === "number" ? v : Number(v || 0));
  arr.sort((a, b) => toNum(b.updatedAt) - toNum(a.updatedAt) || toNum(b.createdAt) - toNum(a.createdAt));
  return arr;
}

export async function getPublicGemstoneJewelleryBySku(skuId: string): Promise<PublicGemstoneJewellery | null> {
  const snap = await get(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
  return snap.exists() ? (snap.val() as PublicGemstoneJewellery) : null;
}

export function pickCoverUrl(media: any[] | undefined): string {
  const arr = Array.isArray(media) ? media : [];
  const imgs = arr
    .filter((m) => (m?.kind === "IMG") || (m?.type === "image"))
    .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));
  return imgs?.[0]?.url || "";
}

export function pickDisplayPrice(it: PublicGemstoneJewellery): number | null {
  const n = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : NaN);
  const a = n(it.computedPublicPrice);
  if (Number.isFinite(a)) return a;

  const b = n(it.offerPrice);
  if (Number.isFinite(b)) return b;

  const c = n(it.mrp);
  if (Number.isFinite(c)) return c;

  return null;
}
