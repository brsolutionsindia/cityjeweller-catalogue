# Gemstone-Jewellery Module Enhancement: Implementation Guide

## Phase 1: Quick Wins (Start Here)

### 1. Add Certificate Media Support

**Goal:** Allow gemstone products to have certification documents (PDFs, images) just like Rudraksha.

**File 1: Update types.ts**

Replace `MediaKind` type from:
```typescript
export type MediaKind = "IMG" | "VID";
```

To:
```typescript
export type MediaKind = "IMG" | "VID" | "CERT";
```

This matches the Rudraksha pattern exactly.

**File 2: Update gemstoneJewelleryDb.ts**

In the `makeMediaFileName()` function, update to support CERT:

```typescript
function makeMediaFileName(skuId: string, kind: "IMG" | "VID" | "CERT", file: File) {
  // ... existing code remains the same
}
```

Also update the `asKind()` function (around line 165):

```typescript
function asKind(m: any): "IMG" | "VID" | "CERT" {
  if (m?.kind === "IMG" || m?.kind === "VID" || m?.kind === "CERT") return m.kind;
  if (m?.type === "video") return "VID";
  if (m?.type === "file") return "CERT";  // NEW: treat file type as CERT
  return "IMG";
}
```

**File 3: Update gemstoneJewelleryPublicDb.ts**

Update the `asKind()` function:

```typescript
function asKind(m: any): "IMG" | "VID" | "CERT" {
  if (m?.kind === "IMG" || m?.kind === "VID" || m?.kind === "CERT") return m.kind;
  if (m?.type === "video") return "VID";
  if (m?.type === "file") return "CERT";  // NEW
  return "IMG";
}
```

**Time: 15 minutes | Impact: HIGH (enables certification)**

---

### 2. Add Product Category Enum

**Goal:** Replace generic `type` with structured product categories like Rudraksha's `ProductCategory`.

**File: src/lib/gemstoneJewellery/types.ts**

Add new enum before `MediaKind`:

```typescript
/**
 * Rich Product Categories (mirroring rudraksha pattern)
 */
export type GemstoneCategory =
  | "LOOSE_GEMSTONE"
  | "GEMSTONE_BRACELET"
  | "GEMSTONE_STRING"
  | "GEMSTONE_NECKLACE"
  | "GEMSTONE_RING"
  | "GEMSTONE_PENDANT"
  | "GEMSTONE_EARRINGS"
  | "GEMSTONE_SET"
  | "OTHER";

export type GemstoneQuality =
  | "NATURAL_UNTREAT"
  | "NATURAL_HEAT_TREATED"
  | "NATURAL_LAB_CERTIFIED"
  | "SYNTHETIC"
  | "IMITATION"
  | "OTHER";
```

Then update the `GemstoneJewellerySubmission` type to add:

```typescript
export type GemstoneJewellerySubmission = {
  // ... existing fields ...
  
  // NEW: Rich taxonomy (alongside legacy 'type' for backward compatibility)
  productCategory?: GemstoneCategory | null;
  productCategoryOther?: string | null;
  
  quality?: GemstoneQuality | null;
  qualityOther?: string | null;
  
  // ... rest of existing fields ...
};
```

**Time: 10 minutes | Impact: HIGH (enables filtering)**

---

### 3. Add Options Configuration

**File: src/lib/gemstoneJewellery/options.ts**

Add category and quality options at the top:

```typescript
import type { GJType, Nature, GemstoneCategory, GemstoneQuality } from "./types";

// Existing GJ_TYPES...

export const GEMSTONE_CATEGORY_TABS: { key: GemstoneCategory; label: string; tag: string }[] = [
  { key: "LOOSE_GEMSTONE", label: "Loose Gemstone", tag: "loose" },
  { key: "GEMSTONE_BRACELET", label: "Bracelet", tag: "bracelet" },
  { key: "GEMSTONE_STRING", label: "String / Mala", tag: "string" },
  { key: "GEMSTONE_NECKLACE", label: "Necklace", tag: "necklace" },
  { key: "GEMSTONE_RING", label: "Ring", tag: "ring" },
  { key: "GEMSTONE_PENDANT", label: "Pendant", tag: "pendant" },
  { key: "GEMSTONE_EARRINGS", label: "Earrings", tag: "earrings" },
  { key: "GEMSTONE_SET", label: "Set", tag: "set" },
  { key: "OTHER", label: "Other", tag: "gemstone" },
];

export const GEMSTONE_QUALITY_TABS: { key: GemstoneQuality; label: string; tag: string }[] = [
  { key: "NATURAL_UNTREAT", label: "Natural (Untreated)", tag: "natural-untreated" },
  { key: "NATURAL_HEAT_TREATED", label: "Natural (Heat-Treated)", tag: "natural-heat-treated" },
  { key: "NATURAL_LAB_CERTIFIED", label: "Natural (Lab Certified)", tag: "natural-certified" },
  { key: "SYNTHETIC", label: "Synthetic / Lab Created", tag: "synthetic" },
  { key: "IMITATION", label: "Imitation / Look-alike", tag: "imitation" },
  { key: "OTHER", label: "Other", tag: "gemstone" },
];
```

