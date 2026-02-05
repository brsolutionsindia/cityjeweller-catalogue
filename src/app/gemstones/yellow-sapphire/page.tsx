// src/app/gemstones/yellow-sapphire/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PublicListingStatus } from "@/lib/yellowSapphire/types";
import {
  fetchAllPublicListings,
  getPrimaryImageItem, // ✅ bring back what was working earlier
  getTotalPriceInr,
  type PublicYellowSapphire,
} from "@/lib/firebase/yellowSapphireDb";

type SortKey = "totalDesc" | "totalAsc" | "newest" | "caratAsc" | "caratDesc";

function clampNum(v: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function clampStr(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim();
}

function SectionTitle({
  kicker,
  title,
  desc,
}: {
  kicker?: string;
  title: string;
  desc?: string;
}) {
  return (
    <div>
      {kicker ? (
        <div className="text-xs font-semibold tracking-wider text-amber-700">
          {kicker.toUpperCase()}
        </div>
      ) : null}
      <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
        {title}
      </div>
      {desc ? (
        <div className="mt-2 text-sm leading-6 text-gray-600">{desc}</div>
      ) : null}
    </div>
  );
}

/**
 * Origin (do NOT use remarks/measurement/local sku).
 * Keep only clean explicit fields.
 */
function getOriginDisplay(item: any): string {
  const direct = clampStr(item?.origin);
  if (direct) return direct;

  const maybe = clampStr(item?.originText) || clampStr(item?.source) || "";
  return maybe;
}

/**
 * ✅ Image URLs:
 * - Primary image from existing helper (what was working earlier)
 * - Secondary from common media arrays (best-effort)
 */
function getSecondaryImageUrl(item: any): string | null {
  // common media arrays
  const mediaArr: any[] = Array.isArray(item?.media) ? item.media : [];
  for (const m of mediaArr) {
    const url = clampStr(m?.url || m?.downloadUrl);
    const kind = clampStr(m?.kind || m?.type || m?.mediaType);
    if (!url) continue;
    // ignore videos
    if (kind && (kind.toUpperCase().includes("VID") || kind.toLowerCase().includes("video"))) continue;
    return url;
  }

  const itemsArr: any[] = Array.isArray(item?.items) ? item.items : [];
  for (const it of itemsArr) {
    const url = clampStr(it?.url || it?.downloadUrl);
    const kind = clampStr(it?.kind || it?.type || it?.mediaType);
    if (!url) continue;
    if (kind && (kind.toUpperCase().includes("VID") || kind.toLowerCase().includes("video"))) continue;
    return url;
  }

  const photosArr: any[] = Array.isArray(item?.photos) ? item.photos : [];
  for (const p of photosArr) {
    const url = clampStr(p?.url || p?.downloadUrl);
    if (url) return url;
  }

  return null;
}

function Card({ item }: { item: PublicYellowSapphire }) {
  // ✅ primary: revert to known working helper
  const primary = getPrimaryImageItem(item)?.url || null;

  // ✅ secondary: pick another image (skip if same as primary)
  const secondaryRaw = getSecondaryImageUrl(item as any);
  const secondary = secondaryRaw && secondaryRaw !== primary ? secondaryRaw : null;

  const total = getTotalPriceInr(item);
  const origin = getOriginDisplay(item as any);

  return (
    <Link
      href={`/gemstones/yellow-sapphire/${encodeURIComponent(item.id)}`}
      className="group rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md overflow-hidden"
    >
      <div className="relative aspect-square bg-gray-50">
        {primary ? (
          <>
            <Image
              src={primary}
              alt={item.skuId}
              fill
              className={[
                "object-cover transition duration-300",
                secondary ? "group-hover:opacity-0" : "group-hover:scale-[1.02]",
              ].join(" ")}
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            {secondary ? (
              <Image
                src={secondary}
                alt={item.skuId}
                fill
                className="object-cover opacity-0 transition duration-300 group-hover:opacity-100"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            ) : null}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No image
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="text-sm font-semibold text-gray-900">
          Yellow Sapphire{" "}
          <span className="font-medium text-gray-700">
            –{" "}
            {Number.isFinite(item.weightCarat)
              ? item.weightCarat.toFixed(2)
              : "—"}{" "}
            Carats
          </span>
        </div>

        <div className="mt-1 text-xs text-gray-600">sku: {item.skuId}</div>

        {origin ? (
          <div className="mt-2 text-xs text-gray-700">
            <span className="text-gray-500">Origin :</span>{" "}
            <span className="font-medium">{origin}</span>
          </div>
        ) : null}

        <div className="mt-2 text-sm font-semibold text-gray-900">
          {total != null
            ? `Rs.${new Intl.NumberFormat("en-IN", {
                maximumFractionDigits: 0,
              }).format(total)}`
            : "Rs.—"}
        </div>
      </div>
    </Link>
  );
}

/**
 * ✅ Wrapper required by Next.js:
 * useSearchParams() must be inside a Suspense boundary.
 */
export default function YellowSapphireListingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="rounded-3xl border bg-white p-8 text-center text-gray-700">
            Loading…
          </div>
        </div>
      }
    >
      <YellowSapphireListingInner />
    </Suspense>
  );
}

