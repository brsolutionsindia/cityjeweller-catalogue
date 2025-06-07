import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "City Jeweller | The Jewellery Hub",
  description: "Discover curated gold, silver, diamond, and gemstone jewellery from trusted retailers in your city.",
  openGraph: {
    title: "City Jeweller | The Jewellery Hub",
    description: "Explore premium jewellery collections from your city's retailers at one place.",
    url: "https://www.cityjeweller.in",
    siteName: "City Jeweller",
    images: [
      {
        url: "/thumbnail.png",
        width: 1200,
        height: 630,
        alt: "City Jeweller Website Thumbnail",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Jewellery Hub - City Jeweller",
    description: "Discover curated jewellery collections.",
    images: ["/thumbnail.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Favicon */}
        <link rel="icon" href="/favicon.png" sizes="any" />
        {/* Open Graph (Facebook, WhatsApp) */}
        <meta property="og:image" content="/thumbnail.png" />
        <meta property="og:title" content="City Jeweller | The Jewellery Hub" />
        <meta property="og:description" content="Explore premium jewellery collections from your city's retailers at one place." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.cityjeweller.in" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="The Jewellery Hub - City Jeweller" />
        <meta name="twitter:description" content="Discover curated jewellery collections." />
        <meta name="twitter:image" content="/thumbnail.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
