import type { GJType, Nature } from "./types";

export const GJ_TYPES: { value: GJType; label: string }[] = [
  { value: "BRACELET", label: "Bracelet" },
  { value: "STRING", label: "String / Mala" },
  { value: "NECKLACE", label: "Necklace" },
  { value: "EARRINGS", label: "Earrings" },
  { value: "RING", label: "Ring" },
  { value: "PENDANT", label: "Pendant" },
  { value: "SET", label: "Set" },
];

export const DEFAULT_STYLE_FALLBACK = "classic";

// -------- tag helpers --------
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function uniqTags(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags.map(normalizeTag).filter(Boolean)) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

// -------- item name generator --------
// Title Case helper
function titleCase(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function typeLabel(type: GJType): string {
  const found = GJ_TYPES.find(x => x.value === type)?.label ?? type;
  // "String / Mala" -> prefer "String" in item name
  if (found.toLowerCase().includes("string")) return "String";
  return found.replace("/", " ").replace(/\s+/g, " ").trim();
}

/**
 * Auto-generate Item Name as per your standard:
 *   <PrimaryStoneOrLook> <Style> <Type>
 * Examples:
 *   "Ruby Look Statement Necklace"
 *   "Natural Amethyst Bead String"
 *   "Pearl Classic Bracelet"
 */
export function generateItemName(params: {
  nature: Nature;
  type: GJType;
  stoneName?: string;
  lookName?: string;
  styleTags?: string[]; // expects normalized tags, but handles raw too
}): string {
  const { nature, type } = params;

  const style =
    (params.styleTags || [])
      .map(normalizeTag)
      .find(t =>
        ["statement", "dailywear", "minimal", "boho", "bridal", "temple", "healing", "classic"].includes(t)
      ) ?? DEFAULT_STYLE_FALLBACK;

  const typeTxt = typeLabel(type);

  if (nature === "ARTIFICIAL") {
    const look = params.lookName?.trim() || "Gemstone Look";
    return `${titleCase(look)} ${titleCase(style)} ${titleCase(typeTxt)}`.replace(/\s+/g, " ").trim();
  }

  // NATURAL
  const stone = params.stoneName?.trim() || "Gemstone";
  // Optionally include "Natural" prefix for clarity
  return `Natural ${titleCase(stone)} ${titleCase(style)} ${titleCase(typeTxt)}`.replace(/\s+/g, " ").trim();
}