function YellowSapphireListingInner() {
  const router = useRouter();
  const pathname = usePathname();
  const spUnsafe = useSearchParams();
  const sp = spUnsafe ?? new URLSearchParams();

  const [all, setAll] = useState<PublicYellowSapphire[]>([]);
  const [loading, setLoading] = useState(true);

  // URL params
  const q = sp.get("q") ?? "";
  const clarity = sp.get("clarity") ?? "";
  const color = sp.get("color") ?? "";
  const luster = sp.get("luster") ?? "";
  const status = (sp.get("status") as PublicListingStatus) ?? "AVAILABLE";
  const minCarat = clampNum(sp.get("minCarat"));
  const maxCarat = clampNum(sp.get("maxCarat"));

  // ✅ default sort: total price High -> Low
  const sort = (sp.get("sort") as SortKey) ?? "totalDesc";

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    48,
    Math.max(12, parseInt(sp.get("pageSize") ?? "24", 10) || 24)
  );

  // Mobile sheets
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchAllPublicListings();
        if (!mounted) return;
        setAll(data.filter((x) => !!x.approvedAt));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function updateQuery(next: Record<string, string | number | null | undefined>) {
    const params = new URLSearchParams(sp.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") params.delete(k);
      else params.set(k, String(v));
    });
    if (!("page" in next)) params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  }

  const opts = useMemo(() => {
    const uniq = (arr: string[]) =>
      Array.from(new Set(arr)).filter(Boolean).sort();
    return {
      clarity: uniq(all.map((x) => x.clarity)),
      color: uniq(all.map((x) => x.color)),
      luster: uniq(all.map((x) => x.luster)),
      status: ["AVAILABLE", "HOLD", "SOLD", "HIDDEN"] as PublicListingStatus[],
    };
  }, [all]);

  const filteredSorted = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase();
    const qTrim = q.trim();
    const qNum = qTrim ? Number(qTrim) : NaN;
    const qHasNum = qTrim !== "" && Number.isFinite(qNum);

    let list = [...all];

    // ✅ Search should work on SKU + carat weight
    if (qTrim) {
      const nq = norm(qTrim);
      list = list.filter((x) => {
        const skuMatch = norm(x.skuId).includes(nq);
        const caratMatch = qHasNum
          ? Math.abs((x.weightCarat ?? 0) - qNum) < 0.01 // matches 5.04 with small tolerance
          : false;
        return skuMatch || caratMatch;
      });
    }

    if (clarity) list = list.filter((x) => x.clarity === clarity);
    if (color) list = list.filter((x) => x.color === color);
    if (luster) list = list.filter((x) => x.luster === luster);
    if (status) list = list.filter((x) => x.status === status);

    if (minCarat != null) list = list.filter((x) => x.weightCarat >= minCarat);
    if (maxCarat != null) list = list.filter((x) => x.weightCarat <= maxCarat);

    const byNum = (a: number, b: number) => a - b;

    list.sort((a, b) => {
      switch (sort) {
        case "totalDesc":
          return byNum(
            getTotalPriceInr(b) ?? Number.NEGATIVE_INFINITY,
            getTotalPriceInr(a) ?? Number.NEGATIVE_INFINITY
          );
        case "totalAsc":
          return byNum(
            getTotalPriceInr(a) ?? Number.POSITIVE_INFINITY,
            getTotalPriceInr(b) ?? Number.POSITIVE_INFINITY
          );
        case "newest":
          return (
            Number(b.approvedAt || b.createdAt || 0) -
            Number(a.approvedAt || a.createdAt || 0)
          );
        case "caratAsc":
          return byNum(a.weightCarat, b.weightCarat);
        case "caratDesc":
          return byNum(b.weightCarat, a.weightCarat);
        default:
          return 0;
      }
    });

    return list;
  }, [all, q, clarity, color, luster, status, minCarat, maxCarat, sort]);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = filteredSorted.slice(start, start + pageSize);

  function clearAllFilters() {
    router.replace(
      `${pathname}?sort=${encodeURIComponent(sort)}&pageSize=${encodeURIComponent(
        pageSize
      )}`
    );
  }

  const FiltersPanel = (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-gray-700">
          Search by SKU or Carat
        </div>
        <input
          value={q}
          onChange={(e) => updateQuery({ q: e.target.value })}
          placeholder="e.g. GP-147009 or 5.04"
          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
        />
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-700">Status</div>
        <select
          value={status}
          onChange={(e) => updateQuery({ status: e.target.value })}
          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
        >
          {opts.status.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-700">Clarity</div>
        <select
          value={clarity}
          onChange={(e) => updateQuery({ clarity: e.target.value })}
          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
        >
          <option value="">All</option>
          {opts.clarity.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-700">Color</div>
        <select
          value={color}
          onChange={(e) => updateQuery({ color: e.target.value })}
          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
        >
          <option value="">All</option>
          {opts.color.map((v) => (
            <option key={v} value={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-700">Luster</div>
        <select
          value={luster}
          onChange={(e) => updateQuery({ luster: e.target.value })}
          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
        >
          <option value="">All</option>
          {opts.luster.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50/40 p-3">
        <div className="text-xs font-semibold text-gray-700">Carat range</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] font-medium text-gray-600">Min</div>
            <input
              value={minCarat ?? ""}
              onChange={(e) =>
                updateQuery({
                  minCarat: e.target.value ? Number(e.target.value) : null,
                })
              }
              inputMode="decimal"
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="1.00"
            />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-600">Max</div>
            <input
              value={maxCarat ?? ""}
              onChange={(e) =>
                updateQuery({
                  maxCarat: e.target.value ? Number(e.target.value) : null,
                })
              }
              inputMode="decimal"
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="10.00"
            />
          </div>
        </div>
      </div>

      <button
        onClick={clearAllFilters}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
      >
        Clear filters
      </button>
    </div>
  );

  return (
    <div className="bg-gradient-to-b from-amber-50/40 via-white to-white">
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-24 lg:pb-10">
        <div className="text-sm text-gray-600">
          <Link href="/gemstones" className="hover:underline">
            Gemstones
          </Link>{" "}
          <span className="text-gray-400">/</span> Yellow Sapphire
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-9">
            <SectionTitle
              kicker="Collection"
              title="Yellow Sapphire (Pukhraj)"
              desc="Browse approved Yellow Sapphire listings. Filter by clarity, color, luster, and carat."
            />
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-3xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-medium text-gray-500">Listings</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {loading ? "…" : total.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            {loading
              ? "Loading…"
              : `Showing ${pageItems.length.toLocaleString("en-IN")} of ${total.toLocaleString(
                  "en-IN"
                )}`}
          </div>

          <div className="hidden lg:flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-1">
              <select
                value={sort}
                onChange={(e) => updateQuery({ sort: e.target.value })}
                className="rounded-xl bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="totalDesc">Price: High → Low</option>
                <option value="totalAsc">Price: Low → High</option>
                <option value="newest">Newest</option>
                <option value="caratAsc">Carat: Low → High</option>
                <option value="caratDesc">Carat: High → Low</option>
              </select>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-1">
              <select
                value={pageSize}
                onChange={(e) => updateQuery({ pageSize: e.target.value })}
                className="rounded-xl bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="12">12 / page</option>
                <option value="24">24 / page</option>
                <option value="36">36 / page</option>
                <option value="48">48 / page</option>
              </select>
            </div>

            <button
              onClick={clearAllFilters}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Reset filters
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <aside className="hidden lg:block lg:col-span-3">
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sticky top-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Filters</div>
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-semibold text-amber-700 hover:underline"
                >
                  Reset
                </button>
              </div>
              <div className="mt-4">{FiltersPanel}</div>
            </div>
          </aside>

          <main className="lg:col-span-9">
            {loading ? (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-3xl border bg-white shadow-sm overflow-hidden"
                  >
                    <div className="aspect-square bg-gray-100 animate-pulse" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 w-2/3 bg-gray-100 animate-pulse rounded" />
                      <div className="h-3 w-1/2 bg-gray-100 animate-pulse rounded" />
                      <div className="h-10 w-full bg-gray-100 animate-pulse rounded-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pageItems.length === 0 ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
                <div className="text-sm font-semibold text-gray-900">
                  No results found
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  Try clearing filters or widening your ranges.
                </div>
                <button
                  onClick={clearAllFilters}
                  className="mt-5 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3">
                {pageItems.map((item) => (
                  <Card key={item.id} item={item} />
                ))}
              </div>
            )}

            {!loading && totalPages > 1 ? (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  Page{" "}
                  <span className="font-semibold text-gray-900">{safePage}</span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-900">
                    {totalPages}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={safePage <= 1}
                    onClick={() => updateQuery({ page: safePage - 1 })}
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-gray-50"
                  >
                    Prev
                  </button>
                  <button
                    disabled={safePage >= totalPages}
                    onClick={() => updateQuery({ page: safePage + 1 })}
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>

      {/* Mobile footer bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              setSortOpen(true);
              setFilterOpen(false);
            }}
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900"
          >
            Sort
          </button>
          <button
            onClick={() => {
              setFilterOpen(true);
              setSortOpen(false);
            }}
            className="flex-1 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Filters
          </button>
        </div>
      </div>

      {/* Mobile Sort Sheet */}
      {sortOpen ? (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/30"
            onClick={() => setSortOpen(false)}
            aria-label="Close"
          />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Sort</div>
              <button
                onClick={() => setSortOpen(false)}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold"
              >
                Done
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {[
                { k: "totalDesc", label: "Price: High → Low" },
                { k: "totalAsc", label: "Price: Low → High" },
                { k: "newest", label: "Newest" },
                { k: "caratAsc", label: "Carat: Low → High" },
                { k: "caratDesc", label: "Carat: High → Low" },
              ].map((opt) => (
                <button
                  key={opt.k}
                  onClick={() => {
                    updateQuery({ sort: opt.k });
                    setSortOpen(false);
                  }}
                  className={[
                    "w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold",
                    sort === opt.k
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-900",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 p-3">
              <div className="text-xs font-semibold text-gray-700">
                Items per page
              </div>
              <select
                value={pageSize}
                onChange={(e) => updateQuery({ pageSize: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="12">12 / page</option>
                <option value="24">24 / page</option>
                <option value="36">36 / page</option>
                <option value="48">48 / page</option>
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mobile Filter Sheet */}
      {filterOpen ? (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/30"
            onClick={() => setFilterOpen(false)}
            aria-label="Close"
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-auto rounded-t-3xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Filters</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAllFilters}
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold"
                >
                  Reset
                </button>
                <button
                  onClick={() => setFilterOpen(false)}
                  className="rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="mt-4">{FiltersPanel}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
