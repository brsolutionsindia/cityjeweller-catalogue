// src/lib/rudraksha/types.ts

/**
 * Status / enums
 */
export type RudrakshaStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export type RudrakshaNature = "RUDRAKSHA" | "RUDRAKSHA_JEWELLERY"; // optional, for future

export type RudrakshaType =
  | "MALA"
  | "BRACELET"
  | "PENDANT"
  | "RING"
  | "LOOSE_BEAD"
  | "KAWACH"
  | "JAP_MALA"
  | "COMBO"
  | "OTHER";

/**
 * Rich product taxonomy (new)
 */
export type ProductCategory =
  | "LOOSE_RUDRAKSHA_BEAD"
  | "RUDRAKSHA_BRACELET"
  | "RUDRAKSHA_MALA"
  | "RUDRAKSHA_PENDANT"
  | "RUDRAKSHA_RING"
  | "RUDRAKSHA_EARRINGS"
  | "RUDRAKSHA_GEMSTONE_JEWELLERY"
  | "RUDRAKSHA_GIFT_SET"
  | "OTHER";

export type WearType =
  | "DAILY_WEAR"
  | "SPIRITUAL_JAPA"
  | "OCCASIONAL_FESTIVAL"
  | "ASTROLOGY_HEALING"
  | "GIFTING";

export type MukhiType =
  | "1_MUKHI"
  | "2_MUKHI"
  | "3_MUKHI"
  | "4_MUKHI"
  | "5_MUKHI"
  | "6_MUKHI"
  | "7_MUKHI"
  | "8_MUKHI"
  | "9_MUKHI"
  | "10_MUKHI"
  | "11_MUKHI"
  | "12_MUKHI"
  | "13_MUKHI"
  | "14_MUKHI"
  | "GAURI_SHANKAR"
  | "GANESH"
  | "TRIJUTI"
  | "OTHER";

export type RudrakshaShape = "ROUND" | "OVAL" | "NATURAL_IRREGULAR";

export type SurfaceCondition =
  | "NATURAL_UNPOLISHED"
  | "LIGHTLY_CLEANED_NO_OIL"
  | "OIL_TREATED"
  | "POLISHED";

export type AuthenticityStatus =
  | "NATURAL_RUDRAKSHA"
  | "CULTIVATED"
  | "LAB_PROCESSED";

export type CertAuthority =
  | "GOVERNMENT_LAB"
  | "GEMOLOGICAL_LAB"
  | "INDEPENDENT_RUDRAKSHA_LAB"
  | "SUPPLIER_SELF_DECLARATION";

export type JewelleryType =
  | "BRACELET"
  | "NECKLACE_MALA"
  | "PENDANT"
  | "RING"
  | "EARRINGS";

export type MetalUsed =
  | "SILVER"
  | "GOLD"
  | "PANCHDHATU"
  | "THREAD_CORD"
  | "STAINLESS_STEEL"
  | "OTHER";

export type AdditionalStones =
  | "NONE"
  | "SPHATIK"
  | "AMETHYST"
  | "TIGER_EYE"
  | "BLACK_ONYX"
  | "OTHER";

export type DeityAssociation =
  | "SHIVA"
  | "SHAKTI"
  | "VISHNU"
  | "GANESH"
  | "MULTIPLE"
  | "NONE_SPECIFIED";

export type ChakraAssociation =
  | "ROOT"
  | "HEART"
  | "THIRD_EYE"
  | "CROWN"
  | "MULTIPLE";

export type Benefit =
  | "PEACE_CALM"
  | "FOCUS_MEDITATION"
  | "PROTECTION"
  | "CONFIDENCE"
  | "HEALTH_BALANCE"
  | "SPIRITUAL_GROWTH";

export type PackagingType = "CLOTH_POUCH" | "WOODEN_BOX" | "PREMIUM_GIFT_BOX";

/**
 * Origins (both models supported)
 * - Origin: richer enum used by the new schema (Indonesia is split as Java)
 * - RudrakshaOrigin: legacy/simple dropdown with Bhutan/Unknown
 */
export type Origin = "NEPAL" | "INDONESIA_JAVA" | "INDIA" | "OTHER";

export type RudrakshaOrigin = "NEPAL" | "INDONESIA" | "INDIA" | "BHUTAN" | "UNKNOWN";

/**
 * Pricing (legacy/simple)
 */
export type PriceMode = "MRP" | "WEIGHT";

/**
 * Media (unified)
 */
export type MediaKind = "IMG" | "VID" | "CERT";

