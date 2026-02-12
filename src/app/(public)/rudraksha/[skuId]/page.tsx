// src/app/(public)/rudraksha/[skuId]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  getPublicRudrakshaBySku,
  listPublicRudraksha,
  pickCoverUrl,
  pickDisplayPrice,
  pickMrpPrice,
  formatINR,
  type PublicRudraksha,
} from "@/lib/firebase/rudrakshaPublicDb";

import RudrakshaGallery from "@/components/public/RudrakshaGallery";
import RudrakshaJsonLd from "@/components/public/RudrakshaJsonLd";

/**
 * Fallback lifestyle/hero photos (replace with your own hosted images anytime).
 * Tip: Prefer local images in /public for speed + consistent brand look.
 */
const FALLBACK_IMAGES = [
  "/images/rudraksha/hero-1.jpg",
  "/images/rudraksha/hero-2.jpg",
];

function absUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.cityjeweller.in";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function titleFrom(it: PublicRudraksha) {
  const title = safeText(it.productTitle);
  if (title) return `${title} | ${it.skuId}`;

  const mukhiPart = it.mukhi ? `${it.mukhi} Mukhi ` : "";
  const typePart = (it.type ? it.type : "Rudraksha").toUpperCase();
  return `${mukhiPart}${typePart} | ${it.skuId}`;
}


function safeText(s?: string | null) {
  return String(s ?? "").trim();
}

// Return the first available origin-like value from many possible legacy/new keys
function getRawOrigin(obj: any) {
  if (!obj) return "";
  return (
    obj.origin ||
    obj.originLegacy ||
    (obj as any).origin_legacy ||
    (obj as any).originCity ||
    (obj as any).originCityLegacy ||
    (obj as any).originNew ||
    (obj as any).originOther ||
    (obj as any).productOrigin ||
    (obj as any).country ||
    ""
  );
}

