"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PublicListingStatus } from "@/lib/yellowSapphire/types";
import {
  fetchAllPublicListings,
  getPrimaryImageUrl,
  getPublicPricePerCaratInr,
  getTotalPriceInr,
  type PublicYellowSapphire,
} from "@/lib/firebase/yellowSapphireDb";

type SortKey =
  | "newest"
  | "baseRateAsc"
  | "baseRateDesc"
  | "publicRateAsc"
  | "publicRateDesc"
  | "totalAsc"
  | "totalDesc"
  | "caratAsc"
  | "caratDesc";

function formatINR(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function clampNum(v: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-700 bg-white">
      {children}
    </span>
  );
}

function Card({ item }: { item: PublicYellowSapphire }) {
  const img = getPrimaryImageUrl(item);
  const ppc = getPublicPricePerCaratInr(item);
  const total = getTotalPriceInr(item);

  return (
    <Link
      href={`/gemstones/yellow-sapphire/${encodeURIComponent(item.id)}`}
      className="rounded-2xl border bg-white shadow-sm transition hover:shadow-md overflow-hidden"
    >
      <div className="relative aspect-square bg-gray-50">
        {img ? (
          <Image
            src={img}
            alt={item.skuId}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No image
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Yellow Sapphire</div>
            <div className="text-xs text-gray-600">{item.skuId}</div>
          </div>
          {item.certified ? <Badge>{item.certified}</Badge> : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {item.color ? <Badge>{item.color.replaceAll("_", " ")}</Badge> : null}
          {item.clarity ? <Badge>{item.clarity}</Badge> : null}
          {item.luster ? <Badge>{item.luster}</Badge> : null}
          <Badge>{item.status}</Badge>
        </div>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Carat</span>
            <span className="font-medium">{Number.isFinite(item.weightCarat) ? item.weightCarat.toFixed(2) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Price/ct</span>
            <span className="font-medium">{formatINR(ppc)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total</span>
            <span className="font-semibold">{formatINR(total)}</span>
          </div>
        </div>

        <div className="mt-3 text-xs text-amber-700 font-medium">View details →</div>
      </div>
    </Link>
  );
}

export default function YellowSapphireListingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const spUnsafe = useSearchParams();
  const sp = spUnsafe ?? new URLSearchParams();

  const [all, setAll] = useState<PublicYellowSapphire[]>([]);
  const [loading, setLoading] = useState(true);

  // URL params
  const q = sp.get("q") ?? "";
  const certified = sp.get("certified") ?? "";
  const clarity = sp.get("clarity") ?? "";
  const color = sp.get("color") ?? "";
  const luster = sp.get("luster") ?? "";
  const status = (sp.get("status") as PublicListingStatus) ?? "AVAILABLE";
  const minPriceCt = clampNum(sp.get("minPpc"));
  const maxPriceCt = clampNum(sp.get("maxPpc"));
  const minCarat = clampNum(sp.get("minCarat"));
  const maxCarat = clampNum(sp.get("maxCarat"));
  const sort = (sp.get("sort") as SortKey) ?? "newest";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(48, Math.max(12, parseInt(sp.get("pageSize") ?? "24", 10) || 24));

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchAllPublicListings();
        if (!mounted) return;
        // Only show APPROVED listings (approvedAt exists) by default.
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
    const uniq = (arr: string[]) => Array.from(new Set(arr)).filter(Boolean).sort();
    return {
      certified: uniq(all.map((x) => x.certified)),
      clarity: uniq(all.map((x) => x.clarity)),
      color: uniq(all.map((x) => x.color)),
      luster: uniq(all.map((x) => x.luster)),
      status: ["AVAILABLE", "HOLD", "SOLD", "HIDDEN"] as PublicListingStatus[],
    };
  }, [all]);

  const filteredSorted = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase();
    let list = [...all];

    if (q.trim()) {
      const nq = norm(q);
      list = list.filter((x) => norm(x.skuId).includes(nq));
    }
    if (certified) list = list.filter((x) => x.certified === certified);
    if (clarity) list = list.filter((x) => x.clarity === clarity);
    if (color) list = list.filter((x) => x.color === color);
    if (luster) list = list.filter((x) => x.luster === luster);
    if (status) list = list.filter((x) => x.status === status);

    if (minCarat != null) list = list.filter((x) => x.weightCarat >= minCarat);
    if (maxCarat != null) list = list.filter((x) => x.weightCarat <= maxCarat);

    if (minPriceCt != null) list = list.filter((x) => (x.publicRatePerCaratInr ?? 0) >= minPriceCt);
    if (maxPriceCt != null) list = list.filter((x) => (x.publicRatePerCaratInr ?? Infinity) <= maxPriceCt);

    const byNum = (a: number, b: number) => a - b;

    list.sort((a, b) => {
      switch (sort) {
        case "newest":
          return (Number(b.approvedAt || b.createdAt || 0) - Number(a.approvedAt || a.createdAt || 0));
        case "baseRateAsc":
          return byNum(a.baseRatePerCaratInr, b.baseRatePerCaratInr);
        case "baseRateDesc":
          return byNum(b.baseRatePerCaratInr, a.baseRatePerCaratInr);
        case "publicRateAsc":
          return byNum(a.publicRatePerCaratInr, b.publicRatePerCaratInr);
        case "publicRateDesc":
          return byNum(b.publicRatePerCaratInr, a.publicRatePerCaratInr);
        case "caratAsc":
          return byNum(a.weightCarat, b.weightCarat);
        case "caratDesc":
          return byNum(b.weightCarat, a.weightCarat);
        case "totalAsc":
          return byNum(getTotalPriceInr(a) ?? Number.POSITIVE_INFINITY, getTotalPriceInr(b) ?? Number.POSITIVE_INFINITY);
        case "totalDesc":
          return byNum(getTotalPriceInr(b) ?? Number.NEGATIVE_INFINITY, getTotalPriceInr(a) ?? Number.NEGATIVE_INFINITY);
        default:
          return 0;
      }
    });

    return list;
  }, [all, q, certified, clarity, color, luster, status, minPriceCt, maxPriceCt, minCarat, maxCarat, sort]);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = filteredSorted.slice(start, start + pageSize);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="text-sm text-gray-600">
        <Link href="/gemstones" className="hover:underline">Gemstones</Link> / Yellow Sapphire
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Yellow Sapphire (Pukhraj)</div>
          <div className="text-sm text-gray-600">{loading ? "Loading…" : `${total.toLocaleString("en-IN")} items`}</div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select value={sort} onChange={(e) => updateQuery({ sort: e.target.value })} className="rounded-xl border bg-white px-3 py-2 text-sm">
            <option value="newest">Newest</option>
            <option value="publicRateAsc">Price/ct: Low → High</option>
            <option value="publicRateDesc">Price/ct: High → Low</option>
            <option value="caratAsc">Carat: Low → High</option>
            <option value="caratDesc">Carat: High → Low</option>
            <option value="totalAsc">Total: Low → High</option>
            <option value="totalDesc">Total: High → Low</option>
            <option value="baseRateAsc">Base/ct: Low → High</option>
            <option value="baseRateDesc">Base/ct: High → Low</option>
          </select>

          <select value={pageSize} onChange={(e) => updateQuery({ pageSize: e.target.value })} className="rounded-xl border bg-white px-3 py-2 text-sm">
            <option value="12">12 / page</option>
            <option value="24">24 / page</option>
            <option value="36">36 / page</option>
            <option value="48">48 / page</option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm sticky top-4">
            <div className="text-sm font-semibold">Filters</div>

            <div className="mt-4">
              <div className="text-xs font-medium text-gray-600">Search by SKU</div>
              <input
                value={q}
                onChange={(e) => updateQuery({ q: e.target.value })}
                placeholder="e.g. 8165YSAPPHIRER002"
                className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-gray-600">Status</div>
              <select value={status} onChange={(e) => updateQuery({ status: e.target.value })} className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm">
                {opts.status.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-gray-600">Certified</div>
              <select value={certified} onChange={(e) => updateQuery({ certified: e.target.value })} className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm">
                <option value="">All</option>
                {opts.certified.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-gray-600">Clarity</div>
              <select value={clarity} onChange={(e) => updateQuery({ clarity: e.target.value })} className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm">
                <option value="">All</option>
                {opts.clarity.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-gray-600">Color</div>
              <select value={color} onChange={(e) => updateQuery({ color: e.target.value })} className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm">
                <option value="">All</option>
                {opts.color.map((v) => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-gray-600">Luster</div>
              <select value={luster} onChange={(e) => updateQuery({ luster: e.target.value })} className="mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm">
                <option value="">All</option>
                {opts.luster.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-medium text-gray-600">Min Carat</div>
                <input
                  value={minCarat ?? ""}
                  onChange={(e) => updateQuery({ minCarat: e.target.value ? Number(e.target.value) : null })}
                  inputMode="decimal"
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="1.00"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600">Max Carat</div>
                <input
                  value={maxCarat ?? ""}
                  onChange={(e) => updateQuery({ maxCarat: e.target.value ? Number(e.target.value) : null })}
                  inputMode="decimal"
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="10.00"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-medium text-gray-600">Min Price/ct</div>
                <input
                  value={minPriceCt ?? ""}
                  onChange={(e) => updateQuery({ minPpc: e.target.value ? Number(e.target.value) : null })}
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="25000"
                />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600">Max Price/ct</div>
                <input
                  value={maxPriceCt ?? ""}
                  onChange={(e) => updateQuery({ maxPpc: e.target.value ? Number(e.target.value) : null })}
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="100000"
                />
              </div>
            </div>

            <button
              onClick={() => router.replace(`${pathname}?sort=${encodeURIComponent(sort)}&pageSize=${encodeURIComponent(pageSize)}`)}
              className="mt-5 w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Clear filters
            </button>
          </div>
        </aside>

        <main className="lg:col-span-9">
          {loading ? (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                  <div className="aspect-square bg-gray-100 animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-2/3 bg-gray-100 animate-pulse rounded" />
                    <div className="h-3 w-1/2 bg-gray-100 animate-pulse rounded" />
                    <div className="h-8 w-full bg-gray-100 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : pageItems.length === 0 ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-gray-700">
              No results found. Try clearing filters.
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3">
              {pageItems.map((item) => (
                <Card key={item.id} item={item} />
              ))}
            </div>
          )}

          {!loading && totalPages > 1 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                Page <span className="font-medium">{safePage}</span> of{" "}
                <span className="font-medium">{totalPages}</span>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={safePage <= 1}
                  onClick={() => updateQuery({ page: safePage - 1 })}
                  className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-gray-50"
                >
                  Prev
                </button>
                <button
                  disabled={safePage >= totalPages}
                  onClick={() => updateQuery({ page: safePage + 1 })}
                  className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
