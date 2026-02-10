// src/components/supplier/RudrakshaForm.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  RudrakshaSubmission,
  RudrakshaType,
  RudrakshaOrigin,
  Origin,
  MediaItem,
} from "@/lib/rudraksha/types";
import {
  RUDRAKSHA_TYPES,
  ORIGINS,
  ORIGIN_TABS,
  generateItemName,
  normalizeTag,
  uniqTags,
} from "@/lib/rudraksha/options";
import MediaUploader from "@/components/supplier/MediaUploader";
import { uploadRudrakshaMediaBatch, deleteRudrakshaMedia } from "@/lib/firebase/rudrakshaDb";

type Props = {
  value: RudrakshaSubmission;
  onChange: (next: RudrakshaSubmission) => void;

  suggested?: {
    mukhi?: number[];
    purposes?: string[]; // "shivratri", "protection", "meditation"
    styles?: string[]; // "dailywear", "temple", "minimal"
    materials?: string[];
    types?: string[];
  };

  readOnlyStatus?: boolean;
};

const CHIP_SECTIONS: { key: keyof NonNullable<Props["suggested"]>; label: string }[] = [
  { key: "purposes", label: "Purpose / Occasion" },
  { key: "styles", label: "Style Tags" },
  { key: "materials", label: "Material Tags" },
  { key: "types", label: "Type Tags" },
];

const MUKHI_TABS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => ({
  label: `${n} Mukhi`,
  value: String(n),
}));

const MATERIAL_TABS = ["Thread", "Silver", "Gold", "Panchdhatu", "Brass", "Steel", "Elastic", "Other"];
const CLOSURE_TABS = ["Adjustable", "Hook", "Elastic", "Slip-on", "Magnetic", "Toggle", "Other"];

/* UI helpers */
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
        (active ? "bg-black text-white border-black" : "bg-white text-black border-gray-300") +
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
            (value === o.value ? "bg-black text-white border-black" : "bg-white text-black border-gray-300") +
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

function asKind(m: any): MediaItem["kind"] {
  if (m?.kind === "IMG" || m?.kind === "VID" || m?.kind === "CERT") return m.kind;
  if (m?.type === "video") return "VID";
  if (m?.type === "file") return "CERT";
  return "IMG";
}

function safeMedia(value: RudrakshaSubmission): MediaItem[] {
  const arr = Array.isArray((value as any).media) ? (((value as any).media as any[]) ?? []) : [];
  return arr.map((m) => ({
    ...m,
    kind: asKind(m),
    order: Number.isFinite(Number(m?.order)) ? Number(m.order) : 0,
  }));
}

