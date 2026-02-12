// src/components/public/RudrakshaJsonLd.tsx

import { pickDisplayPrice, pickCoverUrl, type PublicRudraksha } from "@/lib/firebase/rudrakshaPublicDb";

export default function RudrakshaJsonLd({
  item,
  coverUrl,
  waHref,
}: {
  item: PublicRudraksha;
  coverUrl: string;
  waHref: string;
}) {
  const price = pickDisplayPrice(item);
  const image = coverUrl || pickCoverUrl(item.media) || "";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.cityjeweller.in").replace(/\/$/, "");
  const url = `${siteUrl}/rudraksha/${encodeURIComponent(item.skuId)}`;

  const name =
    `${item.mukhi ? `${item.mukhi} Mukhi ` : ""}${item.type || "Rudraksha"}`.trim();

  const description =
    (item.shortDescription && String(item.shortDescription).trim()) ||
    `Authentic Rudraksha listing with clear media, specifications and transparent pricing. Enquire on WhatsApp for availability and delivery timeline.`;

  const productJsonLd: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    sku: item.skuId,
    image: image ? [image] : undefined,
    description,
    brand: { "@type": "Brand", name: "CityJeweller.in" },
    category: item.productCategoryOther || item.productCategory || "Rudraksha",
    additionalProperty: [
      item.mukhi != null
        ? { "@type": "PropertyValue", name: "Mukhi", value: String(item.mukhi) }
        : null,
      (item.origin || item.originLegacy || item.origin_legacy)
        ? { "@type": "PropertyValue", name: "Origin", value: String(item.origin || item.originLegacy || item.origin_legacy) }
        : null,
      item.sizeMm
        ? { "@type": "PropertyValue", name: "Bead size (mm)", value: String(item.sizeMm) }
        : null,
      item.material
        ? { "@type": "PropertyValue", name: "Material", value: String(item.material) }
        : null,
      item.labCertified
        ? { "@type": "PropertyValue", name: "Certified", value: "Yes" }
        : null,
    ].filter(Boolean),
    offers: price
      ? {
          "@type": "Offer",
          url,
          priceCurrency: "INR",
          price: String(price),
          availability: "https://schema.org/InStock",
        }
      : undefined,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Rudraksha", item: `${siteUrl}/rudraksha` },
      { "@type": "ListItem", position: 2, name: item.skuId, item: url },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is the Rudraksha the same as shown in the photos?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "This page shows the SKU media for verification. Please confirm availability and details on WhatsApp before ordering.",
        },
      },
      {
        "@type": "Question",
        name: "Do you provide certification?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "If the listing mentions “Certified”, ask on WhatsApp for certificate details and media. Certification availability varies by item.",
        },
      },
      {
        "@type": "Question",
        name: "How can I enquire quickly?",
        acceptedAnswer: { "@type": "Answer", text: `Use WhatsApp: ${waHref}` },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </>
  );
}
