"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";
import { generateItemName } from "@/lib/gemstoneJewellery/options";
import {
  allocateGemstoneJewellerySku,
  createGemstoneJewellerySubmissionStub,
  upsertGemstoneJewellerySubmission,
  getSupplierDefaultsGemstoneJewellery,
  uploadGemstoneJewelleryMediaBatch,
  deleteGemstoneJewelleryMedia,
} from "@/lib/firebase/gemstoneJewelleryDb";

type BulkDraft = {
  skuId: string;
  submission: GemstoneJewellerySubmission;
};

type CropResult = {
  file: File;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    return img;
  } finally {
    // do not revoke here; image might still be decoding in some browsers
    // caller should revoke after draw if needed
  }
}

/**
 * Minimal crop UI (square cover crop) without external libs:
 * - drag to reposition
 * - zoom slider
 * - outputs square JPEG
 */
function CropModal(props: {
  open: boolean;
  file: File | null;
  title?: string;
  onCancel: () => void;
  onDone: (res: CropResult) => void;
}) {
  const { open, file, title, onCancel, onDone } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(1.2);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);

  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // load image when file changes
  useEffect(() => {
    let mounted = true;
    setImgEl(null);
    setZoom(1.2);
    setDx(0);
    setDy(0);

    if (!open || !file) return;

    (async () => {
      try {
        const img = await fileToImage(file);
        if (!mounted) return;
        setImgEl(img);
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, file]);

  // draw preview
  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    if (!c || !imgEl) return;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    const W = c.width;
    const H = c.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    const iw = imgEl.naturalWidth;
    const ih = imgEl.naturalHeight;

    // fit so that image covers square (like "cover"), then apply zoom
    const coverScale = Math.max(W / iw, H / ih);
    const scale = coverScale * zoom;

    const drawW = iw * scale;
    const drawH = ih * scale;

    // center + user offsets
    const x = (W - drawW) / 2 + dx;
    const y = (H - drawH) / 2 + dy;

    ctx.drawImage(imgEl, x, y, drawW, drawH);

    // subtle border
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }, [open, imgEl, zoom, dx, dy]);

  if (!open || !file) return null;

  async function onCrop() {
    const currentFile = file; // ✅ capture for TS narrowing
    if (!currentFile) return;

    const c = canvasRef.current;
    if (!c) return;

    const blob: Blob | null = await new Promise((resolve) =>
      c.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );
    if (!blob) return;

    const baseName = currentFile.name.replace(/\.[^/.]+$/, "");
    const out = new File([blob], `${baseName}_crop.jpg`, { type: "image/jpeg" });

    onDone({ file: out });
  }


  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const nx = e.clientX;
    const ny = e.clientY;
    const ox = last.current.x;
    const oy = last.current.y;
    last.current = { x: nx, y: ny };
    setDx((v) => v + (nx - ox));
    setDy((v) => v + (ny - oy));
  }
  function onPointerUp() {
    dragging.current = false;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white border shadow-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold">{title || "Crop photo"}</div>
          <button className="text-sm underline" type="button" onClick={onCancel}>
            Close
          </button>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          Drag to position • Zoom to fit • Output is square cover image.
        </div>

        <div className="mt-3 flex justify-center">
          <div
            className="rounded-xl overflow-hidden border bg-white touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ width: 360, height: 360 }}
          >
            <canvas ref={canvasRef} width={360} height={360} />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1">Zoom</div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded-xl border"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-black text-white"
            onClick={onCrop}
          >
            Crop & Use
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tries multiple common signatures for your uploadGemstoneJewelleryMediaBatch.
 * Adjust only this if your db util expects a different shape.
 */
async function safeUploadBatch(args: {
  gstNumber: string;
  supplierUid: string;
  skuId: string;
  files: File[];
  kind: "IMG" | "VID";
}) {
  const fn: any = uploadGemstoneJewelleryMediaBatch as any;

  // try: object param
  try {
    return await fn({
      gstNumber: args.gstNumber,
      supplierUid: args.supplierUid,
      skuId: args.skuId,
      kind: args.kind,
      files: args.files,
    });
  } catch {}

  // try: (gst, uid, skuId, kind, files)
  try {
    return await fn(args.gstNumber, args.supplierUid, args.skuId, args.kind, args.files);
  } catch {}

  // try: (gst, skuId, kind, files)
  try {
    return await fn(args.gstNumber, args.skuId, args.kind, args.files);
  } catch {}

  // try: (skuId, kind, files)
  return await fn(args.skuId, args.kind, args.files);
}

export default function BulkNewGemstoneJewelleryPage() {
  const session = useSupplierSession();
  const router = useRouter();

  const gst = useMemo(() => (session?.gst ?? "").trim(), [session?.gst]);
  const uid = useMemo(() => (session?.uid ?? "").trim(), [session?.uid]);

  const [count, setCount] = useState<number>(5);
  const [creating, setCreating] = useState(false);
  const [drafts, setDrafts] = useState<BulkDraft[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [err, setErr] = useState<string>("");

  // bulk file picking
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [bulkMode, setBulkMode] = useState<"CROP_SEQ" | "SKIP_CROP">("CROP_SEQ");

  // sequential crop queue
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFileIdx, setCropFileIdx] = useState(0);

  // prevent double init
  const initKey = useMemo(() => (gst && uid ? `${gst}__${uid}` : ""), [gst, uid]);
  const didInitRef = useRef<string>("");

  async function createOneDraft(): Promise<BulkDraft> {
    const { skuId } = await allocateGemstoneJewellerySku(gst, uid);

    await createGemstoneJewellerySubmissionStub({
      skuId,
      gstNumber: gst,
      supplierUid: uid,
    });

    const defaults = await getSupplierDefaultsGemstoneJewellery(gst, uid);
    const nature = (defaults?.nature as any) || "NATURAL";
    const type = (defaults?.type as any) || "BRACELET";

    const now = Date.now();
    const stoneName = (defaults as any)?.stoneName || "Gemstone";
    const lookName = (defaults as any)?.lookName || null;

    const base: GemstoneJewellerySubmission = {
      skuId,
      gstNumber: gst,
      supplierUid: uid,
      status: "DRAFT",
      nature,
      type,
      stoneName: nature === "NATURAL" ? stoneName : (undefined as any),
      lookName: nature === "ARTIFICIAL" ? (lookName || "Look") : (undefined as any),

      material: (defaults as any)?.material || null,
      closure: (defaults as any)?.closure || null,

      beadSizeMm: (defaults as any)?.beadSizeMm ?? null,
      lengthInch: (defaults as any)?.lengthInch ?? null,

      priceMode: (defaults as any)?.priceMode ?? "MRP",
      ratePerGm: (defaults as any)?.ratePerGm ?? null,
      weightGm: (defaults as any)?.weightGm ?? null,

      mrp: (defaults as any)?.mrp ?? null,
      offerPrice: (defaults as any)?.offerPrice ?? null,

      tags: [],
      itemName: generateItemName({
        nature,
        type,
        stoneName,
        lookName: lookName || undefined,
        styleTags: [],
      }),
      media: [],
      currency: "INR",
      createdAt: now,
      updatedAt: now,
    } as any;

    await upsertGemstoneJewellerySubmission(base);
    return { skuId, submission: base };
  }

  async function createDrafts() {
    if (!gst || !uid) return;
    const n = Math.max(1, Math.min(50, Number(count) || 1));
    setCreating(true);
    setErr("");
    try {
      const list: BulkDraft[] = [];
      for (let i = 0; i < n; i++) {
        const d = await createOneDraft();
        list.push(d);
      }
      setDrafts(list);
      setActiveIdx(0);
      setPickedFiles([]);
      setCropFileIdx(0);
      setCropOpen(false);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Failed to create drafts");
    } finally {
      setCreating(false);
    }
  }

  function setDraftAt(idx: number, next: GemstoneJewellerySubmission) {
    setDrafts((prev) => {
      const out = [...prev];
      out[idx] = { ...out[idx], submission: next };
      return out;
    });
  }

  async function attachCoverToSku(params: {
    skuId: string;
    submission: GemstoneJewellerySubmission;
    file: File;
  }) {
    const { skuId, submission, file } = params;

    // upload (as IMG)
    const uploaded = await safeUploadBatch({
      gstNumber: gst,
      supplierUid: uid,
      skuId,
      kind: "IMG",
      files: [file],
    });

    // we expect upload returns an array of media items
    const uploadedArr: any[] = Array.isArray(uploaded) ? uploaded : uploaded?.items || uploaded?.media || [];
    const first = uploadedArr?.[0];

    if (!first) {
      throw new Error("Upload returned no media item (check uploadGemstoneJewelleryMediaBatch return)");
    }

    // keep only first image as cover for bulk stage
    const nextMedia = [
      {
        ...first,
        kind: "IMG",
        order: 1,
      },
    ];

    const nextSubmission = {
      ...submission,
      media: nextMedia as any,
      updatedAt: Date.now(),
    } as any;

    setDraftAt(activeIdx, nextSubmission);
    await upsertGemstoneJewellerySubmission(nextSubmission);
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function onPickedFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).filter(Boolean);

    // we only need up to drafts.length (1 per SKU)
    const capped = arr.slice(0, drafts.length);

    setPickedFiles(capped);
    setCropFileIdx(0);

    if (bulkMode === "CROP_SEQ") {
      // sequential crop modal will drive the flow
      setActiveIdx(0);
      setCropOpen(capped.length > 0);
    } else {
      // skip crop => upload all in one go
      void uploadAllNoCrop(capped);
    }
  }

  async function uploadAllNoCrop(files: File[]) {
    if (!files.length) return;
    setCreating(true);
    try {
      const max = Math.min(files.length, drafts.length);
      for (let i = 0; i < max; i++) {
        const d = drafts[i];
        await attachCoverToSku({
          skuId: d.skuId,
          submission: d.submission,
          file: files[i],
        });
        setActiveIdx(i);
      }
      // jump to last processed
      setActiveIdx(Math.max(0, max - 1));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Bulk upload failed");
    } finally {
      setCreating(false);
    }
  }

  async function onCropDone(res: CropResult) {
    const files = pickedFiles;
    const idx = cropFileIdx;
    const file = files[idx];
    const d = drafts[idx]; // 1 file -> 1 SKU, in order

    if (!file || !d) {
      setCropOpen(false);
      return;
    }

    setCreating(true);
    try {
      setActiveIdx(idx);

      await attachCoverToSku({
        skuId: d.skuId,
        submission: d.submission,
        file: res.file, // cropped file
      });

      const nextIdx = idx + 1;
      setCropFileIdx(nextIdx);
      setActiveIdx(clamp(nextIdx, 0, Math.max(0, drafts.length - 1)));

      if (nextIdx >= files.length || nextIdx >= drafts.length) {
        setCropOpen(false);
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Upload failed");
      setCropOpen(false);
    } finally {
      setCreating(false);
    }
  }

  async function saveAllDraftsAndGoNext() {
    try {
      setCreating(true);
      for (const d of drafts) {
        await upsertGemstoneJewellerySubmission({
          ...d.submission,
          status: "DRAFT",
          updatedAt: Date.now(),
        } as any);
      }

      const skuIds = drafts.map((d) => d.skuId);
      sessionStorage.setItem("GJ_BULK_SKUS", JSON.stringify(skuIds));
      router.push("/supplier/gemstone-jewellery/bulk-add-details");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Save failed");
    } finally {
      setCreating(false);
    }
  }

  // auto clear if gst/uid changes
  useEffect(() => {
    if (!initKey) return;
    if (didInitRef.current === initKey) return;
    didInitRef.current = initKey;
    setDrafts([]);
    setActiveIdx(0);
    setErr("");
    setPickedFiles([]);
    setCropFileIdx(0);
    setCropOpen(false);
  }, [initKey]);

  if (!gst || !uid) {
    return (
      <div className="p-6">
        <div className="text-lg font-semibold">Bulk Upload</div>
        <div className="text-sm text-gray-600 mt-2">Waiting for supplier session…</div>
      </div>
    );
  }

  const active = drafts[activeIdx]?.submission;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Bulk Upload (Draft SKUs)</h1>
        <button
          type="button"
          className="px-4 py-2 rounded-xl border"
          onClick={() => router.push("/supplier/gemstone-jewellery")}
        >
          Back
        </button>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {err}
        </div>
      )}

      {!drafts.length ? (
        <div className="rounded-2xl border p-4 bg-white space-y-3">
          <div className="font-semibold">How many items do you want to upload?</div>
          <div className="text-sm text-gray-600">
            We will create that many <b>Draft SKUs</b>. Then you will pick <b>multiple photos in one go</b>.
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-28 border rounded-xl px-3 py-2"
              min={1}
              max={50}
            />
            <button
              type="button"
              onClick={createDrafts}
              disabled={creating}
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
            >
              Create Draft SKUs
            </button>
          </div>

          <div className="text-xs text-gray-500">Tip: Start with 5–10 for fastest workflow.</div>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="rounded-2xl border p-4 bg-white flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Item <b>{activeIdx + 1}</b> of <b>{drafts.length}</b> • SKU: <b>{active?.skuId}</b>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-xl border"
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx((x) => Math.max(0, x - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-xl border"
                disabled={activeIdx === drafts.length - 1}
                onClick={() => setActiveIdx((x) => Math.min(drafts.length - 1, x + 1))}
              >
                Next
              </button>
            </div>
          </div>

          {/* Bulk photo input (one-go selection) */}
          <div className="rounded-2xl border p-4 bg-white space-y-3">
            <div className="text-lg font-semibold">Pick Photos (one go)</div>
            <div className="text-sm text-gray-600">
              Select up to <b>{drafts.length}</b> photos. We will map them in order: 1st photo → 1st SKU, etc.
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex gap-2 items-center rounded-xl border px-3 py-2">
                <span className="text-sm font-semibold">Mode:</span>
                <button
                  type="button"
                  className={
                    "px-3 py-1 rounded-lg border text-sm " +
                    (bulkMode === "CROP_SEQ" ? "bg-black text-white border-black" : "bg-white border-gray-300")
                  }
                  onClick={() => setBulkMode("CROP_SEQ")}
                  disabled={creating}
                >
                  Sequential Crop
                </button>
                <button
                  type="button"
                  className={
                    "px-3 py-1 rounded-lg border text-sm " +
                    (bulkMode === "SKIP_CROP" ? "bg-black text-white border-black" : "bg-white border-gray-300")
                  }
                  onClick={() => setBulkMode("SKIP_CROP")}
                  disabled={creating}
                >
                  Skip Cropping
                </button>
              </div>

              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
                onClick={openPicker}
                disabled={creating}
              >
                Select Photos
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  onPickedFiles(e.target.files);
                  // reset so selecting the same files again triggers change
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div className="text-xs text-gray-500">
              {bulkMode === "CROP_SEQ"
                ? "After selection, you will crop 1-by-1. We auto-assign & move to next."
                : "Uploads happen immediately without cropping. You can crop later from Edit page."}
            </div>

            {!!pickedFiles.length && (
              <div className="text-sm text-gray-700">
                Picked: <b>{pickedFiles.length}</b> photo(s)
              </div>
            )}
          </div>

          {/* Simple status list */}
          <div className="rounded-2xl border bg-white overflow-hidden">
            <div className="px-4 py-3 text-xs font-semibold bg-gray-50 border-b">
              Drafts (cover status)
            </div>

            {drafts.map((d, i) => {
              const hasCover = (d.submission.media || []).some((m: any) => m?.kind === "IMG");
              return (
                <div
                  key={d.skuId}
                  className={"px-4 py-3 border-b last:border-b-0 flex items-center justify-between " + (i === activeIdx ? "bg-gray-50" : "")}
                >
                  <div className="text-sm">
                    <div className="font-semibold">#{i + 1} • {d.skuId}</div>
                    <div className="text-xs text-gray-500">{hasCover ? "✅ Cover added" : "— No cover yet"}</div>
                  </div>

                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl border text-sm"
                    onClick={() => setActiveIdx(i)}
                  >
                    Go
                  </button>
                </div>
              );
            })}
          </div>

          {/* Continue */}
          <div className="rounded-2xl border p-4 bg-white flex items-center justify-between">
            <div className="text-sm text-gray-600">
              After adding photos, apply common details to all items (draft).
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60"
              onClick={saveAllDraftsAndGoNext}
              disabled={creating || drafts.length === 0}
            >
              Continue to Bulk Details
            </button>
          </div>
        </>
      )}

      {/* Crop modal for sequential flow */}
      <CropModal
        open={cropOpen}
        file={pickedFiles[cropFileIdx] || null}
        title={
          drafts.length
            ? `Crop cover • Item ${cropFileIdx + 1} / ${Math.min(pickedFiles.length, drafts.length)} • SKU ${drafts[cropFileIdx]?.skuId || ""}`
            : "Crop cover"
        }
        onCancel={() => setCropOpen(false)}
        onDone={onCropDone}
      />
    </div>
  );
}
