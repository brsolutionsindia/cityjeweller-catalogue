// src/lib/firebase/rudrakshaPublicDb.ts
import { db } from "@/firebaseConfig";
import { get, ref as dbRef } from "firebase/database";

export type PublicRudraksha = {
  skuId: string;

  productCategory?: string;
  mukhiType?: string;
  origin?: string;

  productTitle?: string;
  shortDescription?: string;

  tags?: string[];
  media?: any[];

  suggestedMrp?: number;

  adminMarginPct?: number;
  computedBasePrice?: number;
  computedPublicPrice?: number;

  updatedAt?: number;
  createdAt?: number;

  status?: string;
};

const GLOBAL_NODE = `Global SKU/Rudraksha`;

const toNum = (v: any) => (typeof v === "number" ? v : Number(v || 0));

function isApprovedLike(status: any): boolean {
  const s = String(status ?? "").trim().toUpperCase();
  return !s || s === "APPROVED";
}

export async function listPublicRudraksha(): Promise<PublicRudraksha[]> {
  const snap = await get(dbRef(db, GLOBAL_NODE));
  const obj = (snap.val() as Record<string, PublicRudraksha> | null) ?? null;

  const arr = Object.values(obj || {})
    .filter(Boolean)
    .filter((it) => isApprovedLike((it as any).status));

  arr.sort(
    (a, b) => toNum(b.updatedAt) - toNum(a.updatedAt) || toNum(b.createdAt) - toNum(a.createdAt)
  );

  return arr;
}

export async function getPublicRudrakshaBySku(skuId: string): Promise<PublicRudraksha | null> {
  const snap = await get(dbRef(db, `${GLOBAL_NODE}/${skuId}`));
  if (!snap.exists()) return null;

  const it = snap.val() as PublicRudraksha;
  if (!isApprovedLike((it as any).status)) return null;

  return it;
}

function asKind(m: any): "IMG" | "VID" | "CERT" {
  if (m?.kind === "IMG" || m?.kind === "VID" || m?.kind === "CERT") return m.kind;
  if (m?.type === "video") return "VID";
  if (m?.type === "file") return "CERT";
  return "IMG";
}

export function pickCoverUrl(media: any[] | undefined): string {
  const arr = Array.isArray(media) ? media : [];
  const imgs = arr
    .map((m) => ({ ...m, kind: m?.kind || (m?.type === "video" ? "VID" : m?.type === "file" ? "CERT" : "IMG") }))
    .filter((m) => asKind(m) === "IMG")
    .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));
  return imgs?.[0]?.url || "";
}

export function pickDisplayPrice(it: PublicRudraksha): number | null {
  const n = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : NaN);

  const a = n((it as any).computedPublicPrice);
  if (Number.isFinite(a)) return a;

  const b = n((it as any).suggestedMrp);
  if (Number.isFinite(b)) return b;

  return null;
}
