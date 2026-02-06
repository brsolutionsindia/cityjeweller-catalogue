// src/app/(supplier-protected)/supplier/gemstone-jewellery/page.tsx
"use client";

import Link from "next/link";

export default function SupplierGemstoneJewelleryHome() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gemstone Jewellery</h1>
        <Link href="/supplier/gemstone-jewellery/new" className="px-4 py-2 rounded-xl bg-black text-white">
          + New Listing
        </Link>
      </div>

      {/* TODO: show supplier listings table (same as yellow-sapphires list) */}
      <div className="rounded-2xl border p-4 text-gray-600">
        Hook this page to list submissions using your supplier index:
        <div className="mt-2 font-mono text-sm">
          GST/&lt;gst&gt;/Indexes/GemstoneJewellerySubmissions/BySupplier/&lt;uid&gt;
        </div>
      </div>
    </div>
  );
}
