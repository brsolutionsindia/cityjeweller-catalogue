export type PriceMode = "MRP" | "WEIGHT";

export type Nature = "NATURAL" | "ARTIFICIAL";
export type GJType =
  | "BRACELET"
  | "STRING"
  | "NECKLACE"
  | "EARRINGS"
  | "RING"
  | "PENDANT"
  | "SET";

export type GJStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "SUPPLIER_REVIEW";

export type TagCategory = "colors" | "stones" | "styles" | "types";

export type MediaKind = "IMG" | "VID";

export type MediaItem = {
  id: string;
  kind: MediaKind;

  url: string;          // download URL
  storagePath: string;  // Firebase Storage path
  order: number;

  width?: number;
  height?: number;

  durationSec?: number; // for video
  thumbUrl?: string;    // optional for video thumb

  // ✅ timestamps (ms)
  createdAt?: number;
  updatedAt?: number;

  // ✅ optional metadata (helps UI + replace logic)
  contentType?: string;            // e.g. "image/jpeg" / "video/mp4"
  type?: "image" | "video";        // for backward-compat with older records (your asKind checks this)
};


export type TagMap = Partial<Record<TagCategory, string[]>>;

export type GemstoneJewellerySubmission = {
  skuId: string;

  gstNumber: string;
  supplierUid: string;

  status: GJStatus;
  createdAt?: number; // ms
  updatedAt?: number; // ms

  // core
  nature: Nature;
  type: GJType;

  // stone naming
  stoneName?: string; // e.g. "Amethyst", "Pearl", "Aventurine"
  lookName?: string;  // for artificial: "Ruby Look", "Emerald Look" etc

  // optional descriptors
  material?: string;  // Thread / Silver / Alloy / Elastic / Adjustable
  closure?: string;   // Hook / Adjustable / Elastic
  beadSizeMm?: number;
  lengthInch?: number;
  weightGm?: number;
  ratePerGm?: number;

  priceMode?: PriceMode;
  // pricing
  mrp?: number;
  offerPrice?: number;
  currency?: "INR";

  // tags
  tags: string[];     // flat list: ["red","pearl","dailywear"]
  tagsByCategory?: TagMap;

  // title
  itemName: string;   // auto-generated but editable

  // media (same management logic as Yellow Sapphire)
  media: MediaItem[];

  // admin moderation
  adminNote?: string;       // internal
  rejectionReason?: string; // shown to supplier

  // NEW: tracking when hidden from website
  hiddenAt?: number;        // timestamp when hidden
  hiddenBy?: string;        // admin uid who hid it
  hiddenReason?: string;    // why it was hidden

  // visibility flags (optional for later)
  featured?: boolean;
};