export default function RudrakshaForm({ value, onChange, suggested, readOnlyStatus }: Props) {
  const [customTag, setCustomTag] = useState("");

  const media = useMemo(() => safeMedia(value), [value]);

  const styleTags = useMemo(() => (value.tags || []).map(normalizeTag), [value.tags]);

  // Prefer legacy origin (has UNKNOWN) for item name; fall back to new origin if present.
  const originForName = (value.originLegacy ?? (value.origin as any) ?? null) as string | null;

  const autoName = useMemo(() => {
    return generateItemName({
      type: value.type,
      mukhi: value.mukhi ?? null,
      origin: originForName,
      material: value.material ?? null,
      tags: styleTags,
    });
  }, [value.type, value.mukhi, originForName, value.material, styleTags]);

  useEffect(() => {
    if (!value.itemName?.trim()) onChange({ ...value, itemName: autoName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof RudrakshaSubmission>(k: K, v: RudrakshaSubmission[K]) {
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

  const priceMode = value.priceMode || "MRP";

  const computedByWeight =
    priceMode === "WEIGHT" && typeof value.weightGm === "number" && typeof value.ratePerGm === "number"
      ? Math.round(value.weightGm * value.ratePerGm)
      : null;

  return (
    <div className="space-y-6">
      {/* Basics */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="text-lg font-semibold">Basics</div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Type</div>
            <Tabs
              value={value.type || "MALA"}
              disabled={readOnlyStatus}
              options={RUDRAKSHA_TYPES.map((t) => ({ label: t.label, value: t.value }))}
              onChange={(v) => setField("type", v as RudrakshaType)}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm text-gray-600">Origin</div>
            {/* New schema origin (NEPAL / INDONESIA_JAVA / INDIA / OTHER) */}
            <Tabs
              value={value.origin || "NEPAL"}
              disabled={readOnlyStatus}
              options={ORIGIN_TABS.map((o) => ({ label: o.label, value: o.key }))}
              onChange={(v) => setField("origin", v as Origin)}
            />

            {/* Optional legacy origin tabs (kept for compatibility / older data). */}
            <div className="mt-3 text-xs text-gray-500">Legacy Origin (optional)</div>
            <Tabs
              value={value.originLegacy || "UNKNOWN"}
              disabled={readOnlyStatus}
              options={ORIGINS.map((o) => ({ label: o.label, value: o.value }))}
              onChange={(v) => setField("originLegacy", v as RudrakshaOrigin)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-gray-600">Mukhi (quick select)</div>
          <Tabs
            value={value.mukhi ? String(value.mukhi) : ""}
            disabled={readOnlyStatus}
            options={[{ label: "—", value: "" }, ...MUKHI_TABS]}
            onChange={(v) => setField("mukhi", v ? Number(v) : null)}
          />

          <div className="grid md:grid-cols-3 gap-4 mt-2">
            <label className="space-y-1">
              <div className="text-sm text-gray-600">Mukhi (number)</div>
              <input
                type="number"
                value={value.mukhi ?? ""}
                onChange={(e) => setField("mukhi", numOrUndef(e.target.value) ?? null)}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-gray-600">Bead Size (mm)</div>
              <input
                type="number"
                value={value.sizeMm ?? ""}
                onChange={(e) => setField("sizeMm", numOrUndef(e.target.value) ?? null)}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-gray-600">Weight (gm)</div>
              <input
                type="number"
                value={value.weightGm ?? ""}
                onChange={(e) => setField("weightGm", numOrUndef(e.target.value) ?? null)}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>
          </div>
        </div>

        {/* Quality toggles */}
        <div className="grid md:grid-cols-4 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!value.labCertified}
              onChange={(e) => setField("labCertified", e.target.checked)}
              disabled={readOnlyStatus}
            />
            Lab Certified
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!value.xrayMukhiVerified}
              onChange={(e) => setField("xrayMukhiVerified", e.target.checked)}
              disabled={readOnlyStatus}
            />
            X-Ray Report Available
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!value.energized}
              onChange={(e) => setField("energized", e.target.checked)}
              disabled={readOnlyStatus}
            />
            Energized / Pran Pratishtha
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.natural !== false}
              onChange={(e) => setField("natural", e.target.checked)}
              disabled={readOnlyStatus}
            />
            Natural Bead
          </label>
        </div>


        {/* Jewellery fields (optional) */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Material</div>
            <Tabs
              value={value.material || ""}
              disabled={readOnlyStatus}
              options={[{ label: "—", value: "" }, ...MATERIAL_TABS.map((x) => ({ label: x, value: x }))]}
              onChange={(v) => setField("material", v || null)}
            />
            <input
              value={value.material || ""}
              onChange={(e) => setField("material", e.target.value || null)}
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
              options={[{ label: "—", value: "" }, ...CLOSURE_TABS.map((x) => ({ label: x, value: x }))]}
              onChange={(v) => setField("closure", v || null)}
            />
            <input
              value={value.closure || ""}
              onChange={(e) => setField("closure", e.target.value || null)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Type custom closure (optional)"
              disabled={readOnlyStatus}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <label className="space-y-1">
            <div className="text-sm text-gray-600">Length (inch)</div>
            <input
              type="number"
              value={value.lengthInch ?? ""}
              onChange={(e) => setField("lengthInch", numOrUndef(e.target.value) ?? null)}
              className="w-full border rounded-xl px-3 py-2"
              disabled={readOnlyStatus}
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <div className="text-sm text-gray-600">Certificate Lab / Note</div>
            <input
              value={value.certificateLab || ""}
              onChange={(e) => setField("certificateLab", e.target.value || null)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="e.g., Lab name / report id / any note"
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
              if (v === "MRP") {
                onChange({ ...value, priceMode: "MRP", ratePerGm: null });
              } else {
                onChange({ ...value, priceMode: "WEIGHT" });
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
                onChange={(e) => setField("mrp", numOrUndef(e.target.value) ?? null)}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-gray-600">Offer Price (₹)</div>
              <input
                type="number"
                value={value.offerPrice ?? ""}
                onChange={(e) => setField("offerPrice", numOrUndef(e.target.value) ?? null)}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>

            <div className="rounded-xl border p-3 bg-gray-50">
              <div className="text-xs text-gray-600">Effective Price</div>
              <div className="text-lg font-semibold">₹{formatInr(value.offerPrice ?? value.mrp ?? null) || "—"}</div>
              <div className="text-xs text-gray-500 mt-1">Uses Offer Price if filled, else MRP.</div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            <label className="space-y-1">
              <div className="text-sm text-gray-600">Weight (gm)</div>
              <input
                type="number"
                value={value.weightGm ?? ""}
                onChange={(e) => setField("weightGm", numOrUndef(e.target.value) ?? null)}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-gray-600">Rate per gm (₹)</div>
              <input
                type="number"
                value={value.ratePerGm ?? ""}
                onChange={(e) => setField("ratePerGm", numOrUndef(e.target.value) ?? null)}
                className="w-full border rounded-xl px-3 py-2"
                disabled={readOnlyStatus}
              />
            </label>

            <div className="rounded-xl border p-3 bg-gray-50">
              <div className="text-xs text-gray-600">Computed Offer Price</div>
              <div className="text-lg font-semibold">
                {computedByWeight == null ? "—" : `₹${formatInr(computedByWeight)}`}
              </div>
              <div className="text-xs text-gray-500 mt-1">weightGm × ratePerGm (rounded).</div>
            </div>
          </div>
        )}
      </section>

      {/* Hashtags */}
      <section className="rounded-2xl border p-4 space-y-4">
        <div className="text-lg font-semibold">Hashtags (customer search)</div>

        {!!suggested?.mukhi?.length && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Mukhi tags</div>
            <div className="flex flex-wrap gap-2">
              {suggested.mukhi.map((n) => {
                const tag = normalizeTag(`${n}-mukhi`);
                const active = (value.tags || []).map(normalizeTag).includes(tag);
                return (
                  <Chip key={tag} label={tag} active={active} onClick={() => toggleTag(tag)} disabled={readOnlyStatus} />
                );
              })}
            </div>
          </div>
        )}

        {CHIP_SECTIONS.map((sec) => {
          const list = (suggested as any)?.[sec.key] || [];
          if (!list.length) return null;
          return (
            <div key={sec.key} className="space-y-2">
              <div className="text-sm text-gray-600">{sec.label}</div>
              <div className="flex flex-wrap gap-2">
                {list.map((t: any) => {
                  const nt = normalizeTag(t);
                  const active = (value.tags || []).map(normalizeTag).includes(nt);
                  return (
                    <Chip key={nt} label={nt} active={active} onClick={() => toggleTag(nt)} disabled={readOnlyStatus} />
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
            placeholder="Add custom tag (e.g., shivratri, nepal, premium)"
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
          <span className="text-black">{(value.tags || []).map(normalizeTag).map((t) => `#${t}`).join(" ")}</span>
        </div>
      </section>

      {/* Item name */}
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
          items={media.filter((m) => m.kind === "IMG").sort((a, b) => (a.order ?? 0) - (b.order ?? 0))}
          onChange={(nextImgs) => {
            const vids = media.filter((m) => m.kind === "VID");
            const certs = media.filter((m) => m.kind === "CERT");
            onChange({ ...value, media: [...nextImgs, ...vids, ...certs] });
          }}
          allowReorder
          uploadFn={uploadRudrakshaMediaBatch}
          deleteFn={deleteRudrakshaMedia}
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
          items={media.filter((m) => m.kind === "VID").sort((a, b) => (a.order ?? 0) - (b.order ?? 0))}
          onChange={(nextVids) => {
            const imgs = media.filter((m) => m.kind === "IMG");
            const certs = media.filter((m) => m.kind === "CERT");
            onChange({ ...value, media: [...imgs, ...nextVids, ...certs] });
          }}
          allowReorder
          uploadFn={uploadRudrakshaMediaBatch}
          deleteFn={deleteRudrakshaMedia}
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
