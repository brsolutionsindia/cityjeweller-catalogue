"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getListing } from "@/lib/firebase/yellowSapphireDb";
import type { YellowSapphireListing } from "@/lib/yellowSapphire/types";

export default function Page() {
  const params = useParams();

  const rawSkuId = typeof params?.skuId === "string" ? params.skuId : "";
  const skuId = decodeURIComponent(rawSkuId);

  const [data, setData] = useState<YellowSapphireListing | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    // If route param missing (shouldn't happen, but TS + hydration can cause it)
    if (!skuId) {
      setBusy(false);
      setData(null);
      return;
    }

    const run = async () => {
      setBusy(true);
      try {
        const listing = await getListing(skuId);
        if (!listing || listing.status === "HIDDEN") setData(null);
        else setData(listing);
      } finally {
        setBusy(false);
      }
    };

    run();
  }, [skuId]);

  const waText = useMemo(() => {
    if (!data) return "";
    return `I am interested in Yellow Sapphire SKU ${data.skuId}. Please share availability and final price.`;
  }, [data]);

  const waLink = useMemo(() => {
    if (!waText) return "#";
    return `https://wa.me/?text=${encodeURIComponent(waText)}`;
  }, [waText]);

  if (busy) return <div className="p-6">Loading...</div>;
  if (!data) return <div className="p-6">Listing not found.</div>;

  const media = [
    ...(data.media?.images || []).map((m) => ({ ...m, kind: "image" as const })),
    ...(data.media?.videos || []).map((m) => ({ ...m, kind: "video" as const })),
  ].sort((a: any, b: any) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">Yellow Sapphire</div>
          <div className="text-2xl font-bold">{data.skuId}</div>
          <div className="text-sm text-gray-600 mt-1">
            {data.shapeCut} • {data.color} • {data.clarity} • {data.weightCarat} ct
          </div>
        </div>

        <a
          href={waLink}
          target="_blank"
          className="inline-flex items-center justify-center rounded-lg bg-black text-white px-4 py-2"
          rel="noreferrer"
        >
          WhatsApp Enquiry
        </a>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {media.map((m) => (
          <div
            key={(m as any).storagePath || (m as any).path || m.url}
            className="rounded-2xl border overflow-hidden bg-white shadow-sm"
          >
            {m.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt={data.skuId} className="w-full h-64 object-cover" />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={m.url} controls className="w-full h-64 object-cover" />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Weight:</span> <b>{data.weightCarat} ct</b></div>
          <div><span className="text-gray-500">Measurement:</span> <b>{data.measurementMm}</b></div>
          <div><span className="text-gray-500">Rate/Carat:</span> <b>₹{data.baseRatePerCaratInr}</b></div>
          <div><span className="text-gray-500">Certified:</span> <b>{data.certified}</b></div>
          <div><span className="text-gray-500">Treatment:</span> <b>{data.treatmentStatus}</b></div>
          <div><span className="text-gray-500">Origin:</span> <b>{data.origin}</b></div>
          <div><span className="text-gray-500">Luster:</span> <b>{data.luster}</b></div>          
        </div>

        {data.remarks && (
          <div className="mt-4 text-sm">
            <div className="text-gray-500">Remarks</div>
            <div className="mt-1">{data.remarks}</div>
          </div>
        )}
      </div>
    </div>
  );
}
