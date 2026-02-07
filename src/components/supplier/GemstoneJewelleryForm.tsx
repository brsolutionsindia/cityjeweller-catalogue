"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  GemstoneJewellerySubmission,
  Nature,
  GJType,
} from "@/lib/gemstoneJewellery/types";
import {
  GJ_TYPES,
  generateItemName,
  normalizeTag,
  uniqTags,
} from "@/lib/gemstoneJewellery/options";
import MediaUploader from "@/components/supplier/MediaUploader";
import {
  uploadGemstoneJewelleryMediaBatch,
  deleteGemstoneJewelleryMedia,
} from "@/lib/firebase/gemstoneJewelleryDb";

/**
 * ✅ IMPORTANT:
 * This form assumes your `GemstoneJewellerySubmission` includes:
 * - priceMode?: "MRP" | "WEIGHT"
 * - ratePerGm?: number
 * - weightGm?: number
 *
 * Add these in `src/lib/gemstoneJewellery/types.ts` if not already.
 */

type Props = {
  value: GemstoneJewellerySubmission;
  onChange: (next: GemstoneJewellerySubmission) => void;

  suggested?: {
    colors?: string[];
    stones?: string[];
    styles?: string[];
    types?: string[];
  };

  readOnlyStatus?: boolean;
};

const CHIP_SECTIONS: { key: keyof NonNullable<Props["suggested"]>; label: string }[] =
  [
    { key: "colors", label: "Colors" },
    { key: "stones", label: "Stones / Looks" },
    { key: "styles", label: "Style / Occasion" },
    { key: "types", label: "Type Tags" },
  ];

/* ---------- Presets for Tabs ---------- */
const NATURAL_STONE_TABS = [
  "Pearl",
  "Amethyst",
  "Citrine",
  "Ruby",
  "Emerald",
  "Opal",
  "Garnet",
  "Blue Sapphire",
  "Yellow Sapphire",
];

const LOOK_TABS = [
  "Ruby Look",
  "Emerald Look",
  "Pearl Look",
  "Amethyst Look",
  "Citrine Look",
  "Opal Look",
];

const MATERIAL_TABS = ["Thread", "Silver", "Alloy", "Elastic", "Brass", "Steel"];

const CLOSURE_TABS = [
  "Adjustable",
  "Hook",
  "Elastic",
  "Slip-on",
  "Magnetic",
  "Toggle",
];

/* ---------- Small UI helpers ---------- */
function Chip({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "px-3 py-1 rounded-full text-sm border " +
        (active
          ? "bg-black text-white border-black"
          : "bg-white text-black border-gray-300") +
        (disabled ? " opacity-60" : "")
      }
    >
      #{label}
    </button>
  );
}

