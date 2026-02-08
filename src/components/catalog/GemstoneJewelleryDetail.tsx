"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getPublicGemstoneJewelleryBySku,
  pickDisplayPrice,
  type PublicGemstoneJewellery,
} from "@/lib/firebase/gemstoneJewelleryPublicDb";

const WHATSAPP_NUMBER = "919023130944";

function money(n: number | null) {
  if (n === null) return "-";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function asKind(m: any): "IMG" | "VID" {
  if (m?.kind === "IMG" || m?.kind === "VID") return m.kind;
  if (m?.type === "video") return "VID";
  return "IMG";
}

export default function GemstoneJewelleryDetail() {
  const params = useParams<{ skuId: string }>();
  const skuId = useMemo(() => decodeURIComponent((params?.skuId as string) || ""), [params]);

  const [busy, setBusy] = useState(true);
  const [data, setData] = useState<PublicGemstoneJewellery | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const it = await getPublicGemstoneJewelleryBySku(skuId);
        setData(it);
        setActiveIdx(0);
      } finally {
        setBusy(false);
      }
    })();
  }, [skuId]);

  const media = (Array.isArray((data as any)?.media) ? ((data as any).media as any[]) : []) as any[];
  const images = media
    .filter((m) => asKind(m) === "IMG")
    .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));
  const videos = media
    .filter((m) => asKind(m) === "VID")
    .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));

  const price = data ? pickDisplayPrice(data) : null;
  const title = data?.itemName || skuId;

  const stoneOrLook =
    String((data?.nature || "").toUpperCase()) === "ARTIFICIAL"
      ? (data?.lookName || "-")
      : (data?.stoneName || "-");

  const whatsappText = encodeURIComponent(
    `Hi! I am interested in ${title} (SKU: ${skuId}). Please share details.`
  );
  const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}`;

  if (busy) return <div className="p-6">Loading…</div>;
  if (!data) return <div className="p-6">Product not found.</div>;

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link href="/gemstone-jewellery" className="text-sm underline">
            ← Back to Gemstone Jewellery
          </Link>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-black text-white px-4 py-2 text-sm"
          >
            Enquire on WhatsApp
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="grid md:grid-cols-12 gap-6">
          {/* Gallery */}
          <div className="md:col-span-7 space-y-3">
            <div className="rounded-3xl border bg-gray-50 overflow-hidden">
              <div className="aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images?.[activeIdx]?.url || images?.[0]?.url || ""}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-auto pb-1">
                {images.map((m, idx) => (
                  <button
                    key={`${m.storagePath ?? m.url ?? "img"}-${idx}`}
                    onClick={() => setActiveIdx(idx)}
                    className={`w-24 h-20 rounded-2xl border overflow-hidden flex-shrink-0 ${
                      idx === activeIdx ? "ring-2 ring-black" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="thumb" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {videos.length > 0 && (
              <div className="rounded-3xl border p-4 space-y-3">
                <div className="font-semibold">Videos</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {videos.map((v, idx) => (
                    <div
                      key={`${v.storagePath ?? v.url ?? "vid"}-${idx}`}
                      className="rounded-2xl border overflow-hidden"
                    >
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video src={v.url} controls className="w-full h-56 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="md:col-span-5 space-y-4">
            {/* Title + chips */}
            <div className="rounded-3xl border p-5 bg-gradient-to-b from-slate-50 to-white">
              <div className="text-xs text-gray-500">SKU: <b>{skuId}</b></div>
              <div className="text-2xl md:text-3xl font-bold mt-2">{title}</div>

              <div className="flex flex-wrap gap-2 mt-4 text-xs">
                <span className="px-3 py-1 rounded-full border bg-white">
                  {(data.nature || "").toUpperCase() || "NATURE"}
                </span>
                <span className="px-3 py-1 rounded-full border bg-white">
                  {(data.type || "").toUpperCase() || "TYPE"}
                </span>
                <span className="px-3 py-1 rounded-full border bg-white">
                  {String(stoneOrLook).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Price card */}
            <div className="rounded-3xl border p-5 space-y-2">
              <div className="text-xs text-gray-500">Price</div>
              <div className="text-3xl font-bold">{money(price)}</div>

              {(data as any)?.offerPrice && (data as any)?.mrp && Number((data as any).mrp) > Number((data as any).offerPrice) && (
                <div className="text-sm text-gray-600">
                  <span className="line-through mr-2 text-gray-400">₹{Number((data as any).mrp).toLocaleString("en-IN")}</span>
                  <span className="text-green-600 font-semibold">
                    Save ₹{(Number((data as any).mrp) - Number((data as any).offerPrice)).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full justify-center rounded-2xl bg-black text-white px-4 py-3"
              >
                Enquire on WhatsApp
              </a>

              <div className="text-xs text-gray-500 mt-2">
                Need matching set / customization? Message us on WhatsApp.
              </div>
            </div>

            {/* Details */}
            <div className="rounded-3xl border p-5">
              <div className="font-semibold mb-3">Product details</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Nature:</span> <b>{data.nature || "-"}</b></div>
                <div><span className="text-gray-500">Type:</span> <b>{data.type || "-"}</b></div>
                <div className="col-span-2">
                  <span className="text-gray-500">Stone / Look:</span> <b>{stoneOrLook}</b>
                </div>
                <div><span className="text-gray-500">Material:</span> <b>{data.material || "-"}</b></div>
                <div><span className="text-gray-500">Closure:</span> <b>{(data as any).closure || "-"}</b></div>
                <div><span className="text-gray-500">Bead size:</span> <b>{(data as any).beadSizeMm ? `${(data as any).beadSizeMm} mm` : "-"}</b></div>
                <div><span className="text-gray-500">Length:</span> <b>{(data as any).lengthInch ? `${(data as any).lengthInch} inch` : "-"}</b></div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-2">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {(data.tags || []).length ? (data.tags || []).map((t, i) => (
                    <span key={`${t}-${i}`} className="text-xs px-3 py-1 rounded-full border">#{t}</span>
                  )) : <div className="text-sm text-gray-600">-</div>}
                </div>
              </div>
            </div>

            {/* Trust / shipping note (optional, looks premium) */}
            <div className="rounded-3xl border p-5 text-sm text-gray-600 bg-slate-50">
              Premium finish • Clear photos/videos • Quick support on WhatsApp
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky WhatsApp */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-white p-3">
        <a
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          className="w-full inline-flex justify-center rounded-2xl bg-black text-white px-4 py-3"
        >
          Enquire on WhatsApp
        </a>
      </div>
    </div>
  );
}
