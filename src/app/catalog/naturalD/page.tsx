// SERVER COMPONENT (no "use client")
import type { Metadata } from 'next';
import NaturalCatalogPage from './NaturalCatalogPage';

export const metadata: Metadata = {
  title: 'Natural Solitaire Diamonds | IGI/GIA Certified | CityJeweller.in',
  description:
    'Browse Natural IGI/GIA-certified solitaire diamonds with transparent pricing. Compare our natural diamond prices with leading online jewellery brands. Wholesale-style rates across India.',
  alternates: {
    canonical: 'https://cityjeweller.in/catalog/naturalD',
  },
  openGraph: {
    title: 'Natural Solitaire Diamonds at Wholesale Prices | CityJeweller.in',
    description:
      'Explore Natural IGI/GIA-certified solitaires with clear, transparent pricing. Compare our pricing approach with popular online jewellery brands and save with wholesale advantage.',
    url: 'https://cityjeweller.in/catalog/naturalD',
    type: 'website',
    siteName: 'CityJeweller.in',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Natural Solitaire Diamonds | IGI/GIA Certified',
    description:
      'Shop Natural certified solitaire diamonds with transparent pricing and wholesale-style advantage at CityJeweller.in.',
  },
};

export default function Page() {
  return <NaturalCatalogPage />;
}
