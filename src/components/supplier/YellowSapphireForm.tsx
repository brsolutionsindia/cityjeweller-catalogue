"use client";

import React, { useMemo, useState } from "react";
import ImageChoiceGrid from "./ImageChoiceGrid";
import ChoiceTabs from "./ChoiceTabs";
import MediaUploader from "./MediaUploader";
import { uploadMediaBatch, deleteMediaObject } from "@/lib/firebase/yellowSapphireDb";

import {
  SHAPES,
  CLARITIES,
  COLORS,
  TREATMENTS,
  LUSTERS,
  CERTIFIED,
  ORIGINS,
  NOT_DEFINED,
} from "@/lib/yellowSapphire/options";
import type {
  MediaItem,
  YellowSapphireSubmission,
} from "@/lib/yellowSapphire/types";

type Props = {
  mode: "create" | "edit";
  skuId: string;
  initial?: Partial<YellowSapphireSubmission>;
  onSubmit: (data: Partial<YellowSapphireSubmission>) => Promise<void>;
};


export default function YellowSapphireForm({ mode, skuId, initial, onSubmit }: Props) {
  const [saving, setSaving] = useState(false);

  // Prefill defaults (from supplier last saved)
  const [ratePerCaratInr, setRatePerCaratInr] = useState(String(initial?.ratePerCaratInr ?? ""));
  const [treatmentStatus, setTreatmentStatus] = useState(initial?.treatmentStatus || NOT_DEFINED);
  const [luster, setLuster] = useState(initial?.luster || NOT_DEFINED);
  const [origin, setOrigin] = useState(initial?.origin || NOT_DEFINED);
  const [certified, setCertified] = useState(initial?.certified || NOT_DEFINED);
  const [remarks, setRemarks] = useState(initial?.remarks || "");
  const [measurementMm, setMeasurementMm] = useState(initial?.measurementMm || "");
  const [stoneLocalCode, setStoneLocalCode] = useState(initial?.stoneLocalCode || "");

  // Default Not Defined
  const [shapeCut, setShapeCut] = useState(initial?.shapeCut || NOT_DEFINED);
  const [clarity, setClarity] = useState(initial?.clarity || NOT_DEFINED);
  const [color, setColor] = useState(initial?.color || NOT_DEFINED);

  const [weightCarat, setWeightCarat] = useState(String(initial?.weightCarat ?? ""));

  // media
  const [images, setImages] = useState<MediaItem[]>(initial?.media?.images || []);
  const [videos, setVideos] = useState<MediaItem[]>(initial?.media?.videos || []);

  const normalizeMeasurement = (raw: string) =>
    raw
      .replace(/\s*[xX]\s*/g, " * ")
      .replace(/\s*\*\s*/g, " * ")
      .replace(/\s{2,}/g, " ")
      .trim();

  const onMeasurementKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      setMeasurementMm((prev) => (prev ? `${prev} * ` : "* "));
    }
  };

  const thumbUrl = useMemo(() => {
    const sorted = [...images].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    const primary = sorted.find((m) => m.isPrimary) || sorted[0];
    return (primary?.url || "").trim();
  }, [images]);


  const submit = async () => {
    // Only hard-require Carat + Rate
    if (!weightCarat || !ratePerCaratInr) {
      alert("Carat and Rate/Carat are required.");
      return;
    }

    // Measurement warning (not blocking)
    const meas = normalizeMeasurement(measurementMm);
    if (!meas) {
      const ok = confirm(
        "Measurement is recommended and may be required for approval/public listing.\n\nSubmit without Measurement?"
      );
      if (!ok) return;
    }

    setSaving(true);

  const normalizedImages = [...images]
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
    .map((m, i) => ({ ...m, order: i, isPrimary: i === 0 }));

  const normalizedVideos = [...videos]
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
    .map((m, i) => ({ ...m, order: i }));


    try {
      const payload: Partial<YellowSapphireSubmission> = {
        stoneLocalCode: stoneLocalCode.trim() || undefined,

        shapeCut,
        clarity,
        color,

        treatmentStatus,
        luster,
        origin,
        certified,

        weightCarat: Number(weightCarat),
        ratePerCaratInr: Number(ratePerCaratInr),

        remarks: remarks.trim() || undefined,
        measurementMm: meas || undefined,

        media: {
          images: normalizedImages,
          videos: normalizedVideos,
          thumbUrl,
        },

        status: "PENDING",
      };

      await onSubmit(payload);
      alert(mode === "create" ? "Submitted for approval!" : "Updated and re-submitted!");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to save listing.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">{mode === "create" ? "Create listing" : "Edit listing"}</div>
            <div className="text-xl font-bold">SKU: {skuId}</div>
            <div className="text-xs text-gray-500 mt-1">Approval Status: <b>PENDING</b></div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : mode === "create" ? "Submit Listing" : "Update Listing"}
          </button>
        </div>
      </div>

      {/* Media */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-6">
        <div className="text-lg font-semibold">Media</div>

        <MediaUploader<MediaItem>
  skuId={skuId}
  label="Photos"
  accept="image/*"
  kind="IMG"
  items={images}
  onChange={(next) => setImages(next)}
  allowReorder
  uploadFn={uploadMediaBatch}
  deleteFn={deleteMediaObject}
  getUrl={(m) => m.url}
  getStoragePath={(m) => m.storagePath}
  isVideoItem={(m) => m.kind === "VID"}
  setOrder={(m, order) => ({ ...m, order })}
  setPrimary={(m, isPrimary) => ({ ...m, isPrimary })}
/>

<MediaUploader<MediaItem>
  skuId={skuId}
  label="Videos"
  accept="video/*"
  kind="VID"
  items={videos}
  onChange={(next) => setVideos(next)}
  uploadFn={uploadMediaBatch}
  deleteFn={deleteMediaObject}
  getUrl={(m) => m.url}
  getStoragePath={(m) => m.storagePath}
  isVideoItem={(m) => m.kind === "VID"}
  setOrder={(m, order) => ({ ...m, order })}
/>


      </div>

      {/* Core */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-6">
        <div className="text-lg font-semibold">Core Details</div>

        <ImageChoiceGrid title="Shape / Cut" options={SHAPES} value={shapeCut} onChange={setShapeCut} />
        <ImageChoiceGrid title="Clarity" options={CLARITIES} value={clarity} onChange={setClarity} />
        <ImageChoiceGrid title="Color" options={COLORS} value={color} onChange={setColor} />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Carat (required)</label>
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2"
              value={weightCarat}
              onChange={(e) => setWeightCarat(e.target.value)}
              placeholder="e.g., 8.25"
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Rate / Carat (₹) (required)</label>
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2"
              value={ratePerCaratInr}
              onChange={(e) => setRatePerCaratInr(e.target.value)}
              placeholder="e.g., 12000"
              inputMode="numeric"
            />
          </div>
        </div>
      </div>

      {/* Other */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-6">
        <div className="text-lg font-semibold">Other Details</div>

        <ChoiceTabs title="Treatment Status" options={TREATMENTS} value={treatmentStatus} onChange={setTreatmentStatus} />
        <ChoiceTabs title="Luster" options={LUSTERS} value={luster} onChange={setLuster} />
        <ChoiceTabs title="Origin" options={ORIGINS} value={origin} onChange={setOrigin} />
        <ChoiceTabs title="Certified" options={CERTIFIED} value={certified} onChange={setCertified} />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Remarks (optional)</label>
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="optional"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Measurement (L * B * H in mm)</label>
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2"
              value={measurementMm}
              onKeyDown={onMeasurementKeyDown}
              onBlur={() => setMeasurementMm((v) => normalizeMeasurement(v))}
              onChange={(e) => setMeasurementMm(e.target.value)}
              placeholder="e.g., 10.2 * 8.1 * 5.4"
            />
            <div className="text-xs text-gray-500 mt-1">
              Recommended for approval/public listing.
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Stone ID/Code (optional)</label>
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2"
              value={stoneLocalCode}
              onChange={(e) => setStoneLocalCode(e.target.value)}
              placeholder="optional"
            />
          </div>
        </div>
      </div>

      {/* Quick Review */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
        <div className="text-lg font-semibold">Quick Review</div>
        <div className="text-sm text-gray-700">Cover Photo: <b>{thumbUrl ? "Selected" : "Not set"}</b></div>
        <div className="text-sm text-gray-700">Photos: <b>{images.length}</b> • Videos: <b>{videos.length}</b></div>
      </div>

      {/* Bottom Submit */}
      <div className="flex justify-end pb-10">
        <button
          type="button"
          disabled={saving}
          onClick={submit}
          className="rounded-xl bg-blue-600 text-white px-5 py-3 hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : mode === "create" ? "Submit Listing" : "Update Listing"}
        </button>
      </div>
    </div>
  );
}
