//src/components/public/RudrakshaGrid.tsx
"use client";

import Link from "next/link";
import Image from "next/image";

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeTag(x: unknown) {
  return String(x ?? "")
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqTags(tags: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags || []) {
    const nt = normalizeTag(t);
    if (!nt) continue;
    if (seen.has(nt)) continue;
    seen.add(nt);
    out.push(nt);
  }
  return out;
}

function formatINR(n: number) {
  return n.toLocaleString("en-IN");
}

/** Defensive getters (same spirit as your page) */
function getSku(it: any) {
  return String(it.skuId || it.id || it.key || "");
}

function getCategory(it: any) {
  return String(
    it.productCategory ||
      it.productCategoryOther ||
      it.type ||
      it.typeLegacy ||
      it.productType ||
      it.category ||
      ""
  )
    .toUpperCase()
    .trim();
}

function getOrigin(it: any) {
  return String(it.origin || it.originLegacy || it.originNew || it.originOther || "")
    .toUpperCase()
    .trim();
}

function getMukhiLabel(it: any) {
  const mt = it.mukhiType ? String(it.mukhiType) : "";
  if (mt) return mt;
  const m = toNum(it.mukhi ?? it.mukhiLegacy ?? it.mukhiNo);
  if (m) return `${m}_MUKHI`;
  return "";
}

function getCertified(it: any) {
  const v = it.certificationAvailable ?? it.labCertified ?? it.certified;
  return Boolean(v);
}

function getQty(it: any) {
  return toNum(it.availableQty ?? it.qty ?? it.stock);
}

function getPrice(it: any): number | null {
  const p =
    it.computedPublicPrice ??
    it.offerPrice ??
    it.mrp ??
    it.suggestedMrp ??
    it.price ??
    it.amount;
  return toNum(p);
}

function getMrp(it: any): number | null {
  const p = it.mrp ?? it.suggestedMrp;
  return toNum(p);
}

function getCoverUrl(it: any): string | null {
  const cover = it.primaryImg || it.coverUrl || it.imageUrl || it.img || it.photoUrl;
  if (cover) return String(cover);

  if (Array.isArray(it.media) && it.media.length) {
    const first = it.media[0];
    if (first && typeof first === "object" && "url" in (first as any)) return String((first as any).url || "");
    if (first && typeof first === "object" && "src" in (first as any)) return String((first as any).src || "");
  }
  return null;
}

function titleCase(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function makeDisplayTitle(it: any) {
  // Prefer explicit titles (admin curated)
  const explicit =
    it.productTitle || it.itemName || it.title || it.name;
  if (explicit && String(explicit).trim()) return String(explicit).trim();

  // Otherwise generate a clean commercial title
  const m = getMukhiLabel(it);
  const c = getCategory(it);
  const o = getOrigin(it);

  const mLabel = m ? titleCase(m.replace("_MUKHI", " Mukhi")) : "Rudraksha";
  const cLabel = c ? titleCase(c) : "Rudraksha";
  const oLabel = o ? titleCase(o) : "";

  // Example: "5 Mukhi Bracelet • Nepal"
  const left = `${mLabel} ${cLabel}`.replace(/\s+/g, " ").trim();
  return oLabel ? `${left} • ${oLabel}` : left;
}

function getHashtags(it: any) {
  // Use tags if present, else derive from core fields
  const raw = Array.isArray(it.tags) ? it.tags : [];

  const derived: string[] = [];
  const c = getCategory(it);
  const o = getOrigin(it);
  const m = getMukhiLabel(it);

  if (c) derived.push(c);
  if (o) derived.push(o);
  if (m) derived.push(m);

  // Wear tags can exist in multiple shapes
  const wearArr = (it.intendedWearTypes || it.wearTypes || it.wear || []) as any[];
  if (Array.isArray(wearArr)) derived.push(...wearArr.map(String));

  const tags = uniqTags([...raw, ...derived]);
  return tags.slice(0, 5); // keep clean
}

function percentOff(mrp: number, sale: number) {
  if (!mrp || mrp <= 0 || sale <= 0 || sale >= mrp) return null;
  return Math.round(((mrp - sale) / mrp) * 100);
}

export default function RudrakshaGrid({ items }: { items: any[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((it) => {
        const sku = getSku(it);
        const href = `/rudraksha/${encodeURIComponent(sku)}`; // adjust if your route differs
        const img = getCoverUrl(it);
        const title = makeDisplayTitle(it);

        const sale = getPrice(it);
        const mrp = getMrp(it);
        const off = mrp && sale ? percentOff(mrp, sale) : null;

        const certified = getCertified(it);
        const qty = getQty(it);
        const inStock = qty == null ? null : qty > 0;

        const mukhi = getMukhiLabel(it);
        const hashtags = getHashtags(it);

        return (
          <Link
            key={sku || Math.random()}
            href={href}
            className="group rounded-3xl border bg-white overflow-hidden hover:shadow-sm transition"
          >
            {/* Image */}
            <div className="relative aspect-square bg-[#f6f2ea]">
              {img ? (
                <Image
                  src={img}
                  alt={title}
                  fill
                  className="object-cover group-hover:scale-[1.02] transition"
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                  No Image
                </div>
              )}

              {/* Badges */}
              {!!mukhi && (
                <div className="absolute top-2 left-2 rounded-full bg-white/90 border px-2 py-1 text-[11px]">
                  {titleCase(mukhi.replace("_MUKHI", " Mukhi"))}
                </div>
              )}
              {certified && (
                <div className="absolute top-2 right-2 rounded-full bg-black text-white px-2 py-1 text-[11px]">
                  Certified
                </div>
              )}
              {inStock !== null && (
                <div
                  className={`absolute bottom-2 right-2 rounded-full px-2 py-1 text-[11px] border ${
                    inStock ? "bg-white/90" : "bg-white/90 text-red-700"
                  }`}
                >
                  {inStock ? "In Stock" : "Out of Stock"}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-3 space-y-2">
              <div className="min-h-[40px]">
                <div className="text-sm font-semibold leading-tight line-clamp-2">
                  {title}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  SKU: {sku || "—"}
                </div>
              </div>

              {/* Price */}
              <div className="flex items-end justify-between gap-2">
                <div className="leading-none">
                  {sale != null ? (
                    <div className="text-base font-bold">₹ {formatINR(sale)}</div>
                  ) : (
                    <div className="text-sm font-semibold text-gray-700">Price on request</div>
                  )}

                  {mrp != null && sale != null && mrp > sale ? (
                    <div className="text-[11px] text-gray-500 mt-1">
                      <span className="line-through">₹ {formatINR(mrp)}</span>
                      {off != null && (
                        <span className="ml-2 rounded-full border px-2 py-[2px] text-[10px]">
                          {off}% OFF
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500 mt-1">&nbsp;</div>
                  )}
                </div>

                <div className="text-[11px] text-gray-500">
                  View →
                </div>
              </div>

              {/* Hashtags */}
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {hashtags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-[#faf7f1] border px-2 py-1 text-[11px] text-gray-700"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
