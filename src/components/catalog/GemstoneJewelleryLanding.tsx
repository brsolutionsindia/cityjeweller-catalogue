"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listPublicGemstoneJewellery,
  pickCoverUrl,
  pickDisplayPrice,
  type PublicGemstoneJewellery,
} from "@/lib/firebase/gemstoneJewelleryPublicDb";

const SORTS = [
  { key: "new", label: "Newest" },
  { key: "plh", label: "Price: Low → High" },
  { key: "phl", label: "Price: High → Low" },
] as const;

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}
function toNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function money(n: number | null) {
  if (n === null) return "-";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function GemstoneJewelleryLanding() {
  const [busy, setBusy] = useState(true);
  const [all, setAll] = useState<PublicGemstoneJewellery[]>([]);

  // filters
  const [q, setQ] = useState("");
  const [nature, setNature] = useState<string>("ALL");
  const [type, setType] = useState<string>("ALL");
  const [stoneOrLook, setStoneOrLook] = useState<string>("ALL");
  const [material, setMaterial] = useState<string>("ALL");
  const [tag, setTag] = useState<string>("ALL");
  const [minP, setMinP] = useState<string>("");
  const [maxP, setMaxP] = useState<string>("");

  // sort
  const [sortKey, setSortKey] = useState<(typeof SORTS)[number]["key"]>("new");

  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const arr = await listPublicGemstoneJewellery();
        setAll(arr);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const meta = useMemo(() => {
    const natures = uniq(all.map((x) => (x.nature || "").toUpperCase()).filter(Boolean));
    const types = uniq(all.map((x) => (x.type || "").toUpperCase()).filter(Boolean));
    const materials = uniq(all.map((x) => (x.material || "").toUpperCase()).filter(Boolean));

    const stones = uniq(
      all
        .map((x) =>
          (String((x.nature || "").toUpperCase()) === "ARTIFICIAL"
            ? (x.lookName || "")
            : (x.stoneName || "")
          ).toUpperCase()
        )
        .filter(Boolean)
    );

    const tags = uniq((all.flatMap((x) => x.tags || []) as string[]).map((t) => String(t).toLowerCase()));
    return { natures, types, materials, stones, tags };
  }, [all]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const min = minP ? Number(minP) : null;
    const max = maxP ? Number(maxP) : null;

    let arr = all.filter((it) => {
      const price = pickDisplayPrice(it);

      const text =
        `${it.skuId} ${it.itemName || ""} ${(it.stoneName || "")} ${(it.lookName || "")} ${(it.material || "")} ${(it.type || "")}`.toLowerCase();
      if (s && !text.includes(s)) return false;

      if (nature !== "ALL" && String(it.nature || "").toUpperCase() !== nature) return false;
      if (type !== "ALL" && String(it.type || "").toUpperCase() !== type) return false;

      if (stoneOrLook !== "ALL") {
        const v = String(
          (String((it.nature || "").toUpperCase()) === "ARTIFICIAL" ? it.lookName : it.stoneName) || ""
        ).toUpperCase();
        if (v !== stoneOrLook) return false;
      }

      if (material !== "ALL" && String(it.material || "").toUpperCase() !== material) return false;

      if (tag !== "ALL") {
        const tags = (it.tags || []).map((t) => String(t).toLowerCase());
        if (!tags.includes(tag)) return false;
      }

      if (min !== null && price !== null && price < min) return false;
      if (max !== null && price !== null && price > max) return false;

      return true;
    });

    // sort
    if (sortKey === "plh") {
      arr = arr.sort((a, b) => toNum(pickDisplayPrice(a)) - toNum(pickDisplayPrice(b)));
    } else if (sortKey === "phl") {
      arr = arr.sort((a, b) => toNum(pickDisplayPrice(b)) - toNum(pickDisplayPrice(a)));
    } else {
      arr = arr.sort((a, b) => toNum(b.updatedAt) - toNum(a.updatedAt) || toNum(b.createdAt) - toNum(a.createdAt));
    }

    return arr;
  }, [all, q, nature, type, stoneOrLook, material, tag, minP, maxP, sortKey]);

  function reset() {
    setQ("");
    setNature("ALL");
    setType("ALL");
    setStoneOrLook("ALL");
    setMaterial("ALL");
    setTag("ALL");
    setMinP("");
    setMaxP("");
    setSortKey("new");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero (more premium) */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="rounded-3xl border overflow-hidden bg-gradient-to-r from-slate-50 via-white to-slate-50">
            <div className="p-6 md:p-10">
              <div className="text-xs tracking-wide text-gray-500 uppercase">
                CityJeweller • Gemstone Jewellery
              </div>
              <h1 className="text-3xl md:text-5xl font-bold mt-3 leading-tight">
                Gemstone Jewellery Collection
              </h1>
              <p className="text-gray-600 mt-3 max-w-2xl">
                Discover statement gemstone pieces. Filter by type, stone/look, material and budget — then enquire instantly on WhatsApp.
              </p>

              <div className="flex flex-wrap gap-2 mt-6 text-xs">
                <span className="px-3 py-1 rounded-full border bg-white">Handpicked designs</span>
                <span className="px-3 py-1 rounded-full border bg-white">Fast enquiry on WhatsApp</span>
                <span className="px-3 py-1 rounded-full border bg-white">Premium finish & detailing</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Filters */}
        <aside className="md:col-span-3">
          <div className="rounded-3xl border p-4 md:p-5 sticky top-4 space-y-4 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Filters</div>
              <button className="text-xs underline text-gray-600" onClick={reset}>
                Reset
              </button>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Search</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full border rounded-2xl px-3 py-2 focus:outline-none"
                placeholder="SKU / name / stone..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Min Price</div>
                <input
                  value={minP}
                  onChange={(e) => setMinP(e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                  placeholder="0"
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Max Price</div>
                <input
                  value={maxP}
                  onChange={(e) => setMaxP(e.target.value)}
                  className="w-full border rounded-2xl px-3 py-2"
                  placeholder="50000"
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Nature</div>
              <select value={nature} onChange={(e) => setNature(e.target.value)} className="w-full border rounded-2xl px-3 py-2">
                <option value="ALL">All</option>
                {meta.natures.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Type</div>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-2xl px-3 py-2">
                <option value="ALL">All</option>
                {meta.types.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Stone / Look</div>
              <select value={stoneOrLook} onChange={(e) => setStoneOrLook(e.target.value)} className="w-full border rounded-2xl px-3 py-2">
                <option value="ALL">All</option>
                {meta.stones.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
              <div className="text-[11px] text-gray-500 mt-1">
                Natural → stoneName, Artificial → lookName
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Material</div>
              <select value={material} onChange={(e) => setMaterial(e.target.value)} className="w-full border rounded-2xl px-3 py-2">
                <option value="ALL">All</option>
                {meta.materials.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Tag</div>
              <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-full border rounded-2xl px-3 py-2">
                <option value="ALL">All</option>
                {meta.tags.map((x) => (
                  <option key={x} value={x}>#{x}</option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        {/* Results */}
        <main className="md:col-span-9 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              {busy ? "Loading…" : <>Showing <b>{filtered.length}</b> items</>}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500">Sort</div>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} className="border rounded-2xl px-3 py-2">
                {SORTS.map((x) => (
                  <option key={x.key} value={x.key}>{x.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((it) => {
              const cover = pickCoverUrl(it.media as any);
              const price = pickDisplayPrice(it);

              const natureBadge = String(it.nature || "").toUpperCase();
              const typeBadge = String(it.type || "").toUpperCase();

              const stoneBadge =
                String((it.nature || "").toUpperCase()) === "ARTIFICIAL"
                  ? String(it.lookName || "").toUpperCase()
                  : String(it.stoneName || "").toUpperCase();

              return (
                <Link
                  key={it.skuId}
                  href={`/gemstone-jewellery/${encodeURIComponent(it.skuId)}`}
                  className="group rounded-3xl border hover:shadow-md transition bg-white overflow-hidden"
                >
                  <div className="relative">
                    <div className="aspect-[4/3] bg-gray-50 border-b flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {cover ? (
                        <img
                          src={cover}
                          alt={it.itemName || it.skuId}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition"
                        />
                      ) : (
                        <div className="text-xs text-gray-500">No Image</div>
                      )}
                    </div>

                    {/* subtle badges */}
                    <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                      {natureBadge && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-white/90 border">
                          {natureBadge}
                        </span>
                      )}
                      {stoneBadge && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-white/90 border">
                          {stoneBadge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">{it.skuId}</div>
                      <div className="text-[10px] px-2 py-1 rounded-full border text-gray-600">
                        {typeBadge || "ITEM"}
                      </div>
                    </div>

                    <div className="font-semibold leading-snug line-clamp-2 text-[15px]">
                      {it.itemName || "Untitled"}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-lg font-bold">{money(price)}</div>
                      <div className="text-xs text-gray-500">
                        {(it.material || "").toUpperCase()}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {(it.tags || []).slice(0, 4).map((t, idx) => (
                        <span key={`${t}-${idx}`} className="text-[11px] px-2 py-1 rounded-full border text-gray-600">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {!busy && filtered.length === 0 && (
            <div className="rounded-3xl border p-6 text-sm text-gray-600">
              No products matched your filters. Try resetting filters.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
