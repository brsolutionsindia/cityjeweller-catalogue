"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/firebaseConfig";

import { overwriteMediaAtPath, getDownloadUrlForPath } from "@/lib/firebase/yellowSapphireDb";
import { removeSubmissionMediaItem } from "@/lib/firebase/yellowSapphireAdminDb";

import type { MediaItem, YellowSapphireSubmission } from "@/lib/yellowSapphire/types";
import {
  approveYellowSapphire,
  getYellowSapphireSubmission,
  rejectYellowSapphire,
  updateSubmissionMedia,
} from "@/lib/firebase/yellowSapphireAdminDb";

const DEFAULT_MARGIN = 20;

const withBust = (m: MediaItem) => {
  const u = m.url || "";
  const v = m.updatedAt ? String(m.updatedAt) : "";
  if (!u) return "";
  if (!v) return u;
  return u.includes("?") ? `${u}&v=${v}` : `${u}?v=${v}`;
};


export default function Page() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();

  const rawSkuId = typeof params?.skuId === "string" ? params.skuId : "";
  const skuId = decodeURIComponent(rawSkuId);
  const gst = useMemo(() => search?.get("gst") ?? "", [search]);

  const [data, setData] = useState<YellowSapphireSubmission | null>(null);
  const [busy, setBusy] = useState(true);

  // editable admin fields
  const [margin, setMargin] = useState<number>(DEFAULT_MARGIN);
  const [rejectRemarks, setRejectRemarks] = useState("");

  // editable media (minor adjustment)
  const [images, setImages] = useState<MediaItem[]>([]);
  const [videos, setVideos] = useState<MediaItem[]>([]);

  const baseRate = Number(data?.ratePerCaratInr || 0);
  const publicRate = useMemo(() => Math.round(baseRate * (1 + (Number(margin || 0) / 100))), [baseRate, margin]);

  const load = async () => {
    if (!gst || !skuId) return;
    setBusy(true);
    try {
      const s = await getYellowSapphireSubmission(gst, skuId);
      setData(s);
      setMargin(Number(s?.adminMarginPct ?? DEFAULT_MARGIN));
      setRejectRemarks(s?.adminRemarks || "");
      setImages(s?.media?.images || []);
      setVideos(s?.media?.videos || []);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gst, skuId]);

  const saveMedia = async () => {
    if (!gst || !skuId) return;
    setBusy(true);
    try {
      await updateSubmissionMedia({ gst, skuId, images, videos });
      alert("Media updated.");
      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to update media.");
    } finally {
      setBusy(false);
    }
  };

  const move = (arr: MediaItem[], from: number, to: number) => {
    const copy = [...arr];
    const [x] = copy.splice(from, 1);
    copy.splice(to, 0, x);
    return copy;
  };

  const approve = async () => {
    if (!gst || !skuId) return;
    const adminId = auth.currentUser?.uid || "admin";
    setBusy(true);
    try {
      await approveYellowSapphire({ gst, skuId, adminId, marginPct: Number(margin || 0) });
      alert("Approved & published.");
      router.push("/admin/yellow-sapphires");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Approve failed.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!gst || !skuId) return;
    if (!rejectRemarks.trim()) {
      alert("Please enter rejection remarks (will be shown to supplier).");
      return;
    }
    const adminId = auth.currentUser?.uid || "admin";
    setBusy(true);
    try {
      await rejectYellowSapphire({ gst, skuId, adminId, remarks: rejectRemarks.trim() });
      alert("Rejected. Remarks saved for supplier.");
      router.push("/admin/yellow-sapphires");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Reject failed.");
    } finally {
      setBusy(false);
    }
  };

  if (busy) return <div className="p-6">Loading…</div>;
  if (!gst) return <div className="p-6">Missing GST in URL. Go back and open from list.</div>;
  if (!data) return <div className="p-6">Submission not found.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/admin/yellow-sapphires" className="text-sm underline">← Back to list</Link>
          <div className="text-2xl font-bold">{data.skuId}</div>
          <div className="text-xs text-gray-600">
            GST: <b>{data.gstNumber}</b> • Supplier UID: <b>{data.supplierUid}</b> • Status: <b>{data.status}</b>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-lg border px-4 py-2 hover:bg-gray-50" onClick={saveMedia} disabled={busy}>
            Save Media Order
          </button>
          <button className="rounded-lg bg-black text-white px-4 py-2 hover:bg-zinc-900" onClick={approve} disabled={busy}>
            Approve
          </button>
        </div>
      </div>

      {/* Core details */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Shape/Cut:</span> <b>{data.shapeCut}</b></div>
          <div><span className="text-gray-500">Color:</span> <b>{data.color}</b></div>
          <div><span className="text-gray-500">Clarity:</span> <b>{data.clarity}</b></div>
          <div><span className="text-gray-500">Weight:</span> <b>{data.weightCarat} ct</b></div>
          <div><span className="text-gray-500">Measurement:</span> <b>{data.measurementMm}</b></div>
          <div><span className="text-gray-500">Certified:</span> <b>{data.certified}</b></div>
          <div><span className="text-gray-500">Treatment:</span> <b>{data.treatmentStatus}</b></div>
          <div><span className="text-gray-500">Origin:</span> <b>{data.origin}</b></div>
          <div><span className="text-gray-500">Luster:</span> <b>{data.luster}</b></div>
          {data.stoneLocalCode && (
            <div><span className="text-gray-500">Stone Code:</span> <b>{data.stoneLocalCode}</b></div>
          )}
        </div>

        {data.remarks && (
          <div className="mt-4 text-sm">
            <div className="text-gray-500">Supplier Remarks</div>
            <div className="mt-1">{data.remarks}</div>
          </div>
        )}
      </div>

      {/* Pricing */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
        <div className="text-lg font-semibold">Pricing</div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Supplier Rate/ct (base)</div>
            <div className="text-lg font-bold">₹{baseRate}</div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Margin (%)</div>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2"
              type="number"
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
            />
            <div className="text-xs text-gray-500 mt-1">Default 20%, editable now and later.</div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Public Rate/ct (computed)</div>
            <div className="text-lg font-bold">₹{publicRate}</div>
          </div>
        </div>
      </div>

      {/* Media reorder (simple) */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Media Ordering</div>
          <div className="text-xs text-gray-500">Make cover = first image</div>
        </div>

        <div className="space-y-3">
          <div className="font-medium">Images</div>
          <div className="grid md:grid-cols-2 gap-3">
            {images.map((m, idx) => (
              <div
                key={`${m.storagePath ?? m.url ?? "media"}-${idx}`}
                className="rounded-2xl border p-3 flex gap-3"
              >

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={withBust(m)} alt="img" className="w-28 h-20 rounded-xl object-cover border" />


                <div className="flex gap-2 mt-2 flex-wrap">
                  <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => downloadMedia(m)}>
                    Download
                  </button>

                  <label className="rounded-lg border px-3 py-1 text-sm cursor-pointer">
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) replaceMedia("IMG", idx, f);
                        e.currentTarget.value = ""; // allow selecting same file again
                      }}
                    />
                  </label>

                  <button
                    className="rounded-lg border px-3 py-1 text-sm"
                    onClick={() => {
                      const delStorage = confirm("Also delete from Firebase Storage?");
                      deleteMedia("IMG", idx, delStorage);
                    }}
                  >
                    Delete
                  </button>

                  {/* your existing up/down/make cover buttons */}
                </div>




                <div className="flex-1">
                  <div className="text-xs text-gray-500">#{idx + 1}</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      disabled={idx === 0}
                      onClick={() => setImages((prev) => move(prev, idx, idx - 1))}
                    >
                      ↑
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      disabled={idx === images.length - 1}
                      onClick={() => setImages((prev) => move(prev, idx, idx + 1))}
                    >
                      ↓
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      disabled={idx === 0}
                      onClick={() => setImages((prev) => move(prev, idx, 0))}
                    >
                      Make Cover
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="font-medium mt-6">Videos</div>
          <div className="grid md:grid-cols-2 gap-3">
            {videos.map((m, idx) => (
              <div
                key={`${m.storagePath ?? m.url ?? "media"}-${idx}`}
                className="rounded-2xl border p-3 flex gap-3"
              >
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={withBust(m)} controls className="w-28 h-20 rounded-xl object-cover border" />

                <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => downloadMedia(m)}>
                  Download
                </button>

                <label className="rounded-lg border px-3 py-1 text-sm cursor-pointer">
                  Replace
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) replaceMedia("VID", idx, f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>

                <button
                  className="rounded-lg border px-3 py-1 text-sm"
                  onClick={() => {
                    const delStorage = confirm("Also delete from Firebase Storage?");
                    deleteMedia("VID", idx, delStorage);
                  }}
                >
                  Delete
                </button>


                <div className="flex-1">
                  <div className="text-xs text-gray-500">#{idx + 1}</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      disabled={idx === 0}
                      onClick={() => setVideos((prev) => move(prev, idx, idx - 1))}
                    >
                      ↑
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      disabled={idx === videos.length - 1}
                      onClick={() => setVideos((prev) => move(prev, idx, idx + 1))}
                    >
                      ↓
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={() => setVideos((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-500 mt-2">
            After changes, click <b>Save Media Order</b>.
          </div>
        </div>
      </div>

      {/* Reject */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
        <div className="text-lg font-semibold">Reject Listing</div>
        <div className="text-sm text-gray-600">
          Mention why not accepted (shown to supplier in their Yellow Sapphire dashboard).
        </div>
        <textarea
          className="w-full border rounded-xl p-3 min-h-[110px]"
          placeholder="e.g. Measurement missing / unclear video / color mismatch…"
          value={rejectRemarks}
          onChange={(e) => setRejectRemarks(e.target.value)}
        />
        <div className="flex justify-end">
          <button className="rounded-lg border px-4 py-2 hover:bg-gray-50" onClick={reject} disabled={busy}>
            Reject
          </button>
        </div>
      </div>
    </div>
  );

  async function downloadMedia(m: MediaItem) {
    try {
      const url = m.storagePath ? await getDownloadUrlForPath(m.storagePath) : m.url;
      if (!url) return alert("No download URL.");
      window.open(url, "_blank"); // simplest
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Download failed");
    }
  }

  async function replaceMedia(kind: "IMG" | "VID", idx: number, file: File) {
    if (!gst || !skuId) return;
    const list = kind === "IMG" ? images : videos;
    const target = list[idx];
    if (!target?.storagePath) return alert("Missing storagePath on this media.");

    setBusy(true);
    try {
      // Update DB media item updatedAt so UI can bust cache
      const dbNode =
        kind === "IMG"
          ? `GST/${gst}/Submissions/YellowSapphires/${skuId}/media/images/${idx}`
          : `GST/${gst}/Submissions/YellowSapphires/${skuId}/media/videos/${idx}`;

      const newUrl = await overwriteMediaAtPath({
        storagePath: target.storagePath,
        file,
        dbNodesToUpdate: [dbNode],
      });


      // Update local state instantly
      const now = Date.now();
      const next = [...list];
      next[idx] = { ...next[idx], url: newUrl, updatedAt: now, contentType: file.type || next[idx].contentType };

      if (kind === "IMG") setImages(next);
      else setVideos(next);

      alert("Replaced successfully.");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Replace failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMedia(kind: "IMG" | "VID", idx: number, deleteFromStorage: boolean) {
    if (!gst || !skuId) return;
    setBusy(true);
    try {
      await removeSubmissionMediaItem({ gst, skuId, kind, index: idx, deleteFromStorage });
      alert(deleteFromStorage ? "Removed + deleted from storage." : "Removed from submission.");
      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }



}
