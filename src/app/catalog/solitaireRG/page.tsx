// src/app/catalog/solitaireRG/page.tsx

import type { Metadata } from 'next';
import { Suspense } from 'react';
import GoldCatalog from './GoldCatalog';

export const metadata: Metadata = {
  title: 'Buy Solitaire Rings at Wholesale Prices | IGI Certified | CityJeweller.in',
  description:
    'Compare CaratLane & Bluestone solitaire prices with CityJeweller.in. Buy IGI-certified natural and lab grown solitaire rings at wholesale rates across India.',
  alternates: {
    canonical: 'https://cityjeweller.in/catalog/solitaireRG',
  },
  openGraph: {
    title: 'Certified Solitaire Rings at Wholesale Prices | CityJeweller.in',
    description:
      'Browse 80+ solitaire ring designs and compare our prices with CaratLane & Bluestone. IGI-certified solitaires, natural & lab grown, at wholesale rates.',
    url: 'https://cityjeweller.in/catalog/solitaireRG',
    type: 'website',
    siteName: 'CityJeweller.in',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buy Solitaire Rings at Wholesale Prices | CityJeweller.in',
    description:
      'Compare solitaire prices with CaratLane & Bluestone and save with CityJeweller.in. IGI-certified solitaire rings at wholesale rates.',
  },
};


export default function SolitaireRingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GoldCatalog />
    </Suspense>
  );
}
