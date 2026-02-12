// src/components/public/RudrakshaCard.tsx
"use client";

import Link from "next/link";
import type { PublicRudraksha } from "@/lib/firebase/rudrakshaPublicDb";
import { pickCoverUrl, pickDisplayPrice, pickMrpPrice } from "@/lib/firebase/rudrakshaPublicDb";
import { normalizeTag, uniqTags } from "@/lib/rudraksha/options";

function titleCase(x: string) {
  return String(x || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function formatMukhi(mt?: any, m?: any) {
  const s = String(mt || "").toUpperCase();
  if (s) {
    if (s.endsWith("_MUKHI")) return `${s.replace("_MUKHI", "")} Mukhi`;
    return titleCase(s);
  }
  const n = toNum(m);
  if (n != null && n > 0) return `${n} Mukhi`;
  return "";
}

function getBestTitle(it: any) {
  const t = it.productTitle || it.itemName || it.title || it.name;
  if (t) return String(t).trim();

  const mukhi = formatMukhi(it.mukhiType, it.mukhi);
  const cat = it.productCategory ? titleCase(String(it.productCategory)) : "Rudraksha";
  const origin = it.origin ? titleCase(String(it.origin)) : "";
  return [mukhi, cat, origin].filter(Boolean).join(" • ");
}

function getTags(it: any) {
  const raw = Array.isArray(it.tags) ? it.tags : [];
  // ✅ do NOT slice/limit — show all
  return uniqTags(raw.map((t: any) => normalizeTag(t))).filter(Boolean);
}

function getCertified(it: any) {
  return Boolean(it.certificationAvailable ?? it.labCertified ?? it.certified);
}

function getInStock(it: any) {
  const q = toNum(it.availableQty ?? it.qty ?? it.stock);
  if (q == null) return true; // unknown => don't mark out of stock
  return q > 0;
}

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function pickAnyPrice(it: any): number | null {
  const p0 = toNum(pickDisplayPrice(it) as any);
  if (p0 != null && p0 > 0) return p0;

  const p =
    it.computedPublicPrice ??
    it.offerPrice ??
    it.mrp ??
    it.suggestedMrp ??
    it.price ??
    it.amount;

  const n = toNum(p);
  return n != null && n > 0 ? n : null;
}

function getRawOrigin(obj: any) {
  if (!obj) return "";
  return (
    obj.origin ||
    obj.originLegacy ||
    (obj as any).origin_legacy ||
    (obj as any).originCity ||
    (obj as any).originCityLegacy ||
    (obj as any).productOrigin ||
    (obj as any).country ||
    ""
  );
}

export default function RudrakshaCard({ it }: { it: PublicRudraksha }) {
  const cover = pickCoverUrl(it.media);
  const price = pickDisplayPrice(it);
  const mrp = pickMrpPrice(it);
  const hasOffer = price != null && price > 0;
  const hasMrp = mrp != null && mrp > 0;

  const discountPct =
    hasOffer && hasMrp && (mrp as number) > (price as number)
      ? Math.round((((mrp as number) - (price as number)) / (mrp as number)) * 100)
      : 0;

  const title = getBestTitle(it);
  // Show origin from common fields (defensive) — prefer `origin`, fall back to other likely keys
  const rawOrigin = getRawOrigin(it);
  const origin = rawOrigin ? titleCase(String(rawOrigin)) : "";

  const sku = it.skuId ? String(it.skuId) : "";
  const mukhiChip = formatMukhi((it as any).mukhiType, (it as any).mukhi);
  const certified = getCertified(it);
  const inStock = getInStock(it);
  const tags = getTags(it);

  return (
    <Link
      href={`/rudraksha/${encodeURIComponent(sku)}`}
      className="group rounded-2xl border overflow-hidden bg-white hover:shadow-sm transition-shadow"
    >
      {/* Media */}
      <div className="relative aspect-square bg-gray-50 border-b overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? (
          <img
            src={cover}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
            No Image
          </div>
        )}

        {/* Top-left badges */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {mukhiChip ? (
            <span className="px-2 py-1 rounded-full text-[11px] bg-white/90 border">
              {mukhiChip}
            </span>
          ) : null}

          {certified ? (
            <span className="px-2 py-1 rounded-full text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-800">
              Certified
            </span>
          ) : null}

          {!inStock ? (
            <span className="px-2 py-1 rounded-full text-[11px] bg-rose-50 border border-rose-200 text-rose-800">
              Out of stock
            </span>
          ) : null}
        </div>

        {/* Bottom-right */}
        <div className="absolute bottom-2 right-2">
          <span className="px-2 py-1 rounded-full text-[11px] bg-black/70 text-white">
            View
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Title */}
        <div className="text-sm font-semibold leading-snug line-clamp-2">{title}</div>

        {/* Meta (✅ no SKU; keep origin only if present) */}
        {origin ? <div className="text-xs text-gray-500 line-clamp-1">{origin}</div> : null}

        {/* Price (offer shown; original struck-through if available) */}
        <div className="flex items-baseline gap-2 pt-1">
          <div className="text-sm font-bold">{hasOffer ? formatINR(price as number) : "Price on request"}</div>

          {hasOffer && hasMrp && (mrp as number) > (price as number) ? (
            <div className="text-xs text-gray-400 line-through">{formatINR(mrp as number)}</div>
          ) : null}

          {discountPct > 0 ? (
            <div className="ml-2 text-xs font-semibold text-white bg-rose-600 px-2 py-0.5 rounded-full">
              -{discountPct}%
            </div>
          ) : null}
        </div>

        {/* Tags / hashtags (✅ show ALL) */}
        {tags.length ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {tags.map((t) => (
              <span
                key={t}
                className="px-2 py-1 rounded-full text-[11px] bg-gray-50 border text-gray-700"
              >
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
