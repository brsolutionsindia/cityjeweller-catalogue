// src/app/gemstones/page.tsx
import Link from "next/link";
import Image from "next/image";
import {
  fetchAllPublicListings,
  getPrimaryImageItem,
  type PublicYellowSapphire,
} from "@/lib/firebase/yellowSapphireDb";


export const dynamic = "force-dynamic";

function CategoryCard({
  title,
  subtitle,
  href,
  active = true,
}: {
  title: string;
  subtitle: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={active ? href : "#"}
      className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        active ? "" : "opacity-60 pointer-events-none"
      }`}
    >
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{subtitle}</div>
      <div className="mt-3 inline-flex text-sm font-medium text-amber-700">
        {active ? "Explore →" : "Coming soon"}
      </div>
    </Link>
  );
}

function FeaturedCard({ item }: { item: PublicYellowSapphire }) {
  const img = getPrimaryImageItem(item)?.url || null;
  return (
    <Link
      href={`/gemstones/yellow-sapphire/${encodeURIComponent(item.id)}`}
      className="rounded-2xl border bg-white shadow-sm transition hover:shadow-md overflow-hidden"
    >
      <div className="relative aspect-square bg-gray-50">
        {img ? (
          <Image
            src={img}
            alt={item.id}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No image
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="text-sm font-semibold">Yellow Sapphire</div>
        <div className="mt-1 text-xs text-gray-600">{item.id}</div>
        <div className="mt-3 text-xs text-amber-700 font-medium">View details →</div>
      </div>
    </Link>
  );
}

function EducationBlock({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="text-lg font-semibold">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-gray-700">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function GemstonesHubPage() {
  const all = await fetchAllPublicListings();

  const featured = all
    .filter((x) => !!(x as any).approvedAt) // approved-only for feature row
    .sort(
      (a, b) =>
        ((b as any).approvedAt || (b as any).createdAt || 0) -
        ((a as any).approvedAt || (a as any).createdAt || 0)
    )
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* Hero */}
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <div className="text-3xl font-semibold">Natural Gemstones</div>
        <div className="mt-2 max-w-2xl text-gray-700">
          Explore certified gemstones with detailed photos/videos and easy WhatsApp enquiries.
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/gemstones/yellow-sapphire"
            className="rounded-xl bg-amber-700 px-5 py-3 text-white font-medium hover:bg-amber-800"
          >
            Shop Yellow Sapphire
          </Link>
          <Link
            href="https://wa.me/?text=Hi%20CityJeweller%2C%20I%20want%20help%20choosing%20a%20gemstone."
            className="rounded-xl border px-5 py-3 font-medium hover:bg-gray-50"
          >
            Talk to Expert (WhatsApp)
          </Link>
        </div>
      </div>

      {/* Categories */}
      <div className="mt-10">
        <div className="text-xl font-semibold">Shop by Category</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CategoryCard
            title="Yellow Sapphire (Pukhraj)"
            subtitle="IGI-certified options • photos/videos"
            href="/gemstones/yellow-sapphire"
            active
          />
          <CategoryCard title="Blue Sapphire" subtitle="Coming soon" href="#" active={false} />
          <CategoryCard title="Ruby" subtitle="Coming soon" href="#" active={false} />
          <CategoryCard title="Emerald" subtitle="Coming soon" href="#" active={false} />
          <CategoryCard title="Pearl" subtitle="Coming soon" href="#" active={false} />
          <CategoryCard title="Opal" subtitle="Coming soon" href="#" active={false} />
        </div>
      </div>

      {/* Featured */}
      <div className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Featured Yellow Sapphires</div>
            <div className="text-sm text-gray-600">Recently approved items</div>
          </div>
          <Link href="/gemstones/yellow-sapphire" className="text-sm font-medium text-amber-700">
            View all →
          </Link>
        </div>

        <div className="mt-4 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((item) => (
            <FeaturedCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Education */}
      <div className="mt-10">
        <div className="text-xl font-semibold">Gemstone Buying Guide</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <EducationBlock
            title="What affects price?"
            points={[
              "Certification & lab report",
              "Color tone + clarity",
              "Treatment status (if any)",
              "Size/measurement and overall appeal",
            ]}
          />
          <EducationBlock
            title="How to shortlist quickly"
            points={[
              "Start with certified stones",
              "Filter by color & clarity",
              "Compare base rate & margin",
              "WhatsApp enquiry for final check",
            ]}
          />
          <EducationBlock
            title="After purchase"
            points={[
              "Store separately to avoid scratches",
              "Avoid harsh chemicals",
              "Keep certificate/invoice safely",
            ]}
          />
        </div>
      </div>
    </div>
  );
}
