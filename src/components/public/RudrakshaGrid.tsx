"use client";

import RudrakshaCard from "@/components/public/RudrakshaCard";
import type { PublicRudraksha } from "@/lib/firebase/rudrakshaPublicDb";

export default function RudrakshaGrid({ items }: { items: PublicRudraksha[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => <RudrakshaCard key={it.skuId} it={it} />)}
    </div>
  );
}