export async function generateMetadata(
  props: { params: Promise<{ skuId: string }> }
): Promise<Metadata> {
  const { skuId } = await props.params;
  const decoded = decodeURIComponent(String(skuId || ""));

  const it = await getPublicRudrakshaBySku(decoded);
  if (!it) return { title: "Rudraksha | Not found" };

  const price = pickDisplayPrice(it);
  const cover = pickCoverUrl(Array.isArray(it.media) ? it.media : []) || FALLBACK_IMAGES[0];
  const title = titleFrom(it);

  const rawOrigin = getRawOrigin(it);
  const origin = safeText(rawOrigin) ? `Origin: ${rawOrigin}` : "";
  const bead = it.sizeMm ? `Bead size: ${it.sizeMm} mm` : "";
  const short = safeText(it.shortDescription);

  const descCore =
    short ||
    `Shop authentic ${it.mukhi ? `${it.mukhi} Mukhi ` : ""}${it.type || "Rudraksha"}${
      origin ? ` (${origin})` : ""
    }. ${bead ? `${bead}. ` : ""}Verified media, transparent pricing and fast enquiry on WhatsApp.`;

  const description = `${descCore}${price ? ` Price: ${formatINR(price)}.` : ""}`;

  return {
    title,
    description,
    alternates: { canonical: absUrl(`/rudraksha/${encodeURIComponent(it.skuId)}`) },
    openGraph: {
      type: "website", // ✅ Next.js allowed value
      title,
      description,
      url: absUrl(`/rudraksha/${encodeURIComponent(it.skuId)}`),
      images: [{ url: cover }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [cover],
    },
  };
}

export default async function RudrakshaProductPage(
  props: { params: Promise<{ skuId: string }> }
) {
  const { skuId } = await props.params;
  const decoded = decodeURIComponent(String(skuId || ""));

  const data = await getPublicRudrakshaBySku(decoded);
  if (!data) return notFound();

  const all = await listPublicRudraksha();
  const related = all
    .filter((x) => x.skuId !== data.skuId)
    .filter(
      (x) =>
        (data.mukhi ? x.mukhi === data.mukhi : false) ||
        (data.type ? x.type === data.type : false)
    )
    .slice(0, 4);

  const price = pickDisplayPrice(data);
  const mrp = pickMrpPrice(data);
  const cover =
    pickCoverUrl(Array.isArray(data.media) ? data.media : []) || FALLBACK_IMAGES[0];

  const discountPct = price && mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;


  // origin fallback for display and WA text
  const rawOriginData = getRawOrigin(data);

  // WhatsApp (fixed number)
  const WA_NUMBER = "919023130944"; // ✅ your number
  const waText = encodeURIComponent(
    `Hi! I’m interested in this Rudraksha:\n` +
      `• SKU: ${data.skuId}\n` +
      `${data.mukhi ? `• Mukhi: ${data.mukhi}\n` : ""}` +
      `${data.type ? `• Type: ${data.type}\n` : ""}` +
      `${rawOriginData ? `• Origin: ${rawOriginData}\n` : ""}` +
      `${price ? `• Price: ${formatINR(price)}\n` : ""}` +
      `Please share availability, certification details, and delivery timeline.`
  );

  const waHref = WA_NUMBER
    ? `https://wa.me/${WA_NUMBER}?text=${waText}`
    : `https://wa.me/?text=${waText}`;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
      {/* ✅ JSON-LD (Product + Breadcrumb + FAQ) */}
      <RudrakshaJsonLd item={data} coverUrl={cover} waHref={waHref} />

      {/* Breadcrumb */}
      <nav className="text-sm text-gray-600">
        <Link className="hover:underline" href="/rudraksha">
          Rudraksha
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{data.skuId}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Gallery */}
        <div className="space-y-3">
          <RudrakshaGallery media={Array.isArray(data.media) ? data.media : []} />


          {/* Trust strip */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-2xl border p-3">
              <div className="font-semibold text-gray-900">Verified Media</div>
              <div className="text-gray-600">Clear photos/videos for authenticity</div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="font-semibold text-gray-900">Transparent Pricing</div>
              <div className="text-gray-600">Offer/MRP shown where available</div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="font-semibold text-gray-900">Fast Support</div>
              <div className="text-gray-600">WhatsApp enquiry in 1 tap</div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-4">
          <header className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">
              {safeText(data.productTitle)
                ? safeText(data.productTitle)
                : `${data.mukhi ? `${data.mukhi} Mukhi ` : ""}${(data.type || "Rudraksha").toUpperCase()}`}
            </h1>


            <div className="text-sm text-gray-600">
              SKU: <span className="font-semibold text-gray-900">{data.skuId}</span>
              {rawOriginData ? (
                <>
                  {" "}
                  • Origin: <span className="font-semibold text-gray-900">{rawOriginData}</span>
                </>
              ) : null}
            </div>

            {/* Price block */}
            <div className="flex items-end gap-3 pt-1">
              <div className="text-3xl font-bold text-gray-900">
                {price ? formatINR(price) : "Price on request"}
              </div>

              {mrp && price && mrp > price ? (
                <div className="text-sm text-gray-500 line-through pb-1">{formatINR(mrp)}</div>
              ) : null}

              {discountPct > 0 ? (
                <div className="text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-1 mb-1">
                  Save {discountPct}%
                </div>
              ) : null}
            </div>
          </header>

          {/* Key specs */}
          <section className="grid sm:grid-cols-2 gap-3 text-sm">
            <Spec label="Mukhi" value={data.mukhi ?? "—"} />
            <Spec label="Bead size" value={data.sizeMm ? `${data.sizeMm} mm` : "—"} />
            <Spec label="Material" value={data.material || "—"} />
            <Spec label="Certified" value={data.labCertified ? "Yes" : "—"} />
          </section>

          {/* Tags */}
          {!!data.tags?.length && (
            <section className="flex flex-wrap gap-2">
              {data.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs rounded-full border px-3 py-1 text-gray-700 bg-white"
                >
                  #{t}
                </span>
              ))}
            </section>
          )}

          {/* Primary CTA */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-black text-white px-5 py-3 font-semibold hover:opacity-90"
            >
              Enquire on WhatsApp
            </a>

            <a
              href="#details"
              className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 font-semibold text-gray-900 hover:bg-gray-50"
            >
              View details
            </a>
          </div>

          <p className="text-xs text-gray-500">
            Note: Availability and pricing may change. Please confirm on WhatsApp before purchase.
          </p>

          {/* About / SEO content */}
          <section id="details" className="pt-2 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">About this Rudraksha</h2>

            <p className="text-sm text-gray-700 leading-6">
              {safeText(data.shortDescription) ? (
                safeText(data.shortDescription)
              ) : (
                <>
                  This listing provides clear media, core specifications and transparent pricing for{" "}
                  {data.mukhi ? `${data.mukhi} Mukhi ` : ""}{(data.type || "Rudraksha").toUpperCase()}.
                  {rawOriginData ? ` Origin: ${rawOriginData}.` : ""} {" "}
                  Use WhatsApp enquiry for availability, certification details (if applicable), and delivery timeline.
                </>
              )}
            </p>

            {/* Full details (public) - exclude supplier-only fields like supplierRate/adminMargin */}
            <div className="pt-4">
              <h3 className="text-md font-semibold text-gray-900 mb-2">Full details</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {Object.keys(data)
                  .filter(
                    (k) =>
                      k &&
                      ![
                        "supplierRate",
                        "ratePerGm",
                        "adminMarginPct",
                        "marginPct",
                        "supplierUid",
                        "gstNumber",
                        "approvedAt",
                        "computedBasePrice",
                        "computedPublicPrice",
                        "createdAt",
                        "media",
                        "status",
                        "updatedAt",
                      ].includes(k)
                  )
                   .sort()
                   .map((key) => {
                    const val = (data as any)[key];
                    // Skip internal empty values
                    if (val === undefined || val === null || (Array.isArray(val) && val.length === 0)) return null;
                    // Format some known keys
                    let display = "";
                    if (key === "media" || key === "images" || key === "videos") {
                      display = Array.isArray(val) ? `${val.length} item(s)` : String(val);
                    } else if (typeof val === "object") {
                      try {
                        display = JSON.stringify(val);
                      } catch (e) {
                        display = String(val);
                      }
                    } else {
                      display = String(val);
                    }

                    return (
                      <div key={key} className="rounded-2xl border p-3">
                        <div className="text-xs text-gray-500">{key}</div>
                        <div className="font-semibold text-gray-900 break-words">{display}</div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <InfoCard
                title="Authenticity checks"
                points={[
                  "Match natural grooves (mukhi lines) with media",
                  "Prefer clear close-up photos + videos",
                  "Ask for lab/cert if mentioned on listing",
                ]}
              />
              <InfoCard
                title="How to wear"
                points={[
                  "Wear as pendant / bracelet / mala",
                  "Avoid harsh chemicals & perfumes",
                  "Store dry after use",
                ]}
              />
              <InfoCard
                title="Care & storage"
                points={[
                  "Wipe with soft dry cloth",
                  "Keep away from moisture for long periods",
                  "Use a small pouch/box",
                ]}
              />
            </div>
          </section>

          {/* FAQ */}
          <section className="pt-2 space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">FAQs</h2>
            <Faq
              q="Is the Rudraksha exactly the same as the photos?"
              a="You will receive the same SKU shown on this page (subject to availability). Media is provided to verify appearance; please confirm on WhatsApp before ordering."
            />
            <Faq
              q="Do you provide certification?"
              a="If the listing mentions “Certified”, ask us on WhatsApp for the certificate details and media. Certification availability can vary by item."
            />
            <Faq
              q="How soon can it be shipped?"
              a="Delivery timeline depends on location and availability. Share your city/pincode on WhatsApp for an accurate estimate."
            />
          </section>
        </div>
      </div>

      {/* Related */}
      {related.length ? (
        <section className="pt-4 space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold text-gray-900">You may also like</h2>
            <Link className="text-sm text-gray-600 hover:underline" href="/rudraksha">
              View all
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((it) => {
              const rPrice = pickDisplayPrice(it);
              const rCover = pickCoverUrl(it.media) || FALLBACK_IMAGES[0];

              return (
                <Link
                  key={it.skuId}
                  href={`/rudraksha/${encodeURIComponent(it.skuId)}`}
                  className="rounded-2xl border overflow-hidden hover:shadow-sm transition bg-white"
                >
                  <img
                    src={rCover}
                    alt={`${it.mukhi ? `${it.mukhi} Mukhi ` : ""}${it.type || "Rudraksha"} ${it.skuId}`}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                  />

                  <div className="p-3 space-y-1">
                    <div className="text-sm font-semibold text-gray-900 line-clamp-2">
                      {it.mukhi ? `${it.mukhi} Mukhi ` : ""}{it.type || "Rudraksha"}
                    </div>
                    <div className="text-xs text-gray-600">SKU: {it.skuId}</div>
                    <div className="text-sm font-bold text-gray-900">
                      {rPrice ? formatINR(rPrice) : "Price on request"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Sticky bottom bar (mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur sm:hidden">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-gray-600 truncate">{data.skuId}</div>
            <div className="text-sm font-bold text-gray-900 truncate">
              {price ? formatINR(price) : "Price on request"}
            </div>
            {discountPct > 0 ? (
              <div className="text-xs text-white bg-rose-600 rounded-full px-2 py-0.5 ml-2 inline-block">-{discountPct}%</div>
            ) : null}
          </div>
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold"
          >
            WhatsApp
          </a>
        </div>
      </div>

      <div className="h-14 sm:hidden" />
    </div>
  );
}

function Spec({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{String(value ?? "—")}</div>
    </div>
  );
}

function InfoCard({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="font-semibold text-gray-900">{title}</div>
      <ul className="mt-2 space-y-1 text-sm text-gray-700">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-2xl border p-4">
      <summary className="cursor-pointer font-semibold text-gray-900">{q}</summary>
      <p className="mt-2 text-sm text-gray-700 leading-6">{a}</p>
    </details>
  );
}
