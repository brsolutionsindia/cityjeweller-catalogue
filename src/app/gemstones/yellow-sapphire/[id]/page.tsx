"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getListing, getPrimaryImageUrl, getAllMedia } from "@/lib/firebase/yellowSapphireDb";
import type { YellowSapphireListing, MediaItem } from "@/lib/yellowSapphire/types";

const WHATSAPP_NUMBER = "919023130944";

const HELP_BANNER_SRC = "/brand/gemstone-help-banner.png";

// put these files in /public/placeholders/ (or replace with real generated images)
const HELP_IMG_1 = "/placeholders/help-authenticity.jpg";
const HELP_IMG_2 = "/placeholders/help-carat-guide.jpg";
const HELP_IMG_3 = "/placeholders/help-origin-compare.jpg";

// Standard return policy (edit anytime)
const STANDARD_RETURN_POLICY = [
  "7-day return window from the date of delivery.",
  "Item must be unused, in original condition, and with original packaging/certificates (if applicable).",
  "Customized / altered items are not eligible for return.",
  "Shipping/handling charges (if any) are non-refundable. Return shipping is borne by the customer unless the item is damaged/incorrect.",
  "Refund is processed after quality check within 5–7 business days of receiving the return.",
];

// #storySelling — redrafted with “label + benefit” format
const STORY_SELLING = [
  {
    label: "Financial Growth",
    text: "Traditionally linked with prosperity—helps attract better opportunities and steady progress.",
  },
  {
    label: "Good Health",
    text: "Believed to support vitality, confidence, and a positive mindset (traditional belief).",
  },
  {
    label: "Domestic Stability",
    text: "Associated with harmony at home and smoother relationships (traditional belief).",
  },
  {
    label: "Education & Focus",
    text: "Believed to strengthen clarity, learning, and decision-making for students and professionals.",
  },
];

