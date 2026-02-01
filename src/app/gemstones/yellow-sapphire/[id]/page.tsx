"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  getListing,
  getPrimaryImageUrl,
  getAllMedia,
} from "@/lib/firebase/yellowSapphireDb";
import type { YellowSapphireListing, MediaItem } from "@/lib/yellowSapphire/types";

export default function YellowSapphireDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id ?? "").trim();

  const [item, setItem] = useState<YellowSapphireListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setNotFound(false);

        if (!id) {
          setNotFound(true);
          setItem(null);
          return;
        }

        const data = await getListing(id);

        if (!mounted) return;

        if (!data) {
          setNotFound(true);
          setItem(null);
          return;
        }

        setItem(data);
      } catch {
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
  }, [id]);

  const sku = item?.skuId || id || "—";
  const primary = getPrimaryImageUrl(item);

  const gallery = useMemo(() => {
    const all = getAllMedia(item);
    // Ensure stable ordering: images first, then videos
    return [
      ...all.filter((m) => m.type === "image"),
      ...all.filter((m) => m.type === "video"),
    ];
  }, [item]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-8 text-gray-700">
          Loading…
        </div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="text-lg font-semibold">Item not found</div>
          <div className="mt-2 text-sm text-gray-600">SKU: {sku}</div>
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-sm text-gray-600">
        <Link href="/gemstones" className="hover:underline">
          Gemstones
        </Link>{" "}
        /{" "}
        <Link href="/gemstones/yellow-sapphire" className="hover:underline">
          Yellow Sapphire
        </Link>{" "}
        / <span className="text-gray-800">{sku}</span>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* LEFT: Media */}
        <div className="rounded-2xl border bg-white p-4">
          {/* Primary */}
          <div className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden">
            {primary ? (
              <Image
                src={primary}
                alt={`Yellow Sapphire ${sku}`}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No image
              </div>
            )}
          </div>

          {/* Thumbs */}
          {gallery.length > 1 ? (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {gallery.slice(0, 8).map((m, idx) => (
                <Thumb key={idx} sku={sku} m={m} idx={idx} />
              ))}
            </div>
          ) : null}

          {/* Videos section (actual videos) */}
          {gallery.some((m) => m.type === "video") ? (
            <div className="mt-6">
              <div className="text-sm font-semibold">Videos</div>
              <div className="mt-3 grid gap-3">
                {gallery
                  .filter((m) => m.type === "video")
                  .slice(0, 4)
                  .map((m, idx) => (
                    <div
                      key={`vid-${idx}`}
                      className="rounded-xl border bg-black overflow-hidden"
                    >
                      <video
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full h-auto"
                        src={m.url}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* RIGHT: Details */}
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-2xl font-semibold">Yellow Sapphire</div>
          <div className="text-sm text-gray-600">{sku}</div>

          <div className="mt-5 space-y-2 text-sm">
            <Row k="Shape/Cut" v={item.shapeCut} />
            <Row k="Clarity" v={item.clarity} />
            <Row k="Color" v={item.color} />
            <Row k="Luster" v={item.luster} />
            <Row k="Treatment" v={item.treatmentStatus} />
            <Row k="Origin" v={item.origin} />
            <Row k="Certified" v={item.certified} />
            <Row
              k="Carat"
              v={
                Number.isFinite(item.weightCarat)
                  ? item.weightCarat.toFixed(2)
                  : "—"
              }
            />
            <Row k="Measurement" v={item.measurementMm} />
            <Row k="Status" v={item.status} />
          </div>

          {item.remarks ? (
            <div className="mt-5 rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
              {item.remarks}
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

function Thumb({ sku, m, idx }: { sku: string; m: MediaItem; idx: number }) {
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-50 border">
      {m.type === "image" ? (
        <Image
          src={m.url}
          alt={`Yellow Sapphire ${sku} image ${idx + 1}`}
          fill
          className="object-cover"
          sizes="120px"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-gray-600 bg-gray-100">
          Video
        </div>
      )}
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