**Time: 5 minutes | Impact: MEDIUM**

---

### 4. Update Auto-Tag Generation

**File: src/lib/gemstoneJewellery/options.ts**

Add function after `generateItemName()`:

```typescript
/**
 * Auto-generate tags from rich taxonomy
 * (mirrors rudraksha pattern)
 */
export function deriveAutoTags(params: {
  productCategory?: string | null;
  quality?: string | null;
  nature?: string | null;
  tags?: string[];
}): string[] {
  const tags: string[] = ["gemstone"];
  
  if (params.nature) tags.push(normalizeTag(params.nature));
  if (params.productCategory) tags.push(normalizeTag(params.productCategory));
  if (params.quality) tags.push(normalizeTag(params.quality));
  
  // Include existing manual tags
  if (params.tags) {
    for (const t of params.tags) tags.push(normalizeTag(t));
  }
  
  return uniqTags(tags);
}
```

**Time: 5 minutes | Impact: HIGH (auto-tagging)**

---

### 5. Update Item Name Generator

**File: src/lib/gemstoneJewellery/options.ts**

Enhance the existing `generateItemName()`:

```typescript
export function generateItemName(params: {
  nature: Nature;
  type: GJType;
  quality?: GemstoneQuality;  // NEW
  stoneName?: string;
  lookName?: string;
  styleTags?: string[];
}): string {
  const { nature, type } = params;

  const style =
    (params.styleTags || [])
      .map(normalizeTag)
      .find(t =>
        ["statement", "dailywear", "minimal", "boho", "bridal", "temple", 
         "healing", "classic", "vintage", "modern", "traditional", "fusion"].includes(t)
      ) ?? DEFAULT_STYLE_FALLBACK;

  const typeTxt = typeLabel(type);
  
  // Quality prefix for premium items
  const qualityPrefix = params.quality === "NATURAL_LAB_CERTIFIED" ? "Certified " : "";

  if (nature === "ARTIFICIAL") {
    const look = params.lookName?.trim() || "Gemstone Look";
    return `${qualityPrefix}${titleCase(look)} ${titleCase(style)} ${titleCase(typeTxt)}`
      .replace(/\s+/g, " ").trim();
  }

  // NATURAL
  const stone = params.stoneName?.trim() || "Gemstone";
  return `${qualityPrefix}Natural ${titleCase(stone)} ${titleCase(style)} ${titleCase(typeTxt)}`
    .replace(/\s+/g, " ").trim();
}
```

**Time: 5 minutes | Impact: MEDIUM**

---

## Phase 2: Enhanced Database Operations

### 6. Add Category Indexing

**File: src/lib/firebase/gemstoneJewelleryDb.ts**

Update the DB node constants (around line 30):

```typescript
// Published global
const GLOBAL_NODE = `Global SKU/GemstoneJewellery`;
const GLOBAL_TAG_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByTag`;
const GLOBAL_TYPE_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByType`;
const GLOBAL_NATURE_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByNature`;
// NEW:
const GLOBAL_CATEGORY_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByCategory`;
const GLOBAL_QUALITY_INDEX = `Global SKU/Indexes/GemstoneJewellery/ByQuality`;
```

Then update the `buildIndexRemovals()` function (around line 140):

```typescript
function buildIndexRemovals(listing: GemstoneJewellerySubmission) {
  const tags = uniqTags(listing.tags || []).map(normalizeTag);
  const updates: Record<string, any> = {};

  // Existing indexes
  for (const t of tags) updates[`${GLOBAL_TAG_INDEX}/${t}/${listing.skuId}`] = null;
  if (listing.type) updates[`${GLOBAL_TYPE_INDEX}/${listing.type}/${listing.skuId}`] = null;
  if (listing.nature) updates[`${GLOBAL_NATURE_INDEX}/${listing.nature}/${listing.skuId}`] = null;

  // NEW: Add category and quality indexes
  if (listing.productCategory) updates[`${GLOBAL_CATEGORY_INDEX}/${listing.productCategory}/${listing.skuId}`] = null;
  if (listing.quality) updates[`${GLOBAL_QUALITY_INDEX}/${listing.quality}/${listing.skuId}`] = null;

  return updates;
}
```

