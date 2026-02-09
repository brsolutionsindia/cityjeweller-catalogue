// src/lib/rudraksha/options.ts
import type {
  ProductCategory,
  WearType,
  MukhiType,
  Origin,
  RudrakshaShape,
  RudrakshaOrigin,
  RudrakshaType,
} from "@/lib/rudraksha/types";

/**
 * UI Options
 */

export const PRODUCT_CATEGORY_TABS: { key: ProductCategory; label: string }[] = [
  { key: "LOOSE_RUDRAKSHA_BEAD", label: "Loose Bead" },
  { key: "RUDRAKSHA_BRACELET", label: "Bracelet" },
  { key: "RUDRAKSHA_MALA", label: "Mala (Japa/Wear)" },
  { key: "RUDRAKSHA_PENDANT", label: "Pendant" },
  { key: "RUDRAKSHA_RING", label: "Ring" },
  { key: "RUDRAKSHA_EARRINGS", label: "Earrings" },
  { key: "RUDRAKSHA_GEMSTONE_JEWELLERY", label: "Rudraksha + Gemstone" },
  { key: "RUDRAKSHA_GIFT_SET", label: "Gift Set" },
  { key: "OTHER", label: "Other" },
];

export const WEAR_CHIPS: { key: WearType; label: string; tag: string }[] = [
  { key: "DAILY_WEAR", label: "Daily Wear", tag: "dailywear" },
  { key: "SPIRITUAL_JAPA", label: "Spiritual / Japa", tag: "japa" },
  { key: "OCCASIONAL_FESTIVAL", label: "Occasional / Festival", tag: "festival" },
  { key: "ASTROLOGY_HEALING", label: "Astrology / Healing", tag: "healing" },
  { key: "GIFTING", label: "Gifting", tag: "gifting" },
];

export const MUKHI_TABS: { key: MukhiType; label: string; tag: string }[] = [
  { key: "1_MUKHI", label: "1 Mukhi", tag: "1mukhi" },
  { key: "2_MUKHI", label: "2 Mukhi", tag: "2mukhi" },
  { key: "3_MUKHI", label: "3 Mukhi", tag: "3mukhi" },
  { key: "4_MUKHI", label: "4 Mukhi", tag: "4mukhi" },
  { key: "5_MUKHI", label: "5 Mukhi", tag: "5mukhi" },
  { key: "6_MUKHI", label: "6 Mukhi", tag: "6mukhi" },
  { key: "7_MUKHI", label: "7 Mukhi", tag: "7mukhi" },
  { key: "8_MUKHI", label: "8 Mukhi", tag: "8mukhi" },
  { key: "9_MUKHI", label: "9 Mukhi", tag: "9mukhi" },
  { key: "10_MUKHI", label: "10 Mukhi", tag: "10mukhi" },
  { key: "11_MUKHI", label: "11 Mukhi", tag: "11mukhi" },
  { key: "12_MUKHI", label: "12 Mukhi", tag: "12mukhi" },
  { key: "13_MUKHI", label: "13 Mukhi", tag: "13mukhi" },
  { key: "14_MUKHI", label: "14 Mukhi", tag: "14mukhi" },
  { key: "GAURI_SHANKAR", label: "Gauri Shankar", tag: "gaurishankar" },
  { key: "GANESH", label: "Ganesh", tag: "ganesh" },
  { key: "TRIJUTI", label: "Trijuti", tag: "trijuti" },
  { key: "OTHER", label: "Other", tag: "rudraksha" },
];

export const ORIGIN_TABS: { key: Origin; label: string; tag: string }[] = [
  { key: "NEPAL", label: "Nepal", tag: "nepalrudraksha" },
  { key: "INDONESIA_JAVA", label: "Indonesia (Java)", tag: "javarudraksha" },
  { key: "INDIA", label: "India", tag: "indiarudraksha" },
  { key: "OTHER", label: "Other", tag: "rudraksha" },
];

export const SHAPE_TABS: { key: RudrakshaShape; label: string; tag: string }[] = [
  { key: "ROUND", label: "Round", tag: "roundbead" },
  { key: "OVAL", label: "Oval", tag: "ovalbead" },
  { key: "NATURAL_IRREGULAR", label: "Natural Irregular", tag: "naturalbead" },
];

/**
 * Legacy / Simple dropdown options (kept for compatibility)
 */

export const RUDRAKSHA_TYPES: { label: string; value: RudrakshaType }[] = [
  { label: "Mala", value: "MALA" },
  { label: "Bracelet", value: "BRACELET" },
  { label: "Pendant", value: "PENDANT" },
  { label: "Ring", value: "RING" },
  { label: "Loose Bead", value: "LOOSE_BEAD" },
  { label: "Kawach", value: "KAWACH" },
  { label: "Jap Mala", value: "JAP_MALA" },
  { label: "Combo", value: "COMBO" },
  { label: "Other", value: "OTHER" },
];

export const ORIGINS: { label: string; value: RudrakshaOrigin }[] = [
  { label: "Nepal", value: "NEPAL" },
  { label: "Indonesia", value: "INDONESIA" },
  { label: "India", value: "INDIA" },
  { label: "Bhutan", value: "BHUTAN" },
  { label: "Unknown", value: "UNKNOWN" },
];

/**
 * Tags helpers
 * (single unified implementation used by everything)
 */

export function normalizeTag(x: unknown) {
  return String(x ?? "")
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function uniqTags(tags: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags || []) {
    const nt = normalizeTag(t);
    if (!nt) continue;
    if (seen.has(nt)) continue;
    seen.add(nt);
    out.push(nt);
  }
  return out;
}

/**
 * Auto-tags (from your richer options file)
 */
export function deriveAutoTags(params: {
  productCategory?: string | null;
  intendedWearTypes?: string[] | null;
  mukhiType?: string | null;
  origin?: string | null;
}) {
  const tags: string[] = ["rudraksha"];
  if (params.productCategory) tags.push(normalizeTag(params.productCategory));
  if (params.mukhiType) tags.push(normalizeTag(params.mukhiType));
  if (params.origin) tags.push(normalizeTag(params.origin));
  for (const w of params.intendedWearTypes || []) tags.push(normalizeTag(w));
  return uniqTags(tags);
}

/**
 * Item name generator (from your simpler options file)
 */
export function generateItemName(params: {
  type?: string;
  mukhi?: number | null;
  origin?: string | null;
  material?: string | null;
  tags?: string[];
}) {
  const parts: string[] = [];
  if (params.mukhi) parts.push(`${params.mukhi} Mukhi`);
  parts.push(params.type ? title(params.type) : "Rudraksha");
  if (params.origin && params.origin !== "UNKNOWN") parts.push(title(params.origin));
  if (params.material) parts.push(title(params.material));
  const t = (params.tags || []).map(normalizeTag).filter(Boolean).slice(0, 2);
  if (t.length) parts.push(t.map((x) => `#${x}`).join(" "));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function title(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
