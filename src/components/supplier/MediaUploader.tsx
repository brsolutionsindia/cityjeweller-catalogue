"use client";

import React, { useRef, useState } from "react";
import type { MediaItem } from "@/lib/yellowSapphire/types";
import { uploadMediaBatch, deleteMediaObject } from "@/lib/firebase/yellowSapphireDb";
import { useSupplierSession } from "@/lib/firebase/supplierContext";


type Props = {
  skuId: string;
  label: string;                 // "Photos" / "Videos"
  accept: string;                // "image/*" or "video/*"
  items: MediaItem[];            // controlled
  onChange: (next: MediaItem[]) => void;
  allowReorder?: boolean;        // true for photos
  kind: "IMG" | "VID"; // ✅ add this
};

export default function MediaUploader({
  skuId,
  label,
  accept,
  items,
  onChange,
  allowReorder,
  kind 
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickFiles = () => inputRef.current?.click();

const { gst } = useSupplierSession();

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    setUploading(true);
    try {
      const uploaded = await uploadMediaBatch(files, skuId, kind, gst!);

      // filter by accept type just in case
      const wantVideo = accept.startsWith("video");
      const filtered = uploaded.filter((m) =>
        wantVideo ? m.type === "video" : m.type === "image"
      );

      onChange([...items, ...filtered]);
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (m: MediaItem) => {
    // optimistic remove
    onChange(items.filter((x) => x.url !== m.url));

    const storagePath = (m as any).storagePath || (m as any).path;
    if (storagePath) {
      try {
        await deleteMediaObject(storagePath);
      } catch (e) {
        console.warn("Delete failed:", storagePath, e);
        // optional: show toast instead of alert
      }
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  const setCover = (idx: number) => {
    if (!allowReorder) return;
    move(idx, 0);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">{label}</div>

        <button
          type="button"
          onClick={pickFiles}
          disabled={uploading}
          className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
        >
          {uploading ? "Uploading..." : `Add ${label}`}
        </button>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={accept}
          capture="environment"
          onChange={onPick}
        />
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-gray-600">No {label.toLowerCase()} added yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((m, idx) => {
            const isVideo = m.type === "video";
            return (
              <div key={`${m.url}-${idx}`} className="rounded-xl border overflow-hidden bg-white">
                <div className="relative">
                  {isVideo ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={m.url} className="w-full h-28 object-cover" controls />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="media" className="w-full h-28 object-cover" />
                  )}

                  {/* Cover badge for photos */}
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
                      <button
                        type="button"
                        className="underline"
                        onClick={() => move(idx, idx + 1)}
                        disabled={idx === items.length - 1}
                      >
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
