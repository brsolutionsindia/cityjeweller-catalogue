import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getListing,
  getAllMedia,
  getPrimaryImageUrl,
  getPublicPricePerCaratInr,
  getTotalPriceInr,
} from "@/lib/firebase/yellowSapphireDb";

export const dynamic = "force-dynamic";

function formatINR(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-3 text-sm">
      <div className="text-gray-600">{label}</div>
      <div className="font-medium text-right">{value}</div>
    </div>
  );
}

export default async function YellowSapphireDetailPage({ params }: { params: { id: string } }) {
  const skuId = decodeURIComponent(params.id);
  const item = await getListing(skuId);
  if (!item) return notFound();

  const hero = getPrimaryImageUrl(item);
  const media = getAllMedia(item);
  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");

  const ppc = getPublicPricePerCaratInr(item);
  const total = getTotalPriceInr(item);

  const waText = encodeURIComponent(
    `Hi CityJeweller,\n\nI am interested in Yellow Sapphire:\nSKU: ${item.skuId}\nCertified: ${item.certified}\nColor: ${item.color}\nClarity: ${item.clarity}\nOrigin: ${item.origin}\nTreatment: ${item.treatmentStatus}\nCarat: ${item.weightCarat}\nPrice/ct: ${ppc ?? "-"}\nTotal: ${total ?? "-"}\n\nPlease confirm availability and best offer.`
  );
  const waLink = `https://wa.me/?text=${waText}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="text-sm text-gray-600">
        <Link href="/gemstones" className="hover:underline">Gemstones</Link> /{" "}
        <Link href="/gemstones/yellow-sapphire" className="hover:underline">Yellow Sapphire</Link> /{" "}
        {item.skuId}
      </div>

      <div className="mt-3 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
            <div className="relative aspect-square bg-gray-50">
              {hero ? (
                <Image src={hero} alt={item.skuId} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 55vw" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">No image</div>
              )}
            </div>

            {images.length > 1 ? (
              <div className="grid grid-cols-6 gap-2 p-3">
                {images.slice(0, 12).map((m, idx) => (
                  <a
                    key={idx}
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative aspect-square overflow-hidden rounded-xl border bg-gray-50 hover:opacity-90"
                    title="Open full image"
                  >
                    <Image src={m.url} alt={`${item.skuId} ${idx + 1}`} fill className="object-cover" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {videos.length > 0 ? (
            <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold">Videos</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {videos.map((v, i) => (
                  <video key={i} controls className="w-full rounded-xl border bg-black" src={v.url} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="text-2xl font-semibold">Yellow Sapphire</div>
            <div className="mt-1 text-sm text-gray-600">{item.skuId}</div>

            <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Price/ct</span>
                <span className="font-semibold">{formatINR(ppc)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-gray-600">Total</span>
                <span className="font-semibold">{formatINR(total)}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <a href={waLink} className="rounded-xl bg-amber-700 px-5 py-3 text-center text-white font-medium hover:bg-amber-800">
                WhatsApp Enquiry
              </a>
              <a href="tel:+910000000000" className="rounded-xl border px-5 py-3 text-center font-medium hover:bg-gray-50">
                Call
              </a>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold">Specifications</div>
              <div className="mt-3">
                <SpecRow label="Status" value={item.status} />
                <SpecRow label="Certified" value={item.certified} />
                <SpecRow label="Origin" value={item.origin} />
                <SpecRow label="Treatment" value={item.treatmentStatus} />
                <SpecRow label="Color" value={item.color.replaceAll("_", " ")} />
                <SpecRow label="Clarity" value={item.clarity} />
                <SpecRow label="Luster" value={item.luster} />
                <SpecRow label="Shape/Cut" value={item.shapeCut} />
                <SpecRow label="Carat" value={item.weightCarat.toFixed(2)} />
                <SpecRow label="Measurement (mm)" value={item.measurementMm} />
              </div>
            </div>

            {item.remarks ? (
              <div className="mt-6 rounded-2xl border p-4">
                <div className="text-sm font-semibold">Remarks</div>
                <div className="mt-2 text-sm text-gray-700">{item.remarks}</div>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <Link href="/gemstones/yellow-sapphire" className="text-sm font-medium text-amber-700">
              ← Back to Yellow Sapphire listing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
