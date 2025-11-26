// SERVER COMPONENT (no "use client")
import type { Metadata } from 'next';
import LabGrownCatalogPage from './LabGrownCatalogPage';

export const metadata: Metadata = {
  title: 'Lab Grown Diamonds (CVD) at Wholesale Prices | CityJeweller.in',
  description:
    'Browse IGI-certified lab grown diamonds (CVD) in multiple shapes and sizes. Compare our wholesale-style prices with leading online jewellery brands across India at CityJeweller.in.',
  alternates: {
    canonical: 'https://cityjeweller.in/catalog/labgrown',
  },
  openGraph: {
    title: 'Lab Grown Diamonds (CVD) at Wholesale Prices | CityJeweller.in',
    description:
      'Explore lab grown CVD diamonds with transparent pricing, shapes and sizes for solitaire jewellery. Compare our pricing approach with popular online jewellery brands and save with wholesale advantage.',
    url: 'https://cityjeweller.in/catalog/labgrown',
    type: 'website',
    siteName: 'CityJeweller.in',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lab Grown Diamonds (CVD) | IGI-Certified | CityJeweller.in',
    description:
      'Shop IGI-certified lab grown (CVD) diamonds with transparent, wholesale-style pricing at CityJeweller.in.',
  },
};

export default function Page() {
  return <LabGrownCatalogPage />;
}