export type MediaItem = {
  id: string;
  kind: MediaKind; // IMG | VID | CERT
  url: string;
  storagePath: string;
  order?: number;
  createdAt?: number;
  updatedAt?: number;

  // optional metadata
  contentType?: string | null;

  // backward compatibility (very old)
  type?: "image" | "video" | "file";
};

/**
 * Submission (merged)
 * Keeps the richer schema, while also preserving legacy/simple fields for older UIs/data.
 */
export type RudrakshaSubmission = {
  skuId: string;
  gstNumber: string;
  supplierUid: string;

  // status: required in new schema, optional in legacy -> allow optional but keep compatible
  status?: RudrakshaStatus;

  createdAt?: number;
  updatedAt?: number;

  // -----------------------------
  // Legacy/simple core product
  // -----------------------------
  nature?: RudrakshaNature; // optional, for future
  type?: RudrakshaType;
  originLegacy?: RudrakshaOrigin; // renamed to avoid clashing with new 'origin'
  mukhi?: number | null; // 1..21 typically
  sizeMm?: number | null; // single bead size
  weightGm?: number | null;

  // legacy quality / compliance
  labCertified?: boolean | null;
  certificateLab?: string | null;
  energized?: boolean | null;
  natural?: boolean | null;

  // legacy jewellery fields
  material?: string | null;
  closure?: string | null;
  lengthInch?: number | null;

  // legacy pricing
  currency?: "INR";
  priceMode?: PriceMode | null;
  ratePerGm?: number | null;
  mrp?: number | null;
  offerPrice?: number | null;

  // legacy seo/search
  itemName?: string;

  // -----------------------------
  // New/rich schema fields
  // -----------------------------

  // PRODUCT TYPE SELECTION
  productCategory?: ProductCategory | null;
  productCategoryOther?: string | null;
  intendedWearTypes?: WearType[] | null;

  // RUDRAKSHA SPECIFICATIONS
  mukhiType?: MukhiType | null;
  mukhiOther?: string | null;

  // NOTE: new schema uses 'origin' (Origin), legacy uses 'originLegacy' (RudrakshaOrigin)
  origin?: Origin | null;
  originOther?: string | null;

  rudrakshaShape?: RudrakshaShape | null;

  beadSizeMinMm?: number | null;
  beadSizeMaxMm?: number | null;

  numberOfBeadsMode?: "SINGLE" | "MULTIPLE" | "54" | "108" | "CUSTOM" | null;
  numberOfBeadsCustom?: number | null;

  surfaceCondition?: SurfaceCondition | null;

  // AUTHENTICITY & CERTIFICATION
  authenticityStatus?: AuthenticityStatus | null;
  labProcessDetails?: string | null;

  certificationAvailable?: boolean | null;
  certifyingAuthority?: CertAuthority | null;

  xrayMukhiVerified?: boolean | null;
  waterTest?: "YES" | "NO" | "NOT_TESTED" | null;

  // JEWELLERY DETAILS (optional)
  jewelleryType?: JewelleryType | null;
  metalUsed?: MetalUsed | null;
  metalPurity?: string | null;
  metalWeightGm?: number | null;
  adjustableSize?: boolean | null;

  additionalStonesUsed?: AdditionalStones[] | null;
  additionalStonesOther?: string | null;

  // SPIRITUAL & ASTROLOGICAL
  presidingDeityAssociation?: DeityAssociation | null;
  chakraAssociation?: ChakraAssociation[] | null;
  suggestedBenefits?: Benefit[] | null;

  // PRICING & COMMERCIALS (new)
  costPrice?: number | null;
  suggestedMrp?: number | null;
  moq?: number | null;
  availableQty?: number | null;

  readyForMarginAdjustment?: boolean | null;

  returnPolicyAccepted?: boolean | null;
  returnPolicyDays?: number | null;

  // MEDIA
  media?: MediaItem[] | null;

  // CONTENT FOR WEBSITE
  productTitle?: string | null;
  shortDescription?: string | null;
  detailedDescription?: string | null;
  careInstructions?: string | null;
  packagingType?: PackagingType | null;

  // DECLARATIONS
  declarationNaturalAndAccurate?: boolean | null;
  declarationFalseClaimsLegal?: boolean | null;
  declarationCityjewellerModify?: boolean | null;

  mahashivratriSpecialAvailability?: boolean | null;

  // DISCOVERY
  tags?: string[] | null;

  // admin fields (optional)
  adminMarginPct?: number | null;
  computedBasePrice?: number | null;
  computedPublicPrice?: number | null;
  computedPriceSource?: string | null;

  rejectionReason?: string | null;
  approvedAt?: number | null;
  approvedBy?: string | null;
  rejectedAt?: number | null;
  rejectedBy?: string | null;
};
