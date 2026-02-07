"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
export type UploadFn<T> = (params: {
  gst: string;
  skuId: string;
  kind: "IMG" | "VID";
  files: File[];
}) => Promise<T[]>;

export type DeleteFn = (storagePath: string) => Promise<void>;

import { useSupplierSession } from "@/lib/firebase/supplierContext";

import Cropper from "react-easy-crop";

type Props<TMedia> = {
  skuId: string;
  label: string;
  accept: string;
  items: TMedia[];
  onChange: (next: TMedia[]) => void;
  allowReorder?: boolean;
  kind: "IMG" | "VID";

  uploadFn: UploadFn<TMedia>;
  deleteFn: DeleteFn;

  // adapters so MediaUploader can work with any MediaItem shape
  getUrl: (m: TMedia) => string;
  getStoragePath: (m: TMedia) => string;
  isVideoItem: (m: TMedia) => boolean;
  setOrder: (m: TMedia, order: number) => TMedia;
  setPrimary?: (m: TMedia, isPrimary: boolean) => TMedia; // optional (for images)
};


// ---------- helpers ----------
function isImageAccept(accept: string) {
  return accept.startsWith("image");
}
function isVideoAccept(accept: string) {
  return accept.startsWith("video");
}

function fileExtFromMime(mime: string) {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime")) return "mov";
  return "bin";
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

async function blobToFile(blob: Blob, baseName: string) {
  const ext = fileExtFromMime(blob.type || "application/octet-stream");
  const safe = baseName.replace(/[^\w\-]+/g, "_");
  return new File([blob], `${safe}.${ext}`, { type: blob.type || "application/octet-stream" });
}

// react-easy-crop expects pixel crop; we render to canvas
async function getCroppedImageBlob(imageUrl: string, cropPixels: { x: number; y: number; width: number; height: number }) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropPixels.width);
  canvas.height = Math.round(cropPixels.height);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");

  ctx.drawImage(
    img,
    Math.round(cropPixels.x),
    Math.round(cropPixels.y),
    Math.round(cropPixels.width),
    Math.round(cropPixels.height),
    0,
    0,
    Math.round(cropPixels.width),
    Math.round(cropPixels.height)
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to export crop"))), "image/jpeg", 0.92);
  });

  return blob;
}

// Lazy-load ffmpeg only when trimming is used (keeps initial load fast)
async function trimVideoWithFfmpeg(opts: {
  inputFile: File;
  startSec: number;
  endSec: number;
  removeAudio: boolean; // always true for you
}) {
  const { inputFile, startSec, endSec, removeAudio } = opts;

  const [{ FFmpeg }, { fetchFile }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);

  const ffmpeg = new FFmpeg();

  // Faster: cache single load instance per call – you can globalize later if desired
  await ffmpeg.load();

  const inName = `in.${fileExtFromMime(inputFile.type || "video/mp4")}`;
  const outName = "out.mp4";

  await ffmpeg.writeFile(inName, await fetchFile(inputFile));

  // -ss/-to before -i is faster sometimes, but accuracy can vary.
  // We’ll do: -ss START -to END -i inName
  // Export MP4, drop audio using -an
  const args = [
    "-ss",
    String(startSec),
    "-to",
    String(endSec),
    "-i",
    inName,
    ...(removeAudio ? ["-an"] : []),
    // more compatible encode
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-movflags",
    "+faststart",
    outName,
  ];

  await ffmpeg.exec(args);

  const outData = await ffmpeg.readFile(outName);
  const outBlob = new Blob([outData], { type: "video/mp4" });

  return outBlob;
}

// ---------- UI modals ----------
function ModalShell(props: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="font-semibold">{props.title}</div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg px-3 py-1 text-sm hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        <div className="p-4">{props.children}</div>
      </div>
    </div>
  );
}

