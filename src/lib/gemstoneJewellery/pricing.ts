import type { GemstoneJewellerySubmission } from "./types";

export function computeOfferPrice(sub: GemstoneJewellerySubmission): number | null {
  const mode = sub.priceMode || "MRP";

  if (mode === "MRP") {
    const p = sub.offerPrice ?? sub.mrp ?? null;
    return typeof p === "number" && Number.isFinite(p) ? Math.round(p) : null;
  }

  // WEIGHT
  const w = sub.weightGm;
  const r = sub.ratePerGm;
  if (typeof w !== "number" || !Number.isFinite(w) || w <= 0) return null;
  if (typeof r !== "number" || !Number.isFinite(r) || r <= 0) return null;
  return Math.round(w * r);
}
