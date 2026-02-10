// src/app/(public)/rudraksha/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rudraksha & Rudraksha Jewellery | Cityjeweller.in",
  description:
    "Buy authentic Rudraksha beads and Rudraksha jewellery (mala, bracelet, pendant, ring). Filter by mukhi, origin, certification, wear type and more. Home delivery available.",
  alternates: { canonical: "/rudraksha" },
  openGraph: {
    title: "Rudraksha & Rudraksha Jewellery | Cityjeweller.in",
    description:
      "Authentic Rudraksha beads & Rudraksha jewellery. Filter by mukhi, origin, certification and more.",
    url: "/rudraksha",
    siteName: "Cityjeweller.in",
    type: "website",
    images: [{ url: "/images/rudraksha/og.jpg", width: 1200, height: 630, alt: "Rudraksha Collection" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rudraksha & Rudraksha Jewellery | Cityjeweller.in",
    description:
      "Authentic Rudraksha beads & Rudraksha jewellery. Filter by mukhi, origin, certification and more.",
    images: ["/images/rudraksha/og.jpg"],
  },
};

export default function RudrakshaLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Rudraksha & Rudraksha Jewellery",
    description:
      "Authentic Rudraksha beads and Rudraksha jewellery. Browse by mukhi, origin, wear type, certification and price.",
    url: "https://www.cityjeweller.in/rudraksha",
    isPartOf: {
      "@type": "WebSite",
      name: "Cityjeweller.in",
      url: "https://www.cityjeweller.in",
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.cityjeweller.in" },
        { "@type": "ListItem", position: 2, name: "Rudraksha", item: "https://www.cityjeweller.in/rudraksha" },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
