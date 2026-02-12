//src/app/(public)/rudraksha/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { listPublicRudraksha } from "@/lib/firebase/rudrakshaPublicDb";
import RudrakshaGrid from "@/components/public/RudrakshaGrid";
import type { PublicRudraksha } from "@/lib/firebase/rudrakshaPublicDb";

import {
  PRODUCT_CATEGORY_TABS,
  MUKHI_TABS,
  ORIGIN_TABS,
  WEAR_CHIPS,
  SHAPE_TABS,
} from "@/lib/rudraksha/options";

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

type SortKey =
  | "FEATURED"
  | "NEWEST"
  | "PRICE_LOW"
  | "PRICE_HIGH"
  | "MUKHI_ASC"
  | "MUKHI_DESC";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "FEATURED", label: "Featured" },
  { key: "NEWEST", label: "Newest" },
  { key: "PRICE_LOW", label: "Price: Low to High" },
  { key: "PRICE_HIGH", label: "Price: High to Low" },
  { key: "MUKHI_ASC", label: "Mukhi: Low to High" },
  { key: "MUKHI_DESC", label: "Mukhi: High to Low" },
];

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function pickFirst<T>(arr?: T[] | null): T | null {
  if (!arr || !arr.length) return null;
  return arr[0] ?? null;
}

/**
 * Defensive getters (because you have legacy + new schema)
 * Adjust these if your PublicRudraksha shape is different.
 */
function getTitle(it: any) {
  return (
    it.productTitle ||
    it.itemName ||
    it.title ||
    it.name ||
    `Rudraksha ${it.skuId ? `(${it.skuId})` : ""}`.trim()
  );
}

function getSku(it: any) {
  return String(it.skuId || it.id || it.key || "");
}

function getCategory(it: any) {
  return String(it.productCategory || it.productCategoryOther || it.type || it.typeLegacy || it.productType || it.category || "")
    .toUpperCase()
    .trim();
}

function getOrigin(it: any) {
  return String(it.origin || it.originLegacy || it.originNew || it.originOther || "")
    .toUpperCase()
    .trim();
}

function getMukhiLabel(it: any) {
  // new: mukhiType = "5_MUKHI", legacy: mukhi = 5
  const mt = it.mukhiType ? String(it.mukhiType) : "";
  if (mt) return mt;
  const m = toNum(it.mukhi ?? it.mukhiLegacy ?? it.mukhiNo);
  if (m) return `${m}_MUKHI`;
  return "";
}

function getMukhiNumber(it: any) {
  const mt = it.mukhiType ? String(it.mukhiType) : "";
  if (mt.endsWith("_MUKHI")) {
    const n = Number(mt.replace("_MUKHI", ""));
    return Number.isFinite(n) ? n : null;
  }
  const m = toNum(it.mukhi ?? it.mukhiLegacy ?? it.mukhiNo);
  return m ?? null;
}

function getWearTags(it: any): string[] {
  const arr = (it.intendedWearTypes || it.wearTypes || it.wear || it.tags || []) as any[];
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x).toUpperCase());
}

function getShape(it: any) {
  return String(it.rudrakshaShape || it.shape || "").toUpperCase();
}

function getCertified(it: any) {
  // new: certificationAvailable boolean, legacy: labCertified boolean
  const v = it.certificationAvailable ?? it.labCertified ?? it.certified;
  return Boolean(v);
}

function getQty(it: any) {
  const q = toNum(it.availableQty ?? it.qty ?? it.stock);
  return q;
}

function getPrice(it: any): number | null {
  // prefer public price if available
  const p =
    it.computedPublicPrice ??
    it.offerPrice ??
    it.mrp ??
    it.suggestedMrp ??
    it.price ??
    it.amount;
  return toNum(p);
}

function getCoverUrl(it: any): string | null {
  const cover =
    it.primaryImg ||
    it.coverUrl ||
    it.imageUrl ||
    it.img ||
    it.photoUrl;

  if (cover) return String(cover);

  // media can be unknown -> safely read first item's url
  if (Array.isArray(it.media) && it.media.length) {
    const first = it.media[0] as unknown;

    if (first && typeof first === "object" && "url" in (first as any)) {
      const u = (first as any).url;
      return u ? String(u) : null;
    }

    // fallback: some older shapes may store link as src
    if (first && typeof first === "object" && "src" in (first as any)) {
      const u = (first as any).src;
      return u ? String(u) : null;
    }
  }

  return null;
}


