// src/app/catalog/solitaireRG/page.tsx

import type { Metadata } from 'next';
import { Suspense } from 'react';
import GoldCatalog from './GoldCatalog';
import styles from '../../page.module.css';

export const metadata: Metadata = {
  title: 'Buy Solitaire Rings at Wholesale Prices | IGI Certified | CityJeweller.in',
  description:
    'Compare solitaire ring prices at CityJeweller.in with leading online brands. Buy IGI-certified natural and lab grown solitaire rings at transparent, wholesale rates across India.',
  alternates: {
    canonical: 'https://cityjeweller.in/catalog/solitaireRG',
  },
  openGraph: {
    title: 'Certified Solitaire Rings at Wholesale Prices | CityJeweller.in',
    description:
      'Browse a curated range of solitaire ring designs and compare our pricing approach with leading online brands. IGI-certified solitaires, natural & lab grown, with transparent charges.',
    url: 'https://cityjeweller.in/catalog/solitaireRG',
    type: 'website',
    siteName: 'CityJeweller.in',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buy Solitaire Rings at Wholesale Prices | CityJeweller.in',
    description:
      'Compare solitaire ring prices at CityJeweller.in with popular online jewellery brands. IGI-certified solitaire rings with transparent pricing.',
  },
};

export default function SolitaireRingsPage() {
  return (
    <main className={styles.solitairePage}>
      {/* --- ORIGINAL JEWELLERY SELECTION (CATALOG FIRST) --- */}
      <section
        className={styles.solitaireCatalog}
        aria-label="Solitaire ring designs catalog"
      >
        <Suspense fallback={<div>Loading solitaire rings...</div>}>
          <GoldCatalog />
        </Suspense>
      </section>



    </main>
  );
}
