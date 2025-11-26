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
    <main className="solitaire-page">
      {/* --- SEO Intro Section --- */}
      <section className="solitaire-hero" aria-labelledby="solitaire-page-heading">
        <h1 id="solitaire-page-heading">
          Certified Solitaire Rings at Wholesale Prices (Compare with CaratLane &amp; Bluestone)
        </h1>

        <p>
          Looking to buy a certified solitaire ring at the right price? CityJeweller.in offers{' '}
          <strong>Natural</strong> and <strong>Lab Grown</strong> IGI-certified solitaires at{' '}
          <strong>wholesale rates</strong> — often 20–40% more affordable than popular
          brands like <strong>CaratLane</strong> and <strong>Bluestone</strong>.
        </p>

        <p>
          Browse 80+ latest solitaire ring designs, customise in 18kt gold or platinum, and choose
          from <strong>0.20ct to 2.00ct</strong> solitaire sizes. Compare solitaire prices side-by-side
          before buying so you always know you are getting a transparent, wholesale deal.
        </p>
      </section>

      {/* --- Why Cheaper Section --- */}
      <section className="solitaire-why" aria-labelledby="why-cityjeweller-heading">
        <h2 id="why-cityjeweller-heading">
          Why CityJeweller Solitaire Rings Cost Less than CaratLane &amp; Bluestone
        </h2>

        <ul>
          <li>Wholesale solitaire sourcing with no heavy showroom overheads.</li>
          <li>IGI-certified solitaires with transparent weight, colour, clarity and cut.</li>
          <li>
            Direct comparison of <strong>solitaire ring prices</strong> with CaratLane and Bluestone,
            without fake MRP or confusing discounts.
          </li>
          <li>
            Choice of <strong>Natural</strong> and <strong>Lab Grown</strong> solitaires, so you can
            optimise both budget and brilliance.
          </li>
        </ul>
      </section>

      {/* --- Popular Searches / Internal SEO Links --- */}
      <section className="solitaire-searches" aria-labelledby="popular-searches-heading">
        <h2 id="popular-searches-heading">Popular Solitaire Ring Searches</h2>
        <p>Buyers like you are actively searching for:</p>
        <ul>
          <li>1 carat diamond ring price in India</li>
          <li>Solitaire rings cheaper than CaratLane</li>
          <li>Bluestone solitaire ring alternatives</li>
          <li>IGI-certified solitaire rings online</li>
          <li>Lab grown diamond solitaire rings India</li>
          <li>Solitaire ring designs under ₹50,000</li>
        </ul>
      </section>

      {/* --- Comparison Table (Keyword Rich) --- */}
      <section className="solitaire-comparison" aria-labelledby="price-comparison-heading">
        <h2 id="price-comparison-heading">
          Solitaire Price Comparison – CaratLane / Bluestone vs CityJeweller.in
        </h2>
        <p>
          Real-world example of how <strong>CityJeweller.in</strong> solitaire ring prices can compare
          against typical online brands:
        </p>

        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Carat Weight</th>
                <th>Other E-Commerce Websites*</th>
                <th>CityJeweller.in (Wholesale)</th>
                <th>Approx. Savings</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>0.20 ct solitaire ring</td>
                <td>≈ ₹60,000</td>
                <td>≈ ₹44,000</td>
                <td>Up to 25–30%</td>
              </tr>
              <tr>
                <td>0.30 ct solitaire ring</td>
                <td>≈ ₹75,000</td>
                <td>≈ ₹52,000</td>
                <td>Up to 30–35%</td>
              </tr>
              <tr>
                <td>0.50 ct solitaire ring</td>
                <td>≈ ₹1,10,000</td>
                <td>≈ ₹75,000</td>
                <td>Up to 30–40%</td>
              </tr>
            </tbody>
          </table>
          <p className="comparison-note">
            *Typical prices from branded e-commerce platforms like CaratLane &amp; Bluestone. Actual prices
            vary by design, purity, certification and offers.
          </p>
        </div>
      </section>

      {/* --- Catalog Rendering (Existing Functionality) --- */}
      <section className="solitaire-catalog" aria-label="Solitaire ring designs catalog">
        <Suspense fallback={<div>Loading solitaire rings...</div>}>
          <GoldCatalog />
        </Suspense>
      </section>

      {/* --- FAQ Section (More Long-Tail Keywords) --- */}
      <section className="solitaire-faq" aria-labelledby="solitaire-faq-heading">
        <h2 id="solitaire-faq-heading">FAQ – Buying Solitaire Rings at CityJeweller.in</h2>

        <h3>Are your solitaire rings certified?</h3>
        <p>
          Yes. Our solitaire diamonds are IGI or equivalent certified, with clear details of carat,
          colour, clarity and cut shared before billing.
        </p>

        <h3>How are you cheaper than CaratLane and Bluestone?</h3>
        <p>
          We operate on a wholesale, low-overhead model. That means more of what you pay goes into the
          actual diamond and gold, not into marketing or showroom expenses.
        </p>

        <h3>Do you offer both Natural and Lab Grown solitaire rings?</h3>
        <p>
          Yes. You can choose between Natural and Lab Grown solitaires in your preferred carat weight,
          depending on your budget and preference.
        </p>
      </section>
    </main>
  );
}
