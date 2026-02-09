"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getPublicRudrakshaBySku, pickDisplayPrice } from "@/lib/firebase/rudrakshaPublicDb";
import RudrakshaGallery from "@/components/public/RudrakshaGallery";

export default function RudrakshaProductPage() {
  const params = useParams<{ skuId: string }>();
  const skuId = useMemo(() => decodeURIComponent(String(params?.skuId || "")), [params]);

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!skuId) return;
      setBusy(true);
      try {
        const it = await getPublicRudrakshaBySku(skuId);
        if (alive) setData(it);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [skuId]);

  if (busy) return <div className="p-6">Loading…</div>;
  if (!data) return <div className="p-6">Not found.</div>;

  const price = pickDisplayPrice(data);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <Link href="/rudraksha" className="text-sm underline">← Back to Rudraksha</Link>

      <div className="grid md:grid-cols-2 gap-6">
        <RudrakshaGallery media={data.media} />

        <div className="space-y-3">
          <div className="text-2xl font-bold">
            {data.mukhi ? `${data.mukhi} Mukhi ` : ""}{data.type || "Rudraksha"}
          </div>
          <div className="text-sm text-gray-600">
            SKU: <b>{data.skuId}</b> • Origin: <b>{data.origin || "—"}</b>
          </div>

          <div className="text-3xl font-bold">
            {price ? `₹${Number(price).toLocaleString("en-IN")}` : "—"}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Mukhi</div>
              <div className="font-semibold">{data.mukhi || "—"}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Bead Size</div>
              <div className="font-semibold">{data.sizeMm ? `${data.sizeMm} mm` : "—"}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Material</div>
              <div className="font-semibold">{data.material || "—"}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Certified</div>
              <div className="font-semibold">{data.labCertified ? "Yes" : "—"}</div>
            </div>
          </div>

          {!!data.tags?.length && (
            <div className="text-sm text-gray-700">
              {data.tags.slice(0, 12).map((t: string) => (
                <span key={t} className="inline-block mr-2 text-xs border rounded-full px-2 py-1">
                  #{t}
                </span>
              ))}
            </div>
          )}

          <button className="w-full md:w-auto px-5 py-3 rounded-xl bg-black text-white">
            Enquire on WhatsApp
          </button>

          <div className="text-xs text-gray-500">
            Note: Product availability and price may change. Please confirm on WhatsApp.
          </div>
        </div>
      </div>
    </div>
  );
}