**Time: 10 minutes | Impact: HIGH**

---

### 7. Update buildPublishingUpdates (if exists)

Look for function that publishes items to Global SKU, and update it to include new indexes:

```typescript
// When publishing to Global SKU, add:
if (sub.productCategory) {
  updates[`${GLOBAL_CATEGORY_INDEX}/${sub.productCategory}/${sub.skuId}`] = true;
}
if (sub.quality) {
  updates[`${GLOBAL_QUALITY_INDEX}/${sub.quality}/${sub.skuId}`] = true;
}
```

**Time: 5 minutes**

---

## Phase 3: Public API Updates

### 8. Update Public Type Export

**File: src/lib/firebase/gemstoneJewelleryPublicDb.ts**

Update the `PublicGemstoneJewellery` type:

```typescript
export type PublicGemstoneJewellery = {
  skuId: string;
  itemName?: string;
  nature?: string;
  type?: string;
  stoneName?: string;
  lookName?: string;
  material?: string;
  // NEW:
  productCategory?: string;
  quality?: string;
  
  tags?: string[];
  media?: any[];
  mrp?: number;
  offerPrice?: number;

  adminMarginPct?: number;
  computedBasePrice?: number;
  computedPublicPrice?: number;

  updatedAt?: number;
  createdAt?: number;
  status?: string;
};
```

**Time: 5 minutes**

---

## Phase 4: UI Component Updates

### 9. Update Landing Page Filters

**File: src/components/catalog/GemstoneJewelleryLanding.tsx**

Add state for new filters (around line 35):

```typescript
// Existing filters...
const [tag, setTag] = useState<string>("ALL");

// NEW:
const [category, setCategory] = useState<string>("ALL");
const [quality, setQuality] = useState<string>("ALL");
```

Update the `meta` useMemo to compute categories and qualities (around line 60):

```typescript
const meta = useMemo(() => {
  const natures = uniq(all.map((x) => (x.nature || "").toUpperCase()).filter(Boolean));
  const types = uniq(all.map((x) => (x.type || "").toUpperCase()).filter(Boolean));
  const materials = uniq(all.map((x) => (x.material || "").toUpperCase()).filter(Boolean));

  // NEW:
  const categories = uniq(all.map((x) => (x.productCategory || "").toUpperCase()).filter(Boolean));
  const qualities = uniq(all.map((x) => (x.quality || "").toUpperCase()).filter(Boolean));

  const stones = uniq(
    all
      .map((x) =>
        (String((x.nature || "").toUpperCase()) === "ARTIFICIAL"
          ? (x.lookName || "")
          : (x.stoneName || "")
        ).toUpperCase()
      )
      .filter(Boolean)
  );

  const tags = uniq((all.flatMap((x) => x.tags || []) as string[]).map((t) => String(t).toLowerCase()));
  
  return { natures, types, materials, categories, qualities, stones, tags };
}, [all]);
```

Update the filtered items computation to include category/quality filters:

```typescript
let arr = all.filter((it) => {
  const price = pickDisplayPrice(it);

  const text =
    `${it.skuId} ${it.itemName || ""} ${(it.stoneName || "")} ${(it.lookName || "")} ${(it.material || "")} ${(it.type || "")}`.toLowerCase();
  if (s && !text.includes(s)) return false;

  if (nature !== "ALL" && String(it.nature || "").toUpperCase() !== nature) return false;
  if (type !== "ALL" && String(it.type || "").toUpperCase() !== type) return false;
  
  // NEW:
  if (category !== "ALL" && String(it.productCategory || "").toUpperCase() !== category) return false;
  if (quality !== "ALL" && String(it.quality || "").toUpperCase() !== quality) return false;

  if (stoneOrLook !== "ALL") {
    const v = String(
      (String((it.nature || "").toUpperCase()) === "ARTIFICIAL" ? it.lookName : it.stoneName) || ""
    ).toUpperCase();
    if (v !== stoneOrLook) return false;
  }

  // ... rest of filtering
});
```

Add filter UI in the render section (find the filter controls area):

