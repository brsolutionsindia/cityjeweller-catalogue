"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { GemstoneJewellerySubmission, Nature, GJType } from "@/lib/gemstoneJewellery/types";
import { GJ_TYPES, generateItemName, normalizeTag, uniqTags } from "@/lib/gemstoneJewellery/options";
import MediaUploader from "@/components/supplier/MediaUploader";

type Props = {
  value: GemstoneJewellerySubmission;
  onChange: (next: GemstoneJewellerySubmission) => void;

  // Suggested tags (loaded from Config/Tags/... later)
  suggested?: {
    colors?: string[];
    stones?: string[];
    styles?: string[];
    types?: string[];
  };

  readOnlyStatus?: boolean;
};

const CHIP_SECTIONS: { key: keyof NonNullable<Props["suggested"]>; label: string }[] = [
  { key: "colors", label: "Colors" },
  { key: "stones", label: "Stones / Looks" },
  { key: "styles", label: "Style / Occasion" },
  { key: "types", label: "Type Tags" },
];

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1 rounded-full text-sm border " +
        (active ? "bg-black text-white border-black" : "bg-white text-black border-gray-300")
      }
    >
      #{label}
    </button>
  );
}

export default function GemstoneJewelleryForm({ value, onChange, suggested, readOnlyStatus }: Props) {
  const [customTag, setCustomTag] = useState("");

  const styleTags = useMemo(() => {
    // derive from flat tags; your admin can later refine tag categories
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

  // if empty name, seed it
  useEffect(() => {
    if (!value.itemName?.trim()) {
      onChange({ ...value, itemName: autoName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof GemstoneJewellerySubmission>(k: K, v: GemstoneJewellerySubmission[K]) {
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

  return (
    <div className="space-y-6">
      {/* Basics */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="text-lg font-semibold">Basics</div>

        <div className="grid md:grid-cols-3 gap-4">
          <label className="space-y-1">
            <div className="text-sm text-gray-600">Nature</div>
            <select
              value={value.nature}
              onChange={(e) => setField("nature", e.target.value as Nature)}
              className="w-full border rounded-xl px-3 py-2"
              disabled={readOnlyStatus}
            >
              <option value="NATURAL">Natural</option>
              <option value="ARTIFICIAL">Artificial / Fashion</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-600">Type</div>
            <select
              value={value.type}
              onChange={(e) => setField("type", e.target.value as GJType)}
              className="w-full border rounded-xl px-3 py-2"
              disabled={readOnlyStatus}
            >
              {GJ_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-600">{value.nature === "ARTIFICIAL" ? "Look Name" : "Stone Name"}</div>
            <input
              value={value.nature === "ARTIFICIAL" ? (value.lookName || "") : (value.stoneName || "")}
              onChange={(e) =>
                value.nature === "ARTIFICIAL"
                  ? setField("lookName", e.target.value)
                  : setField("stoneName", e.target.value)
              }
              className="w-full border rounded-xl px-3 py-2"
              placeholder={value.nature === "ARTIFICIAL" ? "Ruby Look / Emerald Look" : "Amethyst / Pearl / Aventurine"}
              disabled={readOnlyStatus}
            />
          </label>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <label className="space-y-1">
            <div className="text-sm text-gray-600">Material</div>
            <input
              value={value.material || ""}
              onChange={(e) => setField("material", e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Thread / Silver / Alloy / Elastic"
              disabled={readOnlyStatus}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-600">Closure</div>
            <input
              value={value.closure || ""}
              onChange={(e) => setField("closure", e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Adjustable / Hook / Elastic"
              disabled={readOnlyStatus}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-600">Bead Size (mm)</div>
            <input
              type="number"
              value={value.beadSizeMm ?? ""}
              onChange={(e) => setField("beadSizeMm", e.target.value ? Number(e.target.value) : undefined)}
              className="w-full border rounded-xl px-3 py-2"
              disabled={readOnlyStatus}
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm text-gray-600">Length (inch)</div>
            <input
              type="number"
              value={value.lengthInch ?? ""}
              onChange={(e) => setField("lengthInch", e.target.value ? Number(e.target.value) : undefined)}
              className="w-full border rounded-xl px-3 py-2"
              disabled={readOnlyStatus}
            />
          </label>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <label className="space-y-1">
            <div className="text-sm text-gray-600">MRP (₹)</div>
            <input
              type="number"
              value={value.mrp ?? ""}
              onChange={(e) => setField("mrp", e.target.value ? Number(e.target.value) : undefined)}
              className="w-full border rounded-xl px-3 py-2"
              disabled={readOnlyStatus}
            />
          </label>
          <label className="space-y-1">
            <div className="text-sm text-gray-600">Offer Price (₹)</div>
            <input
              type="number"
              value={value.offerPrice ?? ""}
              onChange={(e) => setField("offerPrice", e.target.value ? Number(e.target.value) : undefined)}
              className="w-full border rounded-xl px-3 py-2"
              disabled={readOnlyStatus}
            />
          </label>
        </div>
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
                  return <Chip key={nt} label={nt} active={active} onClick={() => toggleTag(nt)} />;
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
            className="px-4 py-2 rounded-xl bg-black text-white"
            disabled={readOnlyStatus}
          >
            Add
          </button>
        </div>

        <div className="text-sm text-gray-600">
          Selected:{" "}
          <span className="text-black">
            {(value.tags || []).map(normalizeTag).map((t) => `#${t}`).join(" ")}
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
            className="px-4 py-2 rounded-xl border"
            disabled={readOnlyStatus}
          >
            Regenerate
          </button>
        </div>
        <div className="text-sm text-gray-600">Suggested: <span className="text-black">{autoName}</span></div>
      </section>

      {/* Media (same component as Yellow Sapphire) */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="text-lg font-semibold">Media (crop / trim / reorder)</div>

        <MediaUploader
          skuId={value.skuId}
          label="Photos"
          accept="image/*"
          kind="IMG"
          items={value.media.filter(m => m.kind === "IMG").sort((a,b)=>a.order-b.order)}
          onChange={(nextImgs) => {
            const vids = value.media.filter(m => m.kind === "VID");
            // re-assign order
            const normalized = nextImgs.map((m, i) => ({ ...m, order: i }));
            setField("media", [...normalized, ...vids]);
          }}
          allowReorder
        />

        <MediaUploader
          skuId={value.skuId}
          label="Videos"
          accept="video/*"
          kind="VID"
          items={value.media.filter(m => m.kind === "VID").sort((a,b)=>a.order-b.order)}
          onChange={(nextVids) => {
            const imgs = value.media.filter(m => m.kind === "IMG");
            const normalized = nextVids.map((m, i) => ({ ...m, order: i }));
            setField("media", [...imgs, ...normalized]);
          }}
        />

        <div className="text-sm text-gray-600">
          Recommended: 1 white background photo (mandatory), 1 close-up, 1 lifestyle, 1 short video.
        </div>
      </section>
    </div>
  );
}
