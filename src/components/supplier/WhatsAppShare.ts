import type { YellowSapphireListing } from "@/lib/yellowSapphire/types";

export function buildWhatsAppMessage(items: YellowSapphireListing[]) {
  const lines: string[] = [];
  lines.push("Yellow Sapphire Listings:");

  items.forEach((it, idx) => {
    const link = `https://cityjeweller.in/catalog/yellow-sapphire/${encodeURIComponent(it.skuId)}`;
    const row =
      `${idx + 1}) ${it.skuId} | ${it.weightCarat} ct | ${it.shapeCut} | ${it.color} | ₹${it.ratePerCaratInr}/ct`;
    lines.push(row);
    lines.push(link);
    lines.push(""); // spacer
  });

  return lines.join("\n");
}

export function openWhatsAppShare(text: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}
