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
  { value: "RADIANT", label: "Radiant", img: imgOrPlaceholder("/supplier/ys/shapes/radiant.png", "Radiant") },
];

// ✅ CLARITIES
export const CLARITIES: Choice[] = [
  { value: NOT_DEFINED, label: "Not Defined", img: imgOrPlaceholder("/supplier/ys/common/not-defined.png", "Not Defined") },

  { value: "VVS", label: "VVS", img: imgOrPlaceholder("/supplier/ys/clarity/vvs.png", "VVS") },
  { value: "VS", label: "VS", img: imgOrPlaceholder("/supplier/ys/clarity/vs.png", "VS") },
  { value: "SI", label: "SI", img: imgOrPlaceholder("/supplier/ys/clarity/si.png", "SI") },
  { value: "I", label: "I", img: imgOrPlaceholder("/supplier/ys/clarity/i.png", "I") },
];

// ✅ COLORS
export const COLORS: Choice[] = [
  { value: NOT_DEFINED, label: "Not Defined", img: imgOrPlaceholder("/supplier/ys/common/not-defined.png", "Not Defined") },

  { value: "LIGHT_YELLOW", label: "Light Yellow", img: imgOrPlaceholder("/supplier/ys/colors/light-yellow.png", "Light Yellow") },
  { value: "MEDIUM_YELLOW", label: "Medium Yellow", img: imgOrPlaceholder("/supplier/ys/colors/medium-yellow.png", "Medium Yellow") },
  { value: "VIVID_YELLOW", label: "Vivid Yellow", img: imgOrPlaceholder("/supplier/ys/colors/vivid-yellow.png", "Vivid Yellow") },
];

export const TREATMENTS = [NOT_DEFINED, "Heated", "Unheated", "Diffused"];
export const LUSTERS = [NOT_DEFINED, "Excellent", "Very Good", "Good", "Fair"];
export const ORIGINS = [NOT_DEFINED, "Sri Lanka", "Madagascar", "Thailand", "Burma", "Other"];
export const CERTIFIED = [NOT_DEFINED, "IGI", "GIA", "Gubelin", "SSEF", "No"];