function inPriceRange(p: number | null, min: number | null, max: number | null) {
  if (p == null) return true; // if price missing, do not hide by default
  if (min != null && p < min) return false;
  if (max != null && p > max) return false;
  return true;
}

export default function RudrakshaListPage() {
  const [items, setItems] = useState<PublicRudraksha[]>([]);
  const [busy, setBusy] = useState(true);

  // Search + Filters
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [origin, setOrigin] = useState<string>("ALL");
  const [mukhi, setMukhi] = useState<string>("ALL"); // e.g. "5_MUKHI"
  const [wear, setWear] = useState<string>("ALL"); // e.g. "DAILY_WEAR"
  const [shape, setShape] = useState<string>("ALL");
  const [certOnly, setCertOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  // Sorting
  const [sort, setSort] = useState<SortKey>("FEATURED");

  // Mobile footer sheets
  const [openSheet, setOpenSheet] = useState<null | "SEARCH" | "FILTER" | "SORT">(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setBusy(true);
      try {
        const arr = await listPublicRudraksha();
        if (alive) setItems(arr || []);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const meta = useMemo(() => {
    const categories = uniq(items.map((x: any) => getCategory(x)).filter(Boolean));
    const origins = uniq(items.map((x: any) => getOrigin(x)).filter(Boolean));
    const mukhis = uniq(items.map((x: any) => getMukhiLabel(x)).filter(Boolean));
    const shapes = uniq(items.map((x: any) => getShape(x)).filter(Boolean));
    return { categories, origins, mukhis, shapes };
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    const min = minPrice.trim() ? Number(minPrice.trim()) : null;
    const max = maxPrice.trim() ? Number(maxPrice.trim()) : null;

    return items.filter((it: any) => {
      const sku = getSku(it);
      const t = getCategory(it);
      const o = getOrigin(it);
      const m = getMukhiLabel(it);
      const w = getWearTags(it);
      const sh = getShape(it);
      const title = getTitle(it);
      const p = getPrice(it);
      const certified = getCertified(it);
      const qty = getQty(it);

      const text = `${sku} ${title} ${t} ${o} ${m} ${w.join(" ")} ${sh}`.toLowerCase();
      if (s && !text.includes(s)) return false;

      if (category !== "ALL" && t !== category) return false;
      if (origin !== "ALL" && o !== origin) return false;
      if (mukhi !== "ALL" && m !== mukhi) return false;
      if (wear !== "ALL" && !w.includes(wear)) return false;
      if (shape !== "ALL" && sh !== shape) return false;

      if (certOnly && !certified) return false;
      if (inStockOnly) {
        // if qty missing, do not hide; if present and <=0, hide
        if (qty != null && qty <= 0) return false;
      }

      if (!inPriceRange(p, Number.isFinite(min as any) ? (min as any) : null, Number.isFinite(max as any) ? (max as any) : null)) {
        return false;
      }

      return true;
    });
  }, [items, q, category, origin, mukhi, wear, shape, certOnly, inStockOnly, minPrice, maxPrice]);

  const sorted = useMemo(() => {
    const arr = [...filtered];

    const byNewest = (a: any, b: any) => {
      const ta = toNum(a.approvedAt ?? a.createdAt ?? a.updatedAt) ?? 0;
      const tb = toNum(b.approvedAt ?? b.createdAt ?? b.updatedAt) ?? 0;
      return tb - ta;
    };

    const byPrice = (asc: boolean) => (a: any, b: any) => {
      const pa = getPrice(a) ?? Number.POSITIVE_INFINITY;
      const pb = getPrice(b) ?? Number.POSITIVE_INFINITY;
      return asc ? pa - pb : pb - pa;
    };

    const byMukhi = (asc: boolean) => (a: any, b: any) => {
      const ma = getMukhiNumber(a) ?? Number.POSITIVE_INFINITY;
      const mb = getMukhiNumber(b) ?? Number.POSITIVE_INFINITY;
      return asc ? ma - mb : mb - ma;
    };

    switch (sort) {
      case "NEWEST":
        arr.sort(byNewest);
        break;
      case "PRICE_LOW":
        arr.sort(byPrice(true));
        break;
      case "PRICE_HIGH":
        arr.sort(byPrice(false));
        break;
      case "MUKHI_ASC":
        arr.sort(byMukhi(true));
        break;
      case "MUKHI_DESC":
        arr.sort(byMukhi(false));
        break;
      case "FEATURED":
      default:
        // Featured: prefer certified + in-stock + newer
        arr.sort((a: any, b: any) => {
          const ca = getCertified(a) ? 1 : 0;
          const cb = getCertified(b) ? 1 : 0;
          if (cb !== ca) return cb - ca;
          const qa = (getQty(a) ?? 999999) > 0 ? 1 : 0;
          const qb = (getQty(b) ?? 999999) > 0 ? 1 : 0;
          if (qb !== qa) return qb - qa;
          return byNewest(a, b);
        });
        break;
    }

    return arr;
  }, [filtered, sort]);

  const clearAll = () => {
    setQ("");
    setCategory("ALL");
    setOrigin("ALL");
    setMukhi("ALL");
    setWear("ALL");
    setShape("ALL");
    setCertOnly(false);
    setInStockOnly(false);
    setMinPrice("");
    setMaxPrice("");
    setSort("FEATURED");
  };

  const activeFilterCount =
    (q.trim() ? 1 : 0) +
    (category !== "ALL" ? 1 : 0) +
    (origin !== "ALL" ? 1 : 0) +
    (mukhi !== "ALL" ? 1 : 0) +
    (wear !== "ALL" ? 1 : 0) +
    (shape !== "ALL" ? 1 : 0) +
    (certOnly ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (minPrice.trim() ? 1 : 0) +
    (maxPrice.trim() ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#faf7f1]">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="https://www.cityjeweller.in"
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm bg-white hover:bg-gray-50"
          >
            ← Home
            <span className="hidden sm:inline text-gray-500">www.cityjeweller.in</span>
          </Link>

          <div className="flex-1">
            <div className="text-base sm:text-lg font-semibold leading-tight">Rudraksha</div>
            <div className="text-xs sm:text-sm text-gray-600">
              Authentic Rudraksha & Rudraksha Jewellery • Mala • Bracelet • Pendant • Ring
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-gray-600">
              {busy ? "Loading…" : `Showing ${sorted.length} items`}
            </span>
            <button
              onClick={clearAll}
              className="text-xs rounded-full border px-3 py-1.5 bg-white hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 pt-5">
        <div className="relative overflow-hidden rounded-3xl border bg-white">
          <div className="relative h-[200px] sm:h-[260px]">
            <Image
              src="/images/rudraksha/hero.jpg"
              alt="Authentic Rudraksha Collection"
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
            <div className="absolute inset-0 p-5 sm:p-8 flex flex-col justify-end">
              <div className="max-w-xl space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 text-white border border-white/20 px-3 py-1 text-xs">
                  Shiva • Japa • Protection • Gifting
                </div>
                <h1 className="text-white text-2xl sm:text-4xl font-bold leading-tight">
                  Choose by Mukhi, Origin & Certification.
                </h1>
                <p className="text-white/90 text-sm sm:text-base">
                  Browse certified beads and jewellery. Quick filters, clean sorting, and an experience built for conversion.
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <a
                    href="#listing"
                    className="rounded-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-gray-100"
                  >
                    Explore Collection
                  </a>
                  <Link
                    href="https://www.cityjeweller.in"
                    className="rounded-full border border-white/40 text-white px-4 py-2 text-sm hover:bg-white/10"
                  >
                    Go to Home
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* trust row */}
          <div className="grid sm:grid-cols-3 gap-3 p-4 sm:p-5 bg-white">
            <div className="rounded-2xl border p-4">
              <div className="text-sm font-semibold">Trusted Listings</div>
              <div className="text-xs text-gray-600">Clear authenticity info, certification & important notes.</div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="text-sm font-semibold">Instant Shortlisting</div>
              <div className="text-xs text-gray-600">Mukhi • Origin • Wear • Shape • Price — all in one place.</div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="text-sm font-semibold">Fast, Clean Shopping</div>
              <div className="text-xs text-gray-600">Desktop-friendly layout + mobile quick actions.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-5" id="listing">
        {/* Desktop layout */}
        <div className="hidden md:grid grid-cols-12 gap-4 items-start">
          {/* Sidebar filters */}
          <aside className="col-span-3 sticky top-[70px] z-20">
            <div className="rounded-3xl border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Filters</div>
                <button
                  onClick={clearAll}
                  className="text-xs rounded-full border px-3 py-1.5 bg-white hover:bg-gray-50"
                >
                  Clear ({activeFilterCount})
                </button>
              </div>

              {/* Search */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Search</div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                  placeholder="mukhi / bracelet / nepal / sku..."
                />
              </div>

              {/* Category */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Category</div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                >
                  <option value="ALL">All</option>
                  {PRODUCT_CATEGORY_TABS.map((x) => (
                    <option key={x.key} value={String(x.key).toUpperCase()}>
                      {x.label}
                    </option>
                  ))}
                  {meta.categories
                    .filter((x) => !PRODUCT_CATEGORY_TABS.some((t) => String(t.key).toUpperCase() === x))
                    .map((x) => (
                      <option key={x} value={x}>
                        {x.replaceAll("_", " ")}
                      </option>
                    ))}
                </select>
              </div>

              {/* Origin */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Origin</div>
                <select
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                >
                  <option value="ALL">All</option>
                  {ORIGIN_TABS.map((x) => (
                    <option key={x.key} value={String(x.key).toUpperCase()}>
                      {x.label}
                    </option>
                  ))}
                  {meta.origins
                    .filter((x) => !ORIGIN_TABS.some((t) => String(t.key).toUpperCase() === x))
                    .map((x) => (
                      <option key={x} value={x}>
                        {x.replaceAll("_", " ")}
                      </option>
                    ))}
                </select>
              </div>

              {/* Mukhi */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Mukhi</div>
                <select
                  value={mukhi}
                  onChange={(e) => setMukhi(e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                >
                  <option value="ALL">All</option>
                  {MUKHI_TABS.map((x) => (
                    <option key={x.key} value={String(x.key).toUpperCase()}>
                      {x.label}
                    </option>
                  ))}
                  {meta.mukhis
                    .filter((x) => !MUKHI_TABS.some((t) => String(t.key).toUpperCase() === x))
                    .map((x) => (
                      <option key={x} value={x}>
                        {x.replaceAll("_", " ")}
                      </option>
                    ))}
                </select>
              </div>

              {/* Wear + Shape */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Wear</div>
                  <select
                    value={wear}
                    onChange={(e) => setWear(e.target.value)}
                    className="w-full border rounded-2xl px-3 py-2"
                  >
                    <option value="ALL">All</option>
                    {WEAR_CHIPS.map((x) => (
                      <option key={x.key} value={String(x.key).toUpperCase()}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Shape</div>
                  <select
                    value={shape}
                    onChange={(e) => setShape(e.target.value)}
                    className="w-full border rounded-2xl px-3 py-2"
                  >
                    <option value="ALL">All</option>
                    {SHAPE_TABS.map((x) => (
                      <option key={x.key} value={String(x.key).toUpperCase()}>
                        {x.label}
                      </option>
                    ))}
                    {meta.shapes
                      .filter((x) => !SHAPE_TABS.some((t) => String(t.key).toUpperCase() === x))
                      .map((x) => (
                        <option key={x} value={x}>
                          {x.replaceAll("_", " ")}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Price */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Price (₹)</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    inputMode="numeric"
                    className="w-full border rounded-2xl px-3 py-2"
                    placeholder="Min"
                  />
                  <input
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    inputMode="numeric"
                    className="w-full border rounded-2xl px-3 py-2"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCertOnly((v) => !v)}
                  className={`rounded-full border px-3 py-2 text-xs ${
                    certOnly ? "bg-black text-white" : "bg-white hover:bg-gray-50"
                  }`}
                >
                  Certified
                </button>
                <button
                  onClick={() => setInStockOnly((v) => !v)}
                  className={`rounded-full border px-3 py-2 text-xs ${
                    inStockOnly ? "bg-black text-white" : "bg-white hover:bg-gray-50"
                  }`}
                >
                  In Stock
                </button>
              </div>
            </div>
          </aside>

          {/* Content */}
          <section className="col-span-9">
            {/* Compact sort row */}
            <div className="rounded-3xl border bg-white p-4 flex items-center justify-between">
              <div className="text-xs text-gray-600">
                {busy ? "Loading…" : `Showing ${sorted.length} items`}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Sort</div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="border rounded-2xl px-3 py-2 text-sm"
                >
                  {SORT_OPTIONS.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Listing */}
            <div className="mt-4 pb-10">
              {busy ? (
                <div className="rounded-3xl border bg-white p-6 text-gray-600">Loading…</div>
              ) : (
                <RudrakshaGrid items={sorted} />
              )}
            </div>
          </section>
        </div>

        {/* Mobile mini header stays as-is below */}
        <div className="md:hidden mt-4">
          ...
        </div>

        {/* Mobile listing stays as-is */}
        <div className="md:hidden mt-5 pb-24">
          {busy ? (
            <div className="rounded-3xl border bg-white p-6 text-gray-600">Loading…</div>
          ) : (
            <RudrakshaGrid items={sorted} />
          )}
        </div>
      </div>


      {/* Mobile Footer Tabs */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t">
        <div className="max-w-6xl mx-auto px-3 py-2 grid grid-cols-4 gap-2">
          <button
            onClick={() => setOpenSheet("SEARCH")}
            className="rounded-2xl border px-2 py-2 text-xs bg-white"
          >
            🔎 Search
          </button>
          <button
            onClick={() => setOpenSheet("FILTER")}
            className="rounded-2xl border px-2 py-2 text-xs bg-white"
          >
            🧰 Filters {activeFilterCount ? `(${activeFilterCount})` : ""}
          </button>
          <button
            onClick={() => setOpenSheet("SORT")}
            className="rounded-2xl border px-2 py-2 text-xs bg-white"
          >
            ↕️ Sort
          </button>
          <a
            href="https://www.cityjeweller.in"
            className="rounded-2xl bg-black text-white px-2 py-2 text-xs text-center"
          >
            🏠 Home
          </a>
        </div>
      </div>

      {/* Bottom Sheet */}
      {openSheet && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpenSheet(null)}
          />
          <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl border-t p-4 max-h-[78vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-base font-semibold">
                {openSheet === "SEARCH" ? "Search" : openSheet === "FILTER" ? "Filters" : "Sort"}
              </div>
              <button
                onClick={() => setOpenSheet(null)}
                className="rounded-full border px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            {openSheet === "SEARCH" && (
              <div className="space-y-3">
                <div className="text-xs text-gray-500">Search by mukhi / origin / type / sku</div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full border rounded-2xl px-3 py-3"
                  placeholder="e.g. 5 mukhi / nepal / bracelet..."
                />
                <div className="text-xs text-gray-600">
                  {busy ? "Loading…" : `Showing ${sorted.length} items`}
                </div>
              </div>
            )}

            {openSheet === "SORT" && (
              <div className="space-y-2">
                {SORT_OPTIONS.map((x) => (
                  <button
                    key={x.key}
                    onClick={() => setSort(x.key)}
                    className={`w-full text-left rounded-2xl border px-4 py-3 ${
                      sort === x.key ? "bg-black text-white" : "bg-white"
                    }`}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            )}

            {openSheet === "FILTER" && (
              <div className="space-y-4">
                {/* Category */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Category</div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border rounded-2xl px-3 py-3"
                  >
                    <option value="ALL">All</option>
                    {PRODUCT_CATEGORY_TABS.map((x) => (
                      <option key={x.key} value={String(x.key).toUpperCase()}>
                        {x.label}
                      </option>
                    ))}
                    {meta.categories
                      .filter((x) => !PRODUCT_CATEGORY_TABS.some((t) => String(t.key).toUpperCase() === x))
                      .map((x) => (
                        <option key={x} value={x}>
                          {x.replaceAll("_", " ")}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Origin */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Origin</div>
                  <select
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full border rounded-2xl px-3 py-3"
                  >
                    <option value="ALL">All</option>
                    {ORIGIN_TABS.map((x) => (
                      <option key={x.key} value={String(x.key).toUpperCase()}>
                        {x.label}
                      </option>
                    ))}
                    {meta.origins
                      .filter((x) => !ORIGIN_TABS.some((t) => String(t.key).toUpperCase() === x))
                      .map((x) => (
                        <option key={x} value={x}>
                          {x.replaceAll("_", " ")}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Mukhi */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Mukhi</div>
                  <select
                    value={mukhi}
                    onChange={(e) => setMukhi(e.target.value)}
                    className="w-full border rounded-2xl px-3 py-3"
                  >
                    <option value="ALL">All</option>
                    {MUKHI_TABS.map((x) => (
                      <option key={x.key} value={String(x.key).toUpperCase()}>
                        {x.label}
                      </option>
                    ))}
                    {meta.mukhis
                      .filter((x) => !MUKHI_TABS.some((t) => String(t.key).toUpperCase() === x))
                      .map((x) => (
                        <option key={x} value={x}>
                          {x.replaceAll("_", " ")}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Wear */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Wear Type</div>
                  <select
                    value={wear}
                    onChange={(e) => setWear(e.target.value)}
                    className="w-full border rounded-2xl px-3 py-3"
                  >
                    <option value="ALL">All</option>
                    {WEAR_CHIPS.map((x) => (
                      <option key={x.key} value={String(x.key).toUpperCase()}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shape */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Shape</div>
                  <select
                    value={shape}
                    onChange={(e) => setShape(e.target.value)}
                    className="w-full border rounded-2xl px-3 py-3"
                  >
                    <option value="ALL">All</option>
                    {SHAPE_TABS.map((x) => (
                      <option key={x.key} value={String(x.key).toUpperCase()}>
                        {x.label}
                      </option>
                    ))}
                    {meta.shapes
                      .filter((x) => !SHAPE_TABS.some((t) => String(t.key).toUpperCase() === x))
                      .map((x) => (
                        <option key={x} value={x}>
                          {x.replaceAll("_", " ")}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Price */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Price Range (₹)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      inputMode="numeric"
                      className="w-full border rounded-2xl px-3 py-3"
                      placeholder="Min"
                    />
                    <input
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      inputMode="numeric"
                      className="w-full border rounded-2xl px-3 py-3"
                      placeholder="Max"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCertOnly((v) => !v)}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      certOnly ? "bg-black text-white" : "bg-white"
                    }`}
                  >
                    Certified Only
                  </button>
                  <button
                    onClick={() => setInStockOnly((v) => !v)}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      inStockOnly ? "bg-black text-white" : "bg-white"
                    }`}
                  >
                    In-Stock Only
                  </button>
                  <button
                    onClick={clearAll}
                    className="rounded-full border px-4 py-2 text-sm bg-white"
                  >
                    Clear All ({activeFilterCount})
                  </button>
                </div>

                <div className="text-xs text-gray-600">
                  {busy ? "Loading…" : `Showing ${sorted.length} items`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer SEO text block */}
      <div className="max-w-6xl mx-auto px-4 pb-10">
        <div className="rounded-3xl border bg-white p-5 text-sm text-gray-700 space-y-2">
          <div className="font-semibold">About Rudraksha Collection</div>
          <p className="text-xs sm:text-sm">
            Explore authentic Rudraksha beads and Rudraksha jewellery across popular categories like mala,
            bracelets, pendants and rings. Use mukhi and origin filters to quickly shortlist items for daily wear,
            spiritual japa, healing or gifting. Certification and stock availability help you decide with confidence.
          </p>
          <p className="text-xs text-gray-600">
            Looking for the main marketplace?{" "}
            <a className="underline" href="https://www.cityjeweller.in">
              Go to Cityjeweller.in Home
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

