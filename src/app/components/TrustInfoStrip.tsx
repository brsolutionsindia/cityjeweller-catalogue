'use client';

import type React from 'react';

export default function TrustInfoStrip() {
  return (
    <>
      {/* TRUST / POLICY STRIP */}
      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white/90 p-4 md:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h2 className="text-sm md:text-base font-semibold text-neutral-900">
            Why shop solitaire rings with CityJeweller.in?
          </h2>
          <p className="text-[11px] md:text-xs text-neutral-600">
            CityJeweller.in is powered by Rawat Gems &amp; Jewellers (Chandigarh) — serving customers
            for 35+ years with transparent pricing and genuine, certified jewellery.
          </p>
        </div>

        {/* Badges grid */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          {/* 15-day returns */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
            <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
              15-Day Returns*
            </div>
            <p className="mt-1 text-[11px] text-neutral-700">
              If your solitaire ring is not exactly what you expected, you can raise a return or
              exchange request within 15 days of delivery. T&amp;C apply.
            </p>
          </div>

          {/* Certified solitaires */}
          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
            <div className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wide">
              Certified Solitaires (IGI / GIA / SGL)
            </div>
            <p className="mt-1 text-[11px] text-neutral-700">
              Every solitaire comes with a lab certificate from internationally recognised grading labs
              (such as IGI / GIA / SGL), giving you complete clarity and confidence in the 4Cs.
            </p>
          </div>

          {/* BIS + HUID */}
          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
            <div className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wide">
              BIS Hallmarked Gold with HUID
            </div>
            <p className="mt-1 text-[11px] text-neutral-700">
              All gold jewellery is BIS-hallmarked with HUID, so purity is trackable and verifiable
              as per current Indian regulations.
            </p>
          </div>

          {/* 35+ years of trust */}
          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
            <div className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wide">
              35+ Years of Trust
            </div>
            <p className="mt-1 text-[11px] text-neutral-700">
              Backed by Rawat Gems &amp; Jewellers, Chandigarh — a family-run jewellery business
              serving customers with honesty, personalised guidance and wholesale-style pricing
              for over 35 years.
            </p>
          </div>

          {/* Transparent pricing */}
          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
            <div className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wide">
              Transparent Pricing &amp; Wholesale Advantage
            </div>
            <p className="mt-1 text-[11px] text-neutral-700">
              See mount price and solitaire price separately. Compare Natural vs Lab-grown totals
              side-by-side and pay only for what you choose — no hidden “offer” mark-ups.
            </p>
          </div>

          {/* Help & contact */}
          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
            <div className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wide">
              Help &amp; Contact
            </div>
            <p className="mt-1 text-[11px] text-neutral-700">
              Need help choosing the right solitaire or size? Chat with us on WhatsApp at{' '}
              <span className="font-semibold">+91-90231-30944</span> or write to{' '}
              <span className="font-semibold">cityjewellers.india@gmail.com</span>.
            </p>
          </div>
        </div>

        {/* Policy links strip */}
        <div className="pt-2 border-t border-dashed border-neutral-200 flex flex-wrap gap-3 text-[11px] text-neutral-600">
          <a href="/about" className="underline-offset-2 hover:underline">
            About Us
          </a>
          <span>·</span>
          <a href="/contact" className="underline-offset-2 hover:underline">
            Contact Us
          </a>
          <span>·</span>
          <a href="/policies/returns" className="underline-offset-2 hover:underline">
            Return &amp; Exchange Policy
          </a>
          <span>·</span>
          <a href="/policies/certification" className="underline-offset-2 hover:underline">
            IGI &amp; Certification Details
          </a>
          <span>·</span>
          <a href="/policies/huid" className="underline-offset-2 hover:underline">
            BIS Hallmark &amp; HUID
          </a>
        </div>

        <p className="text-[10px] text-neutral-500">
          *Standard promise is 15-day return / exchange from date of delivery on eligible solitaire
          jewellery. Customised, engraved or heavily altered pieces may have a different policy.
          Please refer to the detailed Return &amp; Exchange Policy page for full terms.
        </p>
      </section>

      {/* SEO HERO SECTION – light card for readability */}
      <section
        className="mt-6 rounded-2xl bg-[#fff5f2] border border-[#f3d2c5] px-4 py-5 md:px-6 md:py-6 space-y-3"
        aria-labelledby="solitaire-page-heading"
      >
        <h1
          id="solitaire-page-heading"
          className="text-lg md:text-xl font-semibold text-[#3b1114]"
        >
          Certified Solitaire Rings at Wholesale Prices
        </h1>

        <p className="text-xs md:text-sm text-[#4b1f23]">
          Looking to buy a certified solitaire ring at the right price? CityJeweller.in offers{' '}
          <strong>Natural</strong> and <strong>Lab Grown</strong> IGI-certified solitaires with{' '}
          <strong>transparent, wholesale-style pricing</strong> that can often be more affordable
          than many popular online jewellery brands.
        </p>

        <p className="text-xs md:text-sm text-[#4b1f23]">
          Browse our latest solitaire ring designs, customise in 18kt/14kt gold or platinum, and
          choose from a range of solitaire sizes (for example, starting from around{' '}
          <strong>0.20ct onwards</strong>, subject to availability). You can review a clear breakup
          of diamond, gold and making charges before you decide.
        </p>
      </section>

      {/* WHY OUR PRICING CAN BE LOWER */}
      <section
        className="mt-4 rounded-2xl bg-white px-4 py-4 md:px-6 md:py-5 space-y-2 border border-neutral-200"
        aria-labelledby="why-cityjeweller-heading"
      >
        <h2
          id="why-cityjeweller-heading"
          className="text-sm md:text-base font-semibold text-neutral-900"
        >
          Why CityJeweller Solitaire Rings Can Be More Affordable Than Many Leading Online Brands
        </h2>

        <ul className="list-disc pl-5 space-y-1 text-[11px] md:text-xs text-neutral-700">
          <li>Wholesale-style solitaire sourcing with lower showroom and marketing overheads.</li>
          <li>
            IGI-certified solitaires with transparent details of weight, colour, clarity and cut.
          </li>
          <li>
            Clear breakup of gold value, solitaire value and making charges, instead of inflated
            MRPs with confusing discounts.
          </li>
          <li>
            Choice of <strong>Natural</strong> and <strong>Lab Grown</strong> solitaires, so you can
            balance budget, size and quality as per your priorities.
          </li>
        </ul>
      </section>

      {/* COMPARISON TABLE */}
      <section
        className="mt-4 rounded-2xl bg-white px-4 py-4 md:px-6 md:py-5 space-y-3 border border-neutral-200"
        aria-labelledby="price-comparison-heading"
      >
        <h2
          id="price-comparison-heading"
          className="text-sm md:text-base font-semibold text-neutral-900"
        >
          Illustrative Solitaire Price Comparison – Branded Online Jewellers vs CityJeweller.in
        </h2>
        <p className="text-[11px] md:text-xs text-neutral-700">
          The table below gives an <strong>illustrative example</strong> of how a solitaire ring
          from a typical branded online jewellery platform might compare with a similar solitaire
          ring from CityJeweller.in. This is for general understanding only; actual prices will
          always depend on the exact design, size, quality and ongoing offers.
        </p>

        <div className="mt-2 overflow-x-auto">
          <table className="min-w-[420px] w-full border-collapse text-[11px] md:text-xs">
            <thead>
              <tr className="bg-[#fdf3dd] text-neutral-900">
                <th className="border border-neutral-200 px-2 py-1 text-left font-semibold">
                  Carat Weight
                </th>
                <th className="border border-neutral-200 px-2 py-1 text-left font-semibold">
                  Typical Branded Online Jeweller*
                </th>
                <th className="border border-neutral-200 px-2 py-1 text-left font-semibold">
                  CityJeweller.in (Indicative)
                </th>
                <th className="border border-neutral-200 px-2 py-1 text-left font-semibold">
                  Approx. Savings Range
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="odd:bg-white even:bg-neutral-50">
                <td className="border border-neutral-200 px-2 py-1">
                  0.20 ct solitaire ring
                </td>
                <td className="border border-neutral-200 px-2 py-1">≈ ₹60,000</td>
                <td className="border border-neutral-200 px-2 py-1">≈ ₹44,000</td>
                <td className="border border-neutral-200 px-2 py-1">
                  Can be lower by a meaningful margin
                </td>
              </tr>
              <tr className="odd:bg-white even:bg-neutral-50">
                <td className="border border-neutral-200 px-2 py-1">
                  0.30 ct solitaire ring
                </td>
                <td className="border border-neutral-200 px-2 py-1">≈ ₹75,000</td>
                <td className="border border-neutral-200 px-2 py-1">≈ ₹52,000</td>
                <td className="border border-neutral-200 px-2 py-1">
                  Varies based on design &amp; offers
                </td>
              </tr>
              <tr className="odd:bg-white even:bg-neutral-50">
                <td className="border border-neutral-200 px-2 py-1">
                  0.50 ct solitaire ring
                </td>
                <td className="border border-neutral-200 px-2 py-1">≈ ₹1,10,000</td>
                <td className="border border-neutral-200 px-2 py-1">≈ ₹75,000</td>
                <td className="border border-neutral-200 px-2 py-1">
                  Illustrative of potential difference
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-neutral-500">
          *These figures are indicative examples based on typical price ranges seen on branded online
          jewellery platforms. Prices change frequently and will vary by design, metal purity,
          certification, location and ongoing promotions.
        </p>
        <p className="text-[10px] text-neutral-500">
          CaratLane® and Bluestone® are registered trademarks of their respective owners. They are
          mentioned here only as examples of popular online jewellery brands. CityJeweller.in is an
          independent business and is not affiliated with them.
        </p>
      </section>

      {/* FAQ SECTION */}
      <section
        className="mt-4 rounded-2xl bg-white px-4 py-4 md:px-6 md:py-5 space-y-3 border border-neutral-200"
        aria-labelledby="solitaire-faq-heading"
      >
        <h2
          id="solitaire-faq-heading"
          className="text-sm md:text-base font-semibold text-neutral-900"
        >
          FAQ – Buying Solitaire Rings at CityJeweller.in
        </h2>

        <div className="space-y-2 text-[11px] md:text-xs text-neutral-700">
          <div>
            <h3 className="font-semibold text-neutral-900">
              Are your solitaire rings certified?
            </h3>
            <p>
              Yes. Our solitaire diamonds are IGI or equivalent certified, with clear details of
              carat, colour, clarity and cut shared before billing.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-neutral-900">
              How can your prices be competitive compared to big online brands?
            </h3>
            <p>
              We operate on a wholesale, low-overhead model. More of what you pay goes into the
              actual diamond and gold, rather than heavy marketing or large showroom expenses. This
              helps us offer competitive pricing while maintaining quality.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-neutral-900">
              Do you offer both Natural and Lab Grown solitaire rings?
            </h3>
            <p>
              Yes. You can choose between Natural and Lab Grown solitaires in your preferred carat
              weight, depending on your budget and preference. Both options come with proper
              certification.
            </p>
          </div>
        </div>
      </section>

      {/* POPULAR SEARCHES / SEO QUERIES */}
      <section
        className="mt-4 mb-6 rounded-2xl bg-white px-4 py-4 md:px-6 md:py-5 space-y-2 border border-neutral-200"
        aria-labelledby="popular-searches-heading"
      >
        <h2
          id="popular-searches-heading"
          className="text-sm md:text-base font-semibold text-neutral-900"
        >
          Popular Solitaire Ring Search Queries
        </h2>
        <p className="text-[11px] md:text-xs text-neutral-700">
          When people research solitaire rings online, they often search for terms such as:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[11px] md:text-xs text-neutral-700">
          <li>1 carat diamond ring price in India</li>
          <li>More affordable solitaire ring options compared to typical branded stores</li>
          <li>Alternative solitaire ring options to big jewellery brands</li>
          <li>IGI-certified solitaire rings online</li>
          <li>Lab grown diamond solitaire rings in India</li>
          <li>Solitaire ring designs under ₹50,000 (approx.)</li>
        </ul>
        <p className="text-[11px] md:text-xs text-neutral-700">
          CityJeweller.in is designed to serve exactly these types of buyers who want certified
          quality with transparent, competitive pricing.
        </p>
      </section>
    </>
  );
}