export default function YellowSapphireDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id ?? "").trim();

  const [item, setItem] = useState<YellowSapphireListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // slider index
  const [activeIdx, setActiveIdx] = useState(0);

  // lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // video thumbnails dataURL
  const [videoThumbs, setVideoThumbs] = useState<Record<string, string>>({});

  // autoplay when landing on a video
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // swipe tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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

  const gallery = useMemo(() => {
    const all = getAllMedia(item);
    return [
      ...all.filter((m) => m.type === "image"),
      ...all.filter((m) => m.type === "video"),
    ];
  }, [item]);

  // Ensure primary image is included as first (if not already)
  const primary = getPrimaryImageUrl(item);
  const derivedGallery = useMemo(() => {
    if (!primary) return gallery;
    const hasPrimary = gallery.some((m) => m.type === "image" && m.url === primary);
    if (hasPrimary) return gallery;
    return [{ type: "image", url: primary } as MediaItem, ...gallery];
  }, [primary, gallery]);

  // keep active index valid
  useEffect(() => {
    if (activeIdx >= derivedGallery.length) setActiveIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedGallery.length]);

  const active = derivedGallery[activeIdx];

  // ---- computed display fields ----
  const caratNumber =
    typeof item?.weightCarat === "number" && Number.isFinite(item.weightCarat)
      ? item.weightCarat
      : null;

  const caratText = caratNumber != null ? caratNumber.toFixed(2) : "—";

  const titleLine = `Yellow Sapphire - ${caratText} Carats`;

  // ✅ Price: if no explicit price fields, compute publicRatePerCaratInr * weightCarat
  const priceText = formatPriceFromItem(item);

  const originText = item?.origin ? String(item.origin) : "—";

  // WhatsApp enquiry fixed to your number
  const enquiryText = encodeURIComponent(
    `Hi! I am interested in ${titleLine}.\nPrice: ${priceText}\nSKU/ID: ${sku}\nOrigin: ${originText}\nPlease share final offer and availability.`
  );
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${enquiryText}`;

  // Share
  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareTitle = `${titleLine} | ${sku}`;
    const text = `Check this Yellow Sapphire:\n${titleLine}\n${priceText}\nSKU: ${sku}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text, url });
        return;
      }
    } catch {
      return; // user cancelled
    }

    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    } catch {
      prompt("Copy this link:", url);
    }
  };

  // Prev/Next
  const goPrev = () =>
    setActiveIdx((p) => (p - 1 + derivedGallery.length) % derivedGallery.length);
  const goNext = () => setActiveIdx((p) => (p + 1) % derivedGallery.length);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightboxOpen) return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedGallery.length, lightboxOpen]);

  // ✅ Autoplay when user swipes to a video
  // Note: autoplay can be blocked if not muted; we start muted, user can unmute.
  useEffect(() => {
    if (!active || active.type !== "video") return;
    const t = window.setTimeout(() => {
      const v = videoRef.current;
      if (!v) return;
      v.play().catch(() => {});
    }, 120);
    return () => window.clearTimeout(t);
  }, [activeIdx, active?.type, active?.url]);

  // Swipe gestures on main viewer
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current;
    const sy = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (sx == null || sy == null) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    // ignore vertical scroll
    if (Math.abs(dy) > Math.abs(dx)) return;

    if (dx > 40) goPrev(); // swipe right -> previous
    if (dx < -40) goNext(); // swipe left -> next
  };

  // ✅ Generate video thumbnails for thumb strip + poster on main video
  useEffect(() => {
    const vids = derivedGallery.filter((m) => m.type === "video");
    if (!vids.length) return;

    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        vids.map(async (m) => {
          if (videoThumbs[m.url]) return [m.url, videoThumbs[m.url]] as const;
          try {
            const thumb = await generateVideoThumbnail(m.url);
            return [m.url, thumb] as const;
          } catch {
            return [m.url, ""] as const;
          }
        })
      );

      if (cancelled) return;

      setVideoThumbs((prev) => {
        const next = { ...prev };
        for (const [url, thumb] of entries) {
          if (thumb) next[url] = thumb;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedGallery]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-8 text-gray-700">Loading…</div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
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
    <div className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-600">
          <Link href="/gemstones" className="hover:underline">
            Gemstones
          </Link>{" "}
          /{" "}
          <Link href="/gemstones/yellow-sapphire" className="hover:underline">
            Yellow Sapphire
          </Link>{" "}
          / <span className="text-gray-900">{sku}</span>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          {/* LEFT: Slider */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="relative overflow-hidden rounded-2xl border bg-gray-50">
              <div
                className="relative aspect-square"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                {/* Arrows */}
                {derivedGallery.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-3 shadow hover:bg-white"
                      aria-label="Previous media"
                    >
                      <span className="text-lg leading-none">‹</span>
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-3 shadow hover:bg-white"
                      aria-label="Next media"
                    >
                      <span className="text-lg leading-none">›</span>
                    </button>
                  </>
                ) : null}

                {/* Counter */}
                {derivedGallery.length > 1 ? (
                  <div className="absolute bottom-3 right-3 z-20 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                    {activeIdx + 1}/{derivedGallery.length}
                  </div>
                ) : null}

                {/* Active media */}
                {active?.type === "video" ? (
                  <video
                    ref={videoRef}
                    key={active.url}
                    controls
                    preload="metadata"
                    playsInline
                    muted // helps autoplay succeed on mobile; user can unmute from controls
                    className="h-full w-full object-cover"
                    src={active.url}
                    poster={videoThumbs[active.url] || undefined}
                  />
                ) : active?.type === "image" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="absolute inset-0 z-10"
                      aria-label="Open image preview"
                    />
                    <Image
                      src={active.url}
                      alt={`Yellow Sapphire ${sku} - main`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      priority
                    />
                    <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                      Click to zoom
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    No media
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails (✅ videos show real thumbnails) */}
            {derivedGallery.length > 1 ? (
              <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-6">
                {derivedGallery.slice(0, 12).map((m, idx) => (
                  <ThumbSelectable
                    key={`${m.type}-${m.url}-${idx}`}
                    sku={sku}
                    m={m}
                    idx={idx}
                    active={idx === activeIdx}
                    onClick={() => setActiveIdx(idx)}
                    videoPoster={m.type === "video" ? videoThumbs[m.url] : undefined}
                  />
                ))}
              </div>
            ) : null}

            {/* Quick highlights */}
            <div className="mt-5 grid gap-2 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700 sm:grid-cols-2">
              <MiniStat label="Carat" value={caratText} />
              <MiniStat label="Origin" value={item.origin ?? "—"} />
              <MiniStat label="Treatment" value={item.treatmentStatus ?? "—"} />
              <MiniStat label="Certified" value={item.certified ?? "—"} />
            </div>
          </div>

          {/* RIGHT: Purchase panel */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-2xl font-semibold text-gray-900">{titleLine}</div>

                  <div className="mt-2 text-2xl font-semibold text-gray-900">{priceText}</div>

                  <div className="mt-2 text-sm text-gray-700">
                    <span className="font-semibold">SKU:</span>{" "}
                    <span className="font-medium">{sku}</span>{" "}
                    <span className="text-gray-400">•</span>{" "}
                    <span className="font-semibold">Origin:</span>{" "}
                    <span className="font-medium">{item.origin ?? "—"}</span>
                  </div>
                </div>

                <div className="shrink-0">
                  <StatusPill status={item.status} />
                </div>
              </div>

              {/* Payment methods */}
              <div className="mt-4 rounded-2xl border bg-gray-50 p-4 text-sm text-gray-800">
                <div className="font-semibold text-gray-900">Payment methods</div>
                <div className="mt-1">UPI, netbanking, bank transfer</div>
              </div>

              {/* #storySelling */}
              <div className="mt-4 rounded-2xl border bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">Why Yellow Sapphire?</div>
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  {STORY_SELLING.map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold">
                        ✓
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-900">{b.label}:</span>{" "}
                        <span>{b.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Note: These are traditional beliefs; results can vary person-to-person.
                </div>
              </div>

              {/* CTA + Share */}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 sm:col-span-2"
                >
                  WhatsApp Enquiry
                </a>

                <button
                  type="button"
                  onClick={onShare}
                  className="inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Share
                </button>
              </div>

              <div className="mt-3">
                <Link
                  href="/gemstones/yellow-sapphire"
                  className="inline-flex rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  ← Back to list
                </Link>
              </div>

              {/* Policies */}
              <div className="mt-6 grid gap-2 rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
                <PolicyLine title="Shipping" desc="PAN India delivery. Secure packaging." />
                <PolicyLine title="Return" desc="7-day return (standard policy below)" />
                <PolicyLine title="Support" desc="WhatsApp + call assistance" />
              </div>

              {/* Notes */}
              {item.remarks ? (
                <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-gray-700">
                  <div className="text-xs font-semibold text-gray-500">Notes</div>
                  <div className="mt-2 whitespace-pre-wrap">{item.remarks}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>


        <HelpBannerClickable
          imageSrc={HELP_BANNER_SRC}
          whatsappHref={whatsappHref}
          callHref={`tel:+${WHATSAPP_NUMBER}`}
        />


        {/* Lower sections */}
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionCard title="Product Details">
              <div className="grid gap-3 sm:grid-cols-2">
                <Spec k="Shape / Cut" v={item.shapeCut} />
                <Spec k="Color" v={item.color} />
                <Spec k="Clarity" v={item.clarity} />
                <Spec k="Luster" v={item.luster} />
                <Spec k="Treatment" v={item.treatmentStatus} />
                <Spec k="Certified" v={item.certified} />
                <Spec k="Origin" v={item.origin} />
                <Spec k="Measurement (mm)" v={item.measurementMm} />
                <Spec k="Weight (carat)" v={caratText} />
                <Spec k="Status" v={item.status} />
              </div>
            </SectionCard>

            <div className="mt-6 grid gap-6">
              <SectionCard title="Return Policy (Standard)">
                <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700">
                  {STANDARD_RETURN_POLICY.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </SectionCard>
            </div>
          </div>

          {/* Need help choosing */}
          <div>
            <div className="rounded-2xl border bg-gray-50 p-6">
              <div className="text-base font-semibold text-gray-900">Need help choosing?</div>
              <div className="mt-2 text-sm text-gray-700">
                Tell us your purpose (astrology / daily wear / investment), budget, preferred carat range and origin —
                we’ll shortlist the best options for you.
              </div>

              {/* Scroll-stopper photos */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <HelpImg src={HELP_IMG_1} alt="Authenticity check" />
                <HelpImg src={HELP_IMG_2} alt="Carat size guide" />
                <HelpImg src={HELP_IMG_3} alt="Origin comparison" />
              </div>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-gray-900"
              >
                Chat on WhatsApp
              </a>

              <div className="mt-4 text-xs text-gray-500">
                Sends SKU + origin + price context automatically.
              </div>
            </div>
          </div>
        </div>

        {/* Lightbox */}
        {lightboxOpen && active?.type === "image" ? (
          <Lightbox
            src={active.url}
            alt={`Yellow Sapphire ${sku} preview`}
            onClose={() => setLightboxOpen(false)}
            onPrev={() => setActiveIdx((p) => Math.max(0, p - 1))}
            onNext={() => setActiveIdx((p) => Math.min(derivedGallery.length - 1, p + 1))}
            disablePrev={activeIdx === 0}
            disableNext={activeIdx === derivedGallery.length - 1}
          />
        ) : null}
      </div>
    </div>
  );
}

/** ---------- UI components ---------- */

function HelpImg({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border bg-white">
      <Image src={src} alt={alt} fill className="object-cover" sizes="120px" />
    </div>
  );
}

function AmbassadorCard({ name, role, imgSrc }: { name: string; role: string; imgSrc: string }) {
  return (
    <div className="rounded-xl border bg-gray-50 p-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-white">
        <Image src={imgSrc} alt={name} fill className="object-cover" sizes="200px" />
      </div>
      <div className="mt-2 text-sm font-semibold text-gray-900">{name}</div>
      <div className="text-xs text-gray-600">{role}</div>
    </div>
  );
}

function ThumbSelectable({
  sku,
  m,
  idx,
  active,
  onClick,
  videoPoster,
}: {
  sku: string;
  m: MediaItem;
  idx: number;
  active: boolean;
  onClick: () => void;
  videoPoster?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative aspect-square overflow-hidden rounded-xl border bg-gray-50",
        active ? "ring-2 ring-black" : "hover:bg-gray-100",
      ].join(" ")}
      aria-label={`Select media ${idx + 1}`}
    >
      {m.type === "image" ? (
        <Image
          src={m.url}
          alt={`Yellow Sapphire ${sku} thumbnail ${idx + 1}`}
          fill
          className="object-cover"
          sizes="120px"
        />
      ) : (
        <>
          {/* IMPORTANT: <img> for dataURL thumbnails */}
          {videoPoster ? (
            <img
              src={videoPoster}
              alt={`Yellow Sapphire ${sku} video thumbnail ${idx + 1}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black text-xs font-semibold text-white">
              <span className="rounded-full bg-white/15 px-3 py-1">Video</span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="rounded-full bg-white/85 px-3 py-2 text-xs font-bold text-black">
              ▶
            </div>
          </div>
        </>
      )}
    </button>
  );
}

function StatusPill({ status }: { status: any }) {
  const s = String(status ?? "").toUpperCase();
  const isAvailable = s.includes("AVAIL") || s.includes("IN STOCK") || s.includes("AVAILABLE");
  return (
    <div
      className={[
        "rounded-full px-3 py-1 text-xs font-semibold",
        isAvailable ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700",
      ].join(" ")}
    >
      {status ?? "—"}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900 text-right">{value ?? "—"}</div>
    </div>
  );
}

function PolicyLine({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <div className="text-sm text-gray-700 text-right">{desc}</div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-6">
      <div className="text-lg font-semibold text-gray-900">{title}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-gray-50 px-4 py-3">
      <div className="text-sm font-medium text-gray-600">{k}</div>
      <div className="text-sm font-semibold text-gray-900 text-right">{v ?? "—"}</div>
    </div>
  );
}

function Lightbox({
  src,
  alt,
  onClose,
  onPrev,
  onNext,
  disablePrev,
  disableNext,
}: {
  src: string;
  alt: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  disablePrev: boolean;
  disableNext: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 p-4">
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="text-sm font-semibold text-white/90">Preview</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Close ✕
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden rounded-2xl bg-black">
          <Image src={src} alt={alt} fill className="object-contain" sizes="100vw" />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={disablePrev}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold",
              disablePrev ? "bg-white/10 text-white/40" : "bg-white/15 text-white hover:bg-white/20",
            ].join(" ")}
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={disableNext}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold",
              disableNext ? "bg-white/10 text-white/40" : "bg-white/15 text-white hover:bg-white/20",
            ].join(" ")}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function HelpBannerClickable({
  imageSrc,
  whatsappHref,
  callHref,
}: {
  imageSrc: string;
  whatsappHref: string;
  callHref: string;
}) {
  return (
      <div className="relative w-full overflow-hidden rounded-2xl border bg-white">
        {/* Responsive height (better than forcing aspect on mismatched images) */}
        <div className="relative h-[160px] sm:h-[200px] md:h-[240px] lg:h-[280px]">
          <Image
            src={imageSrc}
            alt="Find your perfect gemstone banner"
            fill
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 1024px"
            priority
          />

          {/* Clickable areas (transparent) */}
          {/* NOTE: Update these % once you re-render wide banner */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat on WhatsApp"
            className="absolute"
            style={{
              left: "63%",
              top: "72%",
              width: "16%",
              height: "18%",
            }}
          />

          <a
            href={callHref}
            aria-label="Call us"
            className="absolute"
            style={{
              left: "81%",
              top: "72%",
              width: "16%",
              height: "18%",
            }}
          />

          <style jsx>{`
            a[aria-label] {
              cursor: pointer;
            }
          `}</style>
        </div>
      </div>
  );
}



/** ---------- Price helpers ---------- */
/**
 * Supported patterns:
 * - offerPrice / price / finalPrice / sellingPrice
 * - mrp
 * - currency
 * - publicRatePerCaratInr * weightCarat  (your requirement)
 */
function formatPriceFromItem(item: any): string {
  if (!item) return "Price on request";

  const currency = String(item.currency ?? "INR");

  const offer =
    toNumber(item.offerPrice) ??
    toNumber(item.price) ??
    toNumber(item.finalPrice) ??
    toNumber(item.sellingPrice);

  const mrp = toNumber(item.mrp);

  if (offer != null && Number.isFinite(offer)) {
    return formatMoney(offer, currency);
  }
  if (mrp != null && Number.isFinite(mrp)) {
    return formatMoney(mrp, currency);
  }

  // ✅ Fallback: publicRatePerCaratInr * weightCarat
  const ratePerCarat = toNumber(item.publicRatePerCaratInr);
  const weightCarat = toNumber(item.weightCarat);

  if (ratePerCarat != null && weightCarat != null) {
    const computed = ratePerCarat * weightCarat;
    return formatMoney(computed, "INR");
  }

  return "Price on request";
}

function toNumber(v: any): number | null {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    const rounded = Math.round(amount);
    const num = rounded.toLocaleString();
    if (currency.toUpperCase() === "INR") return `Rs.${num}`;
    return `${currency} ${num}`;
  }
}

/** ---------- Video Thumbnail Generator ---------- */
/**
 * Captures a square frame (~0.2s) and returns a dataURL thumbnail.
 * Requires video URL to be CORS-allowed for canvas capture.
 */
function generateVideoThumbnail(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const seekTo = Math.min(0.2, Math.max(0, (video.duration || 1) * 0.02));
      try {
        video.currentTime = seekTo;
      } catch {
        video.currentTime = 0;
      }
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 360;
        canvas.height = 360;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas context");

        const vw = video.videoWidth || 1;
        const vh = video.videoHeight || 1;
        const side = Math.min(vw, vh);
        const sx = (vw - side) / 2;
        const sy = (vh - side) / 2;

        ctx.drawImage(video, sx, sy, side, side, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        cleanup();
        resolve(dataUrl);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("video load error"));
    };
  });
}
