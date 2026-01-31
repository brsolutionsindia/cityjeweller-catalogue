// src/lib/yellowSapphire/options.ts

export type Choice = {
  value: string;
  label: string;
  img?: string; // optional
};

export const NOT_DEFINED = "NOT_DEFINED";

/**
 * UI TILE STANDARD
 * We'll render tiles using a fixed aspect ratio (recommended: 4/3 or 1/1) and `object-contain`.
 * Placeholder uses the same ratio to avoid layout shifts.
 */
const TILE_W = 400;
const TILE_H = 300; // 4:3

const placeholder = (label: string) =>
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${TILE_H}" viewBox="0 0 ${TILE_W} ${TILE_H}">
      <rect width="100%" height="100%" rx="24" ry="24" fill="#f3f4f6"/>
      <rect x="18" y="18" width="${TILE_W - 36}" height="${TILE_H - 36}" rx="18" ry="18" fill="#ffffff"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        fill="#111827" font-size="22" font-family="Arial">${label}</text>
    </svg>`
  );

const imgOrPlaceholder = (img: string | undefined, label: string) => img || placeholder(label);

// ✅ SHAPES
export const SHAPES: Choice[] = [
  { value: NOT_DEFINED, label: "Not Defined", img: imgOrPlaceholder("/supplier/ys/common/not-defined.png", "Not Defined") },

  { value: "OVAL", label: "Oval", img: imgOrPlaceholder("/supplier/ys/shapes/oval.png", "Oval") },
  { value: "CUSHION", label: "Cushion", img: imgOrPlaceholder("/supplier/ys/shapes/cushion.png", "Cushion") },
  { value: "ROUND", label: "Round", img: imgOrPlaceholder("/supplier/ys/shapes/round.png", "Round") },
  { value: "EMERALD", label: "Emerald", img: imgOrPlaceholder("/supplier/ys/shapes/emerald.png", "Emerald") },
  { value: "PEAR", label: "Pear", img: imgOrPlaceholder("/supplier/ys/shapes/pear.png", "Pear") },
  { value: "MARQUISE", label: "Marquise", img: imgOrPlaceholder("/supplier/ys/shapes/marquise.png", "Marquise") },
  { value: "TRILLION", label: "Trillion", img: imgOrPlaceholder("/supplier/ys/shapes/trillion.png", "Trillion") },
  { value: "Heart", label: "Heart", img: imgOrPlaceholder("/supplier/ys/shapes/heart.png", "Heart") },
  { value: "CABOCHON", label: "Cabochon", img: imgOrPlaceholder("/supplier/ys/shapes/cabochon.png", "Cabochon") },
];

// ✅ CLARITIES
export const CLARITIES: Choice[] = [
  { value: NOT_DEFINED, label: "Not Defined", img: imgOrPlaceholder("/supplier/ys/common/not-defined.png", "Not Defined") },
  { value: "EYE CLEAN", label: "Eye Clean", img: imgOrPlaceholder("/supplier/ys/clarity/eye-clean.png", "Eye Clean") },
  { value: "SLIGHTLY INCLUDED", label: "Slightly Included", img: imgOrPlaceholder("/supplier/ys/clarity/slightly-included.png", "Slightly Included") },
  { value: "HEAVILY INCLUDED", label: "Heavily Included", img: imgOrPlaceholder("/supplier/ys/clarity/heavily-included.png", "Heavily Included") },
];

// ✅ TRANSPARENCY
export const TRANSPARENCY: Choice[] = [
  { value: NOT_DEFINED, label: "Not Defined", img: imgOrPlaceholder("/supplier/ys/common/not-defined.png", "Not Defined") },
  { value: "TRANSLUCENT", label: "Translucent", img: imgOrPlaceholder("/supplier/ys/transparency/translucent.png", "Translucent") },
  { value: "SEMI TRANSPARENT", label: "Semi Transparent", img: imgOrPlaceholder("/supplier/ys/transparency/semi-transparent.png", "Semi Transparent") },
  { value: "OPAQUE", label: "Opaque", img: imgOrPlaceholder("/supplier/ys/transparency/opaque.png", "Opaque") },
];

// ✅ COLORS
export const COLORS: Choice[] = [
  { value: NOT_DEFINED, label: "Not Defined", img: imgOrPlaceholder("/supplier/ys/common/not-defined.png", "Not Defined") },

  { value: "LEMON_YELLOW", label: "Lemon Yellow", img: imgOrPlaceholder("/supplier/ys/colors/lemon-yellow.png", "Lemon Yellow") },
  { value: "GOLDEN_YELLOW", label: "Golden Yellow", img: imgOrPlaceholder("/supplier/ys/colors/golden-yellow.png", "Golden Yellow") },
  { value: "CANARY_YELLOW", label: "Canary Yellow", img: imgOrPlaceholder("/supplier/ys/colors/canary-yellow.png", "Canary Yellow") },
  { value: "BASRA_YELLOW", label: "Basra Yellow", img: imgOrPlaceholder("/supplier/ys/colors/basra-yellow.png", "Basra Yellow") },
  { value: "HONEY_YELLOW", label: "Honey Yellow", img: imgOrPlaceholder("/supplier/ys/colors/honey-yellow.png", "Honey Yellow") },
  { value: "CHAMPAGNE_YELLOW", label: "Champagne Yellow", img: imgOrPlaceholder("/supplier/ys/colors/champagne-yellow.png", "Champagne Yellow") },
];

export const TREATMENTS = [NOT_DEFINED, "Heated", "Unheated", "Diffused"];
export const LUSTERS = [NOT_DEFINED, "Excellent", "Very Good", "Good", "Fair"];
export const ORIGINS = [NOT_DEFINED, "Sri Lanka", "Madagascar", "Thailand", "Burma", "Other"];
export const CERTIFIED = [NOT_DEFINED, "IGI", "GIA", "Gubelin", "SSEF", "No"];
