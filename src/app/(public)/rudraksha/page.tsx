"use client";

import { useEffect, useMemo, useState } from "react";
import { listPublicRudraksha } from "@/lib/firebase/rudrakshaPublicDb";
import RudrakshaGrid from "@/components/public/RudrakshaGrid";
import type { PublicRudraksha } from "@/lib/firebase/rudrakshaPublicDb";

function uniq(arr: string[]) { return Array.from(new Set(arr.filter(Boolean))); }

export default function RudrakshaListPage() {
  const [items, setItems] = useState<PublicRudraksha[]>([]);
  const [busy, setBusy] = useState(true);

  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [origin, setOrigin] = useState("ALL");
  const [mukhi, setMukhi] = useState("ALL");

  useEffect(() => {
    let alive = true;
    (async () => {
      setBusy(true);
      try {
        const arr = await listPublicRudraksha();
        if (alive) setItems(arr);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const getType = (x: any) => x.type ?? x.typeLegacy ?? x.productType ?? x.category ?? "";
  const getOrigin = (x: any) => x.origin ?? x.originLegacy ?? x.originNew ?? "";
  const getMukhi = (x: any) => x.mukhi ?? x.mukhiType ?? null;

  const meta = useMemo(() => {
    const types = uniq(items.map((x) => String(x.productCategory || "").toUpperCase()).filter(Boolean));
    const origins = uniq(items.map((x) => String(x.origin || "").toUpperCase()).filter(Boolean));
    const mukhis = uniq(items.map((x) => String(x.mukhiType ?? "")).filter(Boolean));
    return { types, origins, mukhis };
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((it) => {
      const t = String(getType(it) || "");
      const o = String(getOrigin(it) || "");
      const m = getMukhi(it);

      const text = `${it.skuId} ${t} ${o} ${m ?? ""}`.toLowerCase();
      if (s && !text.includes(s)) return false;

      if (type !== "ALL" && String(t).toUpperCase() !== type) return false;
      if (origin !== "ALL" && String(o).toUpperCase() !== origin) return false;
      if (mukhi !== "ALL" && String(m ?? "") !== mukhi) return false;
      return true;
    });
  }, [items, q, type, origin, mukhi]);


  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <div className="text-2xl font-bold">Rudraksha</div>
        <div className="text-sm text-gray-600">Authentic Rudraksha & Rudraksha Jewellery</div>
      </div>

      <div className="rounded-2xl border p-4 bg-white space-y-3">
        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <div className="text-xs text-gray-500 mb-1">Search</div>
            <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full border rounded-xl px-3 py-2" placeholder="mukhi / type / origin..." />
          </div>

          <div className="md:col-span-3">
            <div className="text-xs text-gray-500 mb-1">Type</div>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.types.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-3">
            <div className="text-xs text-gray-500 mb-1">Origin</div>
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.origins.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Mukhi</div>
            <select value={mukhi} onChange={(e) => setMukhi(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.mukhis.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>

        <div className="text-xs text-gray-500">{busy ? "Loading…" : `Showing ${filtered.length} items`}</div>
      </div>

      {busy ? (
        <div className="rounded-2xl border p-6 text-gray-600">Loading…</div>
      ) : (
        <RudrakshaGrid items={filtered} />
      )}
    </div>
  );
}