function Tabs({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={
            "px-3 py-2 rounded-xl border text-sm " +
            (value === o.value
              ? "bg-black text-white border-black"
              : "bg-white text-black border-gray-300") +
            (disabled ? " opacity-60" : "")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function numOrUndef(v: string) {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function formatInr(n?: number | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return n.toLocaleString("en-IN");
}

export default function GemstoneJewelleryForm({
  value,
  onChange,
  suggested,
  readOnlyStatus,
}: Props) {
  const [customTag, setCustomTag] = useState("");

  const styleTags = useMemo(() => {
    return (value.tags || []).map(normalizeTag);
  }, [value.tags]);

  const autoName = useMemo(() => {
    return generateItemName({
      nature: value.nature,
      type: value.type,
      stoneName: value.stoneName,
      lookName: value.lookName,
      styleTags,
    });
  }, [value.nature, value.type, value.stoneName, value.lookName, styleTags]);

  useEffect(() => {
    if (!value.itemName?.trim()) {
      onChange({ ...value, itemName: autoName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof GemstoneJewellerySubmission>(
    k: K,
    v: GemstoneJewellerySubmission[K]
  ) {
    onChange({ ...value, [k]: v });
  }

  function toggleTag(t: string) {
    const tag = normalizeTag(t);
    const tags = new Set((value.tags || []).map(normalizeTag));
    if (tags.has(tag)) tags.delete(tag);
    else tags.add(tag);
    setField("tags", uniqTags(Array.from(tags)));
  }

  function addCustomTag() {
    const tag = normalizeTag(customTag);
    if (!tag) return;
    setField("tags", uniqTags([...(value.tags || []), tag]));
    setCustomTag("");
  }

  function regenName() {
    setField("itemName", autoName);
  }

  const isArtificial = value.nature === "ARTIFICIAL";

  const activeStoneOrLook = isArtificial
    ? value.lookName || ""
    : value.stoneName || "";

  const priceMode = (value as any).priceMode || "MRP";
  const computedByWeight =
    priceMode === "WEIGHT" &&
    typeof value.weightGm === "number" &&
    typeof (value as any).ratePerGm === "number"
      ? Math.round(value.weightGm * (value as any).ratePerGm)
      : null;

  return (
    <div className="space-y-6">
      {/* Basics */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="text-lg font-semibold">Basics</div>

        <div className="space-y-3">
          <div className="text-sm text-gray-600">Nature</div>
          <Tabs
            value={value.nature}
            disabled={readOnlyStatus}
            options={[
              { label: "Natural", value: "NATURAL" },
              { label: "Artificial / Fashion", value: "ARTIFICIAL" },
            ]}
            onChange={(v) => {
              const nextNature = v as Nature;
              // when switching nature, keep fields sane
              if (nextNature === "NATURAL") {
                onChange({
                  ...value,
                  nature: nextNature,
                  lookName: undefined,
                  stoneName: value.stoneName || "",
                });
              } else {
                onChange({
                  ...value,
                  nature: nextNature,
                  stoneName: undefined,
                  lookName: value.lookName || "",
                });
              }
            }}
          />
        </div>

        <div className="space-y-3">
          <div className="text-sm text-gray-600">Type</div>
          <Tabs
            value={value.type}
            disabled={readOnlyStatus}
            options={GJ_TYPES.map((t) => ({ label: t.label, value: t.value }))}
            onChange={(v) => setField("type", v as GJType)}
          />
        </div>

        {/* Stone / Look tabs + custom input */}
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            {isArtificial ? "Look Name" : "Stone Name"}
          </div>

          <Tabs
            value={activeStoneOrLook}
            disabled={readOnlyStatus}
            options={(isArtificial ? LOOK_TABS : NATURAL_STONE_TABS).map((x) => ({
              label: x,
              value: x,
            }))}
            onChange={(v) =>
              isArtificial ? setField("lookName", v) : setField("stoneName", v)
            }
          />

          <input
            value={activeStoneOrLook}
            onChange={(e) =>
              isArtificial
                ? setField("lookName", e.target.value)
                : setField("stoneName", e.target.value)
            }
            className="w-full border rounded-xl px-3 py-2"
            placeholder={
              isArtificial ? "Type custom look (optional)" : "Type custom stone (optional)"
            }
            disabled={readOnlyStatus}
          />
        </div>

        {/* Material + Closure: tabs + custom input */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Material</div>
            <Tabs
              value={value.material || ""}
              disabled={readOnlyStatus}
              options={MATERIAL_TABS.map((x) => ({ label: x, value: x }))}
              onChange={(v) => setField("material", v)}
            />
            <input
              value={value.material || ""}
              onChange={(e) => setField("material", e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Type custom material (optional)"
              disabled={readOnlyStatus}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600">Closure</div>
            <Tabs
              value={value.closure || ""}
              disabled={readOnlyStatus}
              options={CLOSURE_TABS.map((x) => ({ label: x, value: x }))}
              onChange={(v) => setField("closure", v)}
            />
            <input
              value={value.closure || ""}
              onChange={(e) => setField("closure", e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Type custom closure (optional)"
              disabled={readOnlyStatus}
            />
          </div>
        </div>

        {/* Measurements */}
        <div className="grid md:grid-cols-3 gap-4">
          <label className="space-y-1">
            <div className="text-sm text-gray-600">Bead Size (mm)</div>
            <input
              type="number"
              value={value.beadSizeMm ?? ""}
              onChange={(e) => setField("beadSizeMm", numOrUndef(e.target.value))}
              className="w-full border rounded-xl px-3 py-2"
              disabled={readOnlyStatus}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-600">Length (inch)</div>
            <input
              type="number"
              value={value.lengthInch ?? ""}
              onChange={(e) => setField("lengthInch", numOrUndef(e.target.value))}
              className="w-full border rounded-xl px-3 py-2"
              disabled={readOnlyStatus}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-600">Weight (gm)</div>
            <input
              type="number"
              value={value.weightGm ?? ""}
              onChange={(e) => setField("weightGm", numOrUndef(e.target.value))}
              className="w-full border rounded-xl px-3 py-2"
              disabled={readOnlyStatus}
            />
          </label>
        </div>
      </section>

      {/* Pricing */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="text-lg font-semibold">Pricing</div>

        <div className="space-y-2">
          <div className="text-sm text-gray-600">Price Mode</div>
          <Tabs
            value={priceMode}
            disabled={readOnlyStatus}
            options={[
              { label: "MRP / Offer", value: "MRP" },
              { label: "Price per Weight", value: "WEIGHT" },
            ]}
            onChange={(v) => {
              // keep fields sane when switching mode
              if (v === "MRP") {
                onChange({
                  ...value,
                  priceMode: "MRP" as any,
                  ratePerGm: undefined as any,
                });
              } else {
                onChange({
                  ...value,
                  priceMode: "WEIGHT" as any,
                  // keep existing offerPrice/mrp; they can still fill if they want
                });
              }
            }}
          />
        </div>

        {priceMode === "MRP" ? (
          <div className="grid md:grid-cols-3 gap-4">
            <label className="space-y-1">
              <div className="text-sm text-gray-600">MRP (₹)</div>
              <input
                type="number"
                value={value.mrp ?? ""}
                onChange={(e) => setField("mrp", numOrUndef(e.target.value))}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-gray-600">Offer Price (₹)</div>
              <input
                type="number"
                value={value.offerPrice ?? ""}
                onChange={(e) => setField("offerPrice", numOrUndef(e.target.value))}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>

            <div className="rounded-xl border p-3 bg-gray-50">
              <div className="text-xs text-gray-600">Effective Price</div>
              <div className="text-lg font-semibold">
                ₹{formatInr(value.offerPrice ?? value.mrp ?? null) || "—"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Uses Offer Price if filled, else MRP.
              </div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            <label className="space-y-1">
              <div className="text-sm text-gray-600">Weight (gm)</div>
              <input
                type="number"
                value={value.weightGm ?? ""}
                onChange={(e) => setField("weightGm", numOrUndef(e.target.value))}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-gray-600">Rate per gm (₹)</div>
              <input
                type="number"
                value={(value as any).ratePerGm ?? ""}
                onChange={(e) => setField("ratePerGm" as any, numOrUndef(e.target.value) as any)}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>

            <div className="rounded-xl border p-3 bg-gray-50">
              <div className="text-xs text-gray-600">Computed Offer Price</div>
              <div className="text-lg font-semibold">
                {computedByWeight == null ? "—" : `₹${formatInr(computedByWeight)}`}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                weightGm × ratePerGm (rounded).
              </div>
            </div>

            <div className="md:col-span-3 text-xs text-gray-500">
              Tip: You can still optionally fill MRP/Offer above later, but the computed price will be used for weight mode.
            </div>
          </div>
        )}
      </section>

      {/* Tags */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="text-lg font-semibold">Hashtags (customer search)</div>

        {CHIP_SECTIONS.map((sec) => {
          const list = suggested?.[sec.key] || [];
          if (!list.length) return null;
          return (
            <div key={sec.key} className="space-y-2">
              <div className="text-sm text-gray-600">{sec.label}</div>
              <div className="flex flex-wrap gap-2">
                {list.map((t) => {
                  const nt = normalizeTag(t);
                  const active = (value.tags || []).map(normalizeTag).includes(nt);
                  return (
                    <Chip
                      key={nt}
                      label={nt}
                      active={active}
                      onClick={() => toggleTag(nt)}
                      disabled={readOnlyStatus}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex gap-2 items-center">
          <input
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            className="flex-1 border rounded-xl px-3 py-2"
            placeholder="Add custom tag (e.g., pearl, red, minimal)"
            disabled={readOnlyStatus}
          />
          <button
            type="button"
            onClick={addCustomTag}
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
            disabled={readOnlyStatus}
          >
            Add
          </button>
        </div>

        <div className="text-sm text-gray-600">
          Selected:{" "}
          <span className="text-black">
            {(value.tags || [])
              .map(normalizeTag)
              .map((t) => `#${t}`)
              .join(" ")}
          </span>
        </div>
      </section>

      {/* Item Name */}
      <section className="rounded-2xl border p-4 space-y-3">
        <div className="text-lg font-semibold">Item Name (auto-generated, editable)</div>
        <div className="grid md:grid-cols-[1fr_auto] gap-2 items-start">
          <input
            value={value.itemName || ""}
            onChange={(e) => setField("itemName", e.target.value)}
            className="w-full border rounded-xl px-3 py-2"
            placeholder="Item Name"
            disabled={readOnlyStatus}
          />
          <button
            type="button"
            onClick={regenName}
            className="px-4 py-2 rounded-xl border disabled:opacity-60"
            disabled={readOnlyStatus}
          >
            Regenerate
          </button>
        </div>
        <div className="text-sm text-gray-600">
          Suggested: <span className="text-black">{autoName}</span>
        </div>
      </section>

      {/* Media */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="text-lg font-semibold">Media (crop / trim / reorder)</div>

        <MediaUploader
          skuId={value.skuId}
          label="Photos"
          accept="image/*"
          kind="IMG"
          items={value.media.filter((m) => m.kind === "IMG").sort((a, b) => a.order - b.order)}
          onChange={(nextImgs) => {
            const vids = value.media.filter((m) => m.kind === "VID");
            onChange({ ...value, media: [...nextImgs, ...vids] });
          }}
          allowReorder
          uploadFn={uploadGemstoneJewelleryMediaBatch}
          deleteFn={deleteGemstoneJewelleryMedia}
          getUrl={(m) => m.url}
          getStoragePath={(m) => m.storagePath}
          isVideoItem={(m) => m.kind === "VID"}
          setOrder={(m, order) => ({ ...m, order })}
        />

        <MediaUploader
          skuId={value.skuId}
          label="Videos"
          accept="video/*"
          kind="VID"
          items={value.media.filter((m) => m.kind === "VID").sort((a, b) => a.order - b.order)}
          onChange={(nextVids) => {
            const imgs = value.media.filter((m) => m.kind === "IMG");
            onChange({ ...value, media: [...imgs, ...nextVids] });
          }}
          allowReorder
          uploadFn={uploadGemstoneJewelleryMediaBatch}
          deleteFn={deleteGemstoneJewelleryMedia}
          getUrl={(m) => m.url}
          getStoragePath={(m) => m.storagePath}
          isVideoItem={(m) => m.kind === "VID"}
          setOrder={(m, order) => ({ ...m, order })}
        />

        <div className="text-sm text-gray-600">
          Recommended: 1 white background photo (mandatory), 1 close-up, 1 lifestyle, 1 short video.
        </div>
      </section>
    </div>
  );
}
