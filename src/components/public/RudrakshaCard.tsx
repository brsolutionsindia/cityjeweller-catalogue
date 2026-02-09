"use client";

import Link from "next/link";
import type { PublicRudraksha } from "@/lib/firebase/rudrakshaPublicDb";
import { pickCoverUrl, pickDisplayPrice } from "@/lib/firebase/rudrakshaPublicDb";

export default function RudrakshaCard({ it }: { it: PublicRudraksha }) {
  const cover = pickCoverUrl(it.media);
  const price = pickDisplayPrice(it);

  return (
    <Link href={`/rudraksha/${encodeURIComponent(it.skuId)}`} className="rounded-2xl border overflow-hidden hover:shadow-sm bg-white">
      <div className="aspect-square bg-gray-50 border-b overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={cover} alt={it.skuId} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">No Image</div>}
      </div>

      <div className="p-3 space-y-1">
        <div className="text-sm font-semibold line-clamp-2">
          {it.mukhiType ? `${it.mukhiType} Mukhi ` : ""}{it.productCategory || "Rudraksha"}

        </div>
        <div className="text-xs text-gray-500">{it.origin || ""} • {it.skuId}</div>
        <div className="pt-1 text-sm font-bold">{price ? `₹${price.toLocaleString("en-IN")}` : "—"}</div>
      </div>
    </Link>
  );
}
