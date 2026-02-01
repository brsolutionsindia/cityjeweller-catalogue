"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  getListing,
  getPrimaryImageUrl,
  getAllMedia,
  type PublicYellowSapphire,
} from "@/lib/firebase/yellowSapphireDb";
import type { YellowSapphireListing, MediaItem } from "@/lib/yellowSapphire/types";

export default function YellowSapphireDetailPage() {
  const params = useParams<{ skuId: string }>();
  const skuId = decodeURIComponent(params?.skuId ?? "").trim();

  const [item, setItem] = useState<YellowSapphireListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setNotFound(false);

        if (!skuId) {
          setNotFound(true);
          return;
        }

        const data = await getListing(skuId);

        if (!mounted) return;
        if (!data) {
          setNotFound(true);
          setItem(null);
          return;
        }

        setItem(data);
      } catch (e) {
        // If Firebase/client code throws, show not found-ish state
        if (mounted) {
          setNotFound(true);
          setItem(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [skuId]);

  const primary = getPrimaryImageUrl(item);
  const gallery = useMemo(() => getAllMedia(item), [item]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-8 text-gray-700">Loading…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="text-lg font-semibold">Item not found</div>
          <div className="mt-2 text-sm text-gray-600">SKU: {skuId || "—"}</div>
          <Link
            href="/gemstones/yellow-sapphire"
            className="mt-6 inline-flex rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Back to listings
          </Link>
        </div>
      </div>
    );
  }

  // safe: item is non-null here
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-sm text-gray-600">
        <Link href="/gemstones" className="hover:underline">Gemstones</Link> /{" "}
        <Link href="/gemstones/yellow-sapphire" className="hover:underline">Yellow Sapphire</Link> /{" "}
        <span className="text-gray-800">{item!.skuId}</span>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden">
            {primary ? (
              <Image src={primary} alt={item!.skuId} fill className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No image
              </div>
            )}
          </div>

          {gallery.length > 1 ? (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {gallery.slice(0, 8).map((m, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-50 border">
                  {m.type === "image" ? (
                    <Image src={m.url} alt={`${item!.skuId} ${idx + 1}`} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-500">
                      Video
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <div className="text-2xl font-semibold">Yellow Sapphire</div>
          <div className="text-sm text-gray-600">{item!.skuId}</div>

          <div className="mt-5 space-y-2 text-sm">
            <Row k="Shape/Cut" v={item!.shapeCut} />
            <Row k="Clarity" v={item!.clarity} />
            <Row k="Color" v={item!.color} />
            <Row k="Luster" v={item!.luster} />
            <Row k="Treatment" v={item!.treatmentStatus} />
            <Row k="Origin" v={item!.origin} />
            <Row k="Certified" v={item!.certified} />
            <Row k="Carat" v={Number.isFinite(item!.weightCarat) ? item!.weightCarat.toFixed(2) : "—"} />
            <Row k="Measurement" v={item!.measurementMm} />
            <Row k="Status" v={item!.status} />
          </div>

          {item!.remarks ? (
            <div className="mt-5 rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
              {item!.remarks}
            </div>
          ) : null}

          <Link
            href="/gemstones/yellow-sapphire"
            className="mt-6 inline-flex rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            ← Back
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-600">{k}</span>
      <span className="font-medium text-gray-900 text-right">{v ?? "—"}</span>
    </div>
  );
}
