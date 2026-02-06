"use client";

import Link from "next/link";

export default function AdminGemstoneJewelleryQueue() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin • Gemstone Jewellery Queue</h1>

      {/* TODO: list AdminQueue/GemstoneJewellery */}
      <div className="rounded-2xl border p-4 text-gray-600">
        List pending items from:
        <div className="mt-2 font-mono text-sm">AdminQueue/GemstoneJewellery</div>
        <div className="mt-4">
          When you render each row: link to <span className="font-mono">/admin/gemstone-jewellery/&lt;skuId&gt;</span>
        </div>
      </div>

      {/* Placeholder example */}
      <Link href="/admin/gemstone-jewellery/example-sku" className="underline text-sm">
        Example detail route
      </Link>
    </div>
  );
}
