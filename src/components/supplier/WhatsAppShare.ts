// src/components/supplier/WhatsAppShare.ts

import type {
  YellowSapphireSubmission,
  YellowSapphireListing,
} from "@/lib/yellowSapphire/types";

type ShareItem = Pick<
  YellowSapphireSubmission,
  | "skuId"
  | "shapeCut"
  | "color"
  | "clarity"
  | "weightCarat"
  | "ratePerCaratInr"
  | "measurementMm"
  | "origin"
  | "certified"
  | "treatmentStatus"
  | "luster"
  | "remarks"
  | "media"
  | "status"
>;

// ✅ Allow both (since Listing is a subset-ish of fields we use)
export function buildWhatsAppMessage(items: ShareItem[]) {
  const lines: string[] = [];

  lines.push(`Yellow Sapphire Listing(s): ${items.length}`);
  lines.push("");

  items.forEach((it, idx) => {
    const thumb =
      it.media?.thumbUrl ||
      it.media?.images?.[0]?.url ||
      it.media?.videos?.[0]?.url ||
      "";

    lines.push(`${idx + 1}) SKU: ${it.skuId}`);
    lines.push(`• ${it.shapeCut} • ${it.color} • ${it.clarity} • ${it.weightCarat} ct`);
    lines.push(`• Rate/ct: ₹${it.ratePerCaratInr}`);
    if (it.measurementMm) lines.push(`• Measurement: ${it.measurementMm}`);
    if (it.origin) lines.push(`• Origin: ${it.origin}`);
    if (it.certified) lines.push(`• Certified: ${it.certified}`);
    if (it.treatmentStatus) lines.push(`• Treatment: ${it.treatmentStatus}`);
    if (it.luster) lines.push(`• Luster: ${it.luster}`);
    if (it.status) lines.push(`• Status: ${it.status}`);
    if (it.remarks) lines.push(`• Remarks: ${it.remarks}`);
    if (thumb) lines.push(`• Media: ${thumb}`);
    lines.push("");
  });

  return lines.join("\n");
}

export function openWhatsAppShare(text: string) {
  const link = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(link, "_blank", "noopener,noreferrer");
}