function ImageCropperModal(props: {
  open: boolean;
  imageUrl: string | null;
  onCancel: () => void;
  onConfirm: (croppedBlob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // 3:4 portrait => width:height = 3:4
  const aspect = 3 / 4;

  useEffect(() => {
    if (!props.open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropPixels(null);
    }
  }, [props.open]);

  return (
    <ModalShell open={props.open} title="Crop Photo (3:4 Portrait)" onClose={props.onCancel}>
      {!props.imageUrl ? (
        <div className="text-sm text-gray-600">No image loaded.</div>
      ) : (
        <>
          <div className="relative w-full h-[60vh] bg-black rounded-xl overflow-hidden">
            <Cropper
              image={props.imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCropPixels(pixels)}
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="text-xs text-gray-600 w-16">Zoom</div>
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

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={props.onCancel}
              className="rounded-xl border px-4 py-2 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!props.imageUrl || !cropPixels) return;
                const blob = await getCroppedImageBlob(props.imageUrl, cropPixels);
                props.onConfirm(blob);
              }}
              className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
            >
              Use Cropped Photo
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function VideoTrimModal(props: {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (trimmedBlob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [working, setWorking] = useState(false);

  const objectUrl = useMemo(() => (props.file ? URL.createObjectURL(props.file) : null), [props.file]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    if (!props.open) {
      setDuration(0);
      setStart(0);
      setEnd(0);
      setWorking(false);
    }
  }, [props.open]);

  return (
    <ModalShell open={props.open} title="Trim Video (No Audio)" onClose={props.onCancel}>
      {!props.file || !objectUrl ? (
        <div className="text-sm text-gray-600">No video loaded.</div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={objectUrl}
            className="w-full max-h-[55vh] rounded-xl bg-black"
            controls
            onLoadedMetadata={(e) => {
              const d = (e.currentTarget as HTMLVideoElement).duration || 0;
              setDuration(d);
              setStart(0);
              setEnd(d);
            }}
          />

          <div className="mt-4 space-y-3">
            <div className="text-sm text-gray-700">
              Select trim range (seconds). Audio will be removed automatically.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                Start: <span className="font-semibold">{start.toFixed(1)}s</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, duration - 0.1)}
                  step={0.1}
                  value={start}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const next = clamp(v, 0, Math.max(0, end - 0.1));
                    setStart(next);
                  }}
                  className="w-full"
                />
              </label>

              <label className="text-sm">
                End: <span className="font-semibold">{end.toFixed(1)}s</span>
                <input
                  type="range"
                  min={0.1}
                  max={Math.max(0.1, duration)}
                  step={0.1}
                  value={end}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const next = clamp(v, Math.min(duration, start + 0.1), duration);
                    setEnd(next);
                  }}
                  className="w-full"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={props.onCancel}
              className="rounded-xl border px-4 py-2 hover:bg-gray-50"
              disabled={working}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!props.file) return;
                setWorking(true);
                try {
                  const trimmed = await trimVideoWithFfmpeg({
                    inputFile: props.file,
                    startSec: start,
                    endSec: end,
                    removeAudio: true, // your requirement
                  });
                  props.onConfirm(trimmed);
                } catch (e) {
                  console.error(e);
                  alert("Video trim failed. Please try again.");
                } finally {
                  setWorking(false);
                }
              }}
              className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
              disabled={working || duration <= 0 || end <= start}
            >
              {working ? "Processing..." : "Use Trimmed Video"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ---------- main component ----------
export default function MediaUploader<TMedia>({
  skuId,
  label,
  accept,
  items,
  onChange,
  allowReorder,
  kind,

  uploadFn,
  deleteFn,

  getUrl,
  getStoragePath,
  isVideoItem,
  setOrder,
  setPrimary,
}: Props<TMedia>) {
  const session = useSupplierSession();
  const gst = session?.gst;

  if (!gst) {
    alert("Supplier session not ready. Please re-login.");
    return;
  }

  const camInputRef = useRef<HTMLInputElement | null>(null);
  const galInputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);

  // For editors
  const [cropOpen, setCropOpen] = useState(false);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [pendingImageName, setPendingImageName] = useState("photo");

  const [trimOpen, setTrimOpen] = useState(false);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);

  // Camera recording (no audio)
  const [recOpen, setRecOpen] = useState(false);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);

  const wantImage = isImageAccept(accept);
  const wantVideo = isVideoAccept(accept);

  // cleanup crop URL
  useEffect(() => {
    return () => {
      if (cropUrl) URL.revokeObjectURL(cropUrl);
    };
  }, [cropUrl]);

  const uploadOneFile = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadFn({ gst: gst!, skuId, kind, files: [file] });
      const merged = [...items, ...uploaded];

      onChange(
        merged.map((m, i) => {
          let next = setOrder(m, i);
          if (allowReorder && kind === "IMG" && setPrimary) {
            next = setPrimary(next, i === 0);
          }
          return next;
        })
      );
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onPickFromInput = async (files: File[]) => {
    if (!files.length) return;

    // Your UX requirement: after pick/capture -> open editor
    const f = files[0];

    if (wantImage) {
      const url = URL.createObjectURL(f);
      setPendingImageName(f.name || "photo");
      setCropUrl(url);
      setCropOpen(true);
      return;
    }

    if (wantVideo) {
      // For gallery video: open trim editor
      setPendingVideoFile(f);
      setTrimOpen(true);
      return;
    }

    // fallback
    await uploadOneFile(f);
  };

  const remove = async (m: TMedia) => {
    const storagePath = getStoragePath(m);

    // optimistic remove
    onChange(items.filter((x) => getStoragePath(x) !== storagePath));

    if (storagePath) {
      try {
        await deleteFn(storagePath);
      } catch (e) {
        console.warn("Delete failed:", storagePath, e);
      }
    }
  };


  const normalizeOrder = (arr: TMedia[]) =>
    arr.map((m, i) => {
      let next = setOrder(m, i);
      if (allowReorder && kind === "IMG" && setPrimary) {
        next = setPrimary(next, i === 0);
      }
      return next;
    });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(normalizeOrder(next));
  };

  const setCover = (idx: number) => {
    if (!allowReorder) return;
    move(idx, 0);
  };



  // ---------- camera video recorder (no audio) ----------
  const openRecorder = async () => {
    if (!wantVideo) return;
    setRecOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false, // ✅ no audio
      });
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        await previewRef.current.play();
      }
    } catch (e) {
      console.error(e);
      alert("Camera access failed. Please allow camera permission.");
      setRecOpen(false);
    }
  };

  const stopRecorderAndCleanup = () => {
    setRecording(false);
    mediaRecorderRef.current?.stop?.();
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current.srcObject = null;
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, {
      mimeType: "video/webm", // widely supported; we later export MP4 in ffmpeg trim step
    });

    mr.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };

    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });

      // after recording: open trim modal (and it will remove audio anyway)
      const f = new File([blob], `camera_video_${Date.now()}.webm`, { type: "video/webm" });
      setPendingVideoFile(f);
      setTrimOpen(true);
    };

    mr.start();
    mediaRecorderRef.current = mr;
    setRecording(true);
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  // ---------- render ----------
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">{label}</div>

        <div className="flex flex-wrap gap-2 justify-end">
          {/* ✅ Option 1: Camera */}
          {wantImage ? (
            <button
              type="button"
              onClick={() => camInputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Camera"}
            </button>
          ) : (
            <button
              type="button"
              onClick={openRecorder}
              disabled={uploading}
              className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Record Video"}
            </button>
          )}

          {/* ✅ Option 2: Gallery */}
          <button
            type="button"
            onClick={() => galInputRef.current?.click()}
            disabled={uploading}
            className="rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-60"
          >
            {wantImage ? "Pick from Gallery" : "Pick Video from Gallery"}
          </button>
        </div>

        {/* hidden inputs */}
        <input
          ref={camInputRef}
          type="file"
          className="hidden"
          accept={accept}
          capture="environment" // ✅ camera capture for mobile
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            onPickFromInput(files);
          }}
        />

        <input
          ref={galInputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            onPickFromInput(files);
          }}
        />
      </div>

      {/* Photo crop modal */}
      <ImageCropperModal
        open={cropOpen}
        imageUrl={cropUrl}
        onCancel={() => {
          setCropOpen(false);
          if (cropUrl) URL.revokeObjectURL(cropUrl);
          setCropUrl(null);
        }}
        onConfirm={async (croppedBlob) => {
          setCropOpen(false);
          if (cropUrl) URL.revokeObjectURL(cropUrl);
          setCropUrl(null);

          const file = await blobToFile(croppedBlob, pendingImageName || `photo_${Date.now()}`);
          await uploadOneFile(file);
        }}
      />

      {/* Video trim modal */}
      <VideoTrimModal
        open={trimOpen}
        file={pendingVideoFile}
        onCancel={() => {
          setTrimOpen(false);
          setPendingVideoFile(null);
        }}
        onConfirm={async (trimmedBlob) => {
          setTrimOpen(false);

          const base = pendingVideoFile?.name || `video_${Date.now()}`;
          setPendingVideoFile(null);

          const outFile = await blobToFile(trimmedBlob, base.replace(/\.[^/.]+$/, "") + "_trimmed");
          await uploadOneFile(outFile);
        }}
      />

      {/* Camera recorder modal */}
      <ModalShell
        open={recOpen}
        title="Record Video (No Audio)"
        onClose={() => {
          stopRecorderAndCleanup();
          setRecOpen(false);
        }}
      >
        <div className="space-y-3">
          <video ref={previewRef} className="w-full max-h-[55vh] rounded-xl bg-black" playsInline />

          <div className="flex gap-2 justify-end">
            {!recording ? (
              <button
                type="button"
                className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
                onClick={startRecording}
              >
                Start
              </button>
            ) : (
              <button
                type="button"
                className="rounded-xl bg-red-600 text-white px-4 py-2 hover:bg-red-700"
                onClick={stopRecording}
              >
                Stop
              </button>
            )}

            <button
              type="button"
              className="rounded-xl border px-4 py-2 hover:bg-gray-50"
              onClick={() => {
                stopRecorderAndCleanup();
                setRecOpen(false);
              }}
            >
              Done
            </button>
          </div>

          <div className="text-xs text-gray-600">
            Audio is disabled for recording. After stopping, you’ll get a trim screen before upload.
          </div>
        </div>
      </ModalShell>

      {/* Existing media grid */}
      {items.length === 0 ? (
        <div className="text-sm text-gray-600">No {label.toLowerCase()} added yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((m, idx) => {
            const isVideo = isVideoItem(m);
            const url = getUrl(m);
            const sp = getStoragePath(m);

            return (
              <div key={`${sp}-${idx}`} className="rounded-xl border overflow-hidden bg-white">
                <div className="relative">
                  {isVideo ? (
                    <video src={url} className="w-full h-28 object-cover" controls />
                  ) : (
                    <img src={url} alt="media" className="w-full h-28 object-cover" />
                  )}

                  {!isVideo && allowReorder && idx === 0 && (
                    <div className="absolute top-2 left-2 text-xs bg-white/90 border rounded-full px-2 py-1">
                      Cover
                    </div>
                  )}
                </div>

                <div className="p-2 flex flex-wrap gap-2 text-xs">
                  <button type="button" className="underline" onClick={() => remove(m)}>
                    Remove
                  </button>

                  {allowReorder && !isVideo && (
                    <>
                      <button type="button" className="underline" onClick={() => move(idx, idx - 1)} disabled={idx === 0}>
                        ←
                      </button>
                      <button type="button" className="underline" onClick={() => move(idx, idx + 1)} disabled={idx === items.length - 1}>
                        →
                      </button>
                      {idx !== 0 && (
                        <button type="button" className="underline" onClick={() => setCover(idx)}>
                          Set Cover
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}
