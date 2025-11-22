'use client';

import type React from 'react';

export default function TrustInfoStrip() {
  return (
    <section className="mt-8 rounded-2xl border border-neutral-200 bg-white/90 p-4 md:p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-sm md:text-base font-semibold text-neutral-900">
          Why shop solitaire rings with CityJeweller.in?
        </h2>
        <p className="text-[11px] md:text-xs text-neutral-600">
          CityJeweller.in is powered by Rawat Gems &amp; Jewellers (Chandigarh) — serving customers for 35+ years
          with transparent pricing and genuine, certified jewellery.
        </p>
      </div>

      {/* Badges grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 text-xs">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
            15-Day Returns*
          </div>
          <p className="mt-1 text-[11px] text-neutral-700">
            If your solitaire ring is not exactly what you expected, you can raise a return or exchange
            request within 15 days of delivery. T&amp;C apply.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <div className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wide">
            Certified Solitaires (IGI / GIA / SGL)
          </div>
          <p className="mt-1 text-[11px] text-neutral-700">
            Every solitaire comes with a lab certificate from internationally recognised grading labs
            (such as IGI / GIA / SGL), giving you complete clarity and confidence in the 4Cs.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <div className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wide">
            BIS Hallmarked Gold with HUID
          </div>
          <p className="mt-1 text-[11px] text-neutral-700">
            All gold jewellery is BIS-hallmarked with HUID, so purity is trackable and verifiable as per
            current Indian regulations.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <div className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wide">
            35+ Years of Trust
          </div>
          <p className="mt-1 text-[11px] text-neutral-700">
            Backed by Rawat Gems &amp; Jewellers, Chandigarh — a family-run jewellery business serving
            customers with honesty, personalised guidance and wholesale-style pricing for over 35 years.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <div className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wide">
            Transparent Pricing &amp; Wholesale Advantage
          </div>
          <p className="mt-1 text-[11px] text-neutral-700">
            See mount price and solitaire price separately. Compare Natural vs Lab-grown totals side-by-side
            and pay only for what you choose — no hidden “offer” mark-ups.
          </p>
        </div>

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
        *Standard promise is 15-day return / exchange from date of delivery on eligible solitaire jewellery.
        Customised, engraved or heavily altered pieces may have a different policy. Please refer to the detailed
        Return &amp; Exchange Policy page for full terms.
      </p>
    </section>
  );
}