```jsx
{/* Category Filter */}
<div>
  <label className="block text-sm font-semibold mb-2">Category</label>
  <select
    value={category}
    onChange={(e) => setCategory(e.target.value)}
    className="w-full px-3 py-2 border rounded"
  >
    <option value="ALL">All Categories</option>
    {meta.categories.map((c) => (
      <option key={c} value={c}>{c}</option>
    ))}
  </select>
</div>

{/* Quality Filter */}
<div>
  <label className="block text-sm font-semibold mb-2">Quality</label>
  <select
    value={quality}
    onChange={(e) => setQuality(e.target.value)}
    className="w-full px-3 py-2 border rounded"
  >
    <option value="ALL">All Qualities</option>
    {meta.qualities.map((q) => (
      <option key={q} value={q}>{q}</option>
    ))}
  </select>
</div>
```

**Time: 20 minutes | Impact: HIGH (better UX)**

---

### 10. Update Detail View to Show Certificates

**File: src/components/catalog/GemstoneJewelleryDetail.tsx**

Update the media filtering (around line 40):

```typescript
const media = (Array.isArray((data as any)?.media) ? ((data as any).media as any[]) : []) as any[];

// Helper function
function asKind(m: any): "IMG" | "VID" | "CERT" {
  if (m?.kind === "IMG" || m?.kind === "VID" || m?.kind === "CERT") return m.kind;
  if (m?.type === "video") return "VID";
  if (m?.type === "file") return "CERT";
  return "IMG";
}

const images = media
  .filter((m) => asKind(m) === "IMG")
  .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));

const videos = media
  .filter((m) => asKind(m) === "VID")
  .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));

// NEW:
const certificates = media
  .filter((m) => asKind(m) === "CERT")
  .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));
```

Add certificate section in JSX (in the details area):

```jsx
{certificates.length > 0 && (
  <div className="space-y-3">
    <h3 className="text-lg font-semibold">Certifications</h3>
    <div className="flex flex-wrap gap-3">
      {certificates.map((cert, idx) => (
        <a
          key={idx}
          href={cert.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
        >
          📄 {cert.contentType?.includes("pdf") ? "Certificate" : "Document"} {idx + 1}
        </a>
      ))}
    </div>
  </div>
)}
```

**Time: 15 minutes | Impact: MEDIUM**

---

## Implementation Checklist

### Phase 1: Quick Wins (45 minutes total)
- [ ] Add "CERT" to MediaKind type (5 min)
- [ ] Update asKind() functions (5 min)
- [ ] Add GemstoneCategory enum (10 min)
- [ ] Add GemstoneQuality enum (5 min)
- [ ] Add options configuration (5 min)
- [ ] Add deriveAutoTags function (5 min)
- [ ] Update generateItemName (5 min)

### Phase 2: Database Updates (15 minutes)
- [ ] Add category and quality indexes (10 min)
- [ ] Update buildIndexRemovals function (5 min)

### Phase 3: Public API (5 minutes)
- [ ] Update PublicGemstoneJewellery type (5 min)

### Phase 4: UI Updates (35 minutes)
- [ ] Update landing page filters (20 min)
- [ ] Update detail view for certificates (15 min)

**Total Time: ~100 minutes (1.5-2 hours)**

---

## Testing Checklist

- [ ] New items with productCategory save correctly
- [ ] New items with quality save correctly
- [ ] Auto-tags are generated correctly
- [ ] Category filters work on landing page
- [ ] Quality filters work on landing page
- [ ] Certificate media can be uploaded
- [ ] Certificates display in detail view
- [ ] Old items without these fields still work (backward compatible)
- [ ] Item names generate with quality prefix
- [ ] Indexes are built correctly when publishing

---

## Rollback Strategy

All changes are **backward compatible**:
- Old items without `productCategory` will continue to work
- Old items without `quality` will continue to work
- Old media without CERT kind will continue to work
- Filters will just show "ALL" if no data exists
- No data migration needed

---

## Performance Considerations

- New indexes follow same pattern as existing ones (no performance impact)
- Filter state in component is already optimized with useMemo
- Database queries remain the same structure
- Tag generation is instant (runs client-side only on submit)

---

## Next: Zodiac & Astrology Phase (Later Enhancement)

Once above is done, consider adding:

```typescript
export type ZodiacSign = 
  | "ARIES" | "TAURUS" | "GEMINI" | "CANCER"
  | "LEO" | "VIRGO" | "LIBRA" | "SCORPIO"
  | "SAGITTARIUS" | "CAPRICORN" | "AQUARIUS" | "PISCES";

export type AstroBenefit =
  | "PROSPERITY" | "PROTECTION" | "HEALTH"
  | "LOVE" | "PEACE" | "CLARITY" | "COURAGE";
```

This would mirror Rudraksha's spiritual features and provide huge marketing angle.

---

**Questions? Refer to GEMSTONE_RUDRAKSHA_COMPARISON.md for context.**

