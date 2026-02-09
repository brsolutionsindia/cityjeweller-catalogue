"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/firebaseConfig";

import type { RudrakshaSubmission, MediaItem } from "@/lib/rudraksha/types";
import {
  getQueuedRudraksha,
  approveRudraksha,
  rejectRudraksha,
  updateRudrakshaSubmissionMedia,
  removeRudrakshaSubmissionMediaItem,
} from "@/lib/firebase/rudrakshaAdminDb";

const DEFAULT_MARGIN = 20;

const withBust = (m: any) => {
  const u = m?.url || "";
  const v = m?.updatedAt ? String(m.updatedAt) : "";
  if (!u) return "";
  if (!v) return u;
  return u.includes("?") ? `${u}&v=${v}` : `${u}?v=${v}`;
};

function move<T>(arr: T[], from: number, to: number) {
  const copy = [...arr];
  const [x] = copy.splice(from, 1);
  copy.splice(to, 0, x);
  return copy;
}

function asKind(m: any): "IMG" | "VID" | "CERT" {
  if (m?.kind === "IMG" || m?.kind === "VID" || m?.kind === "CERT") return m.kind;
  if (m?.type === "video") return "VID";
  if (m?.type === "file") return "CERT";
  return "IMG";
}


function normalizeMediaList(list: MediaItem[], kind: "IMG" | "VID" | "CERT") {
  const now = Date.now();
  return (list || [])
    .filter(Boolean)
    .map((m: any, i) => ({
      ...m,
      kind: asKind(m),
      order: i,
      updatedAt: m?.updatedAt ?? now,
      createdAt: m?.createdAt ?? now,
      id: m?.id || m?.storagePath || m?.url || `${kind}_${i}`,
    }))
    .filter((m: any) => m.kind === kind);
}

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isWeightMode(pm: any) {
  const x = String(pm || "").toUpperCase();
  return x === "WEIGHT" || x === "PRICE_PER_WEIGHT" || x === "RATE_PER_WEIGHT";
}

function computeBase(data: any) {
  const pm = String(data?.priceMode || "MRP");
  if (isWeightMode(pm)) {
    const rate = toNum(data?.ratePerGm);
    const wt = toNum(data?.weightGm);
    const base = rate > 0 && wt > 0 ? Math.round(rate * wt) : 0;
    return { base, source: "WEIGHT(ratePerGm*weightGm)" };
  }

  const offer = toNum(data?.offerPrice);
  const mrp = toNum(data?.mrp);

  if (offer > 0) return { base: Math.round(offer), source: "OFFER_PRICE" };
  if (mrp > 0) return { base: Math.round(mrp), source: "MRP" };
  return { base: 0, source: "NONE" };
}

export default function AdminRudrakshaDetail() {
  const params = useParams<{ skuId: string }>();
  const router = useRouter();

  const rawSkuId = typeof params?.skuId === "string" ? params.skuId : "";
  const skuId = useMemo(() => decodeURIComponent(rawSkuId), [rawSkuId]);

  const [data, setData] = useState<RudrakshaSubmission | null>(null);
  const [busy, setBusy] = useState(true);

  const [rejectReason, setRejectReason] = useState("");
  const [images, setImages] = useState<MediaItem[]>([]);
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [certificates, setCertificates] = useState<MediaItem[]>([]);

  const [marginPct, setMarginPct] = useState<number>(DEFAULT_MARGIN);

  async function load() {
    if (!skuId) return;
    setBusy(true);
    try {
      const s = await getQueuedRudraksha(skuId);
      setData(s);
      setRejectReason((s as any)?.rejectionReason || "");

      const existingMargin = toNum((s as any)?.adminMarginPct) || DEFAULT_MARGIN;
      setMarginPct(existingMargin);

      const all = (s?.media || []) as any[];

      const imgs = all
        .filter((m) => asKind(m) === "IMG")
        .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));

      const vids = all
        .filter((m) => asKind(m) === "VID")
        .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));

      const certs = all
        .filter((m) => asKind(m) === "CERT")
        .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));

      setImages(normalizeMediaList(imgs as any, "IMG"));
      setVideos(normalizeMediaList(vids as any, "VID"));
      setCertificates(normalizeMediaList(certs as any, "CERT"));

    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [skuId]);

  const priceMode = String((data as any)?.priceMode || "MRP");
  const ratePerGm = toNum((data as any)?.ratePerGm);
  const weightGm = toNum((data as any)?.weightGm);

  const { base: baseAmount, source: baseSource } = useMemo(() => computeBase(data), [data]);
  const publicAmount = useMemo(() => {
    const m = toNum(marginPct);
    return baseAmount > 0 ? Math.round(baseAmount * (1 + m / 100)) : 0;
  }, [baseAmount, marginPct]);

  async function saveMediaOrder() {
    if (!data?.gstNumber || !data?.skuId) return;
    setBusy(true);
    try {
      const nextImages = normalizeMediaList(images, "IMG");
      const nextVideos = normalizeMediaList(videos, "VID");
      const nextCerts = normalizeMediaList(certificates, "CERT");

      await updateRudrakshaSubmissionMedia({
        gstNumber: data.gstNumber,
        skuId: data.skuId,
        images: nextImages,
        videos: nextVideos,
        certificates: nextCerts,
      });

      alert("Media order updated.");
      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to update media order.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!data?.gstNumber || !data?.skuId) return;
    const adminUid = auth.currentUser?.uid || "ADMIN";
    setBusy(true);
    try {
      await approveRudraksha({
        gstNumber: data.gstNumber,
        skuId: data.skuId,
        adminUid,
        finalPatch: {
          adminMarginPct: toNum(marginPct) || 0,
          computedBasePrice: baseAmount,
          computedPublicPrice: publicAmount,
          computedPriceSource: baseSource,
        } as any,
      });

      alert("Approved & published.");
      router.push("/admin/rudraksha");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Approve failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!data?.gstNumber || !data?.skuId) return;
    if (!rejectReason.trim()) return alert("Enter rejection reason.");
    const adminUid = auth.currentUser?.uid || "ADMIN";
    setBusy(true);
    try {
      await rejectRudraksha({
        gstNumber: data.gstNumber,
        skuId: data.skuId,
        adminUid,
        reason: rejectReason.trim(),
      });
      alert("Rejected.");
      router.push("/admin/rudraksha");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Reject failed.");
    } finally {
      setBusy(false);
    }
  }

  if (busy) return <div className="p-6">Loading…</div>;
  if (!data) return <div className="p-6">Not found in queue.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/admin/rudraksha" className="text-sm underline">← Back to list</Link>
          <div className="text-2xl font-bold">{data.skuId}</div>
          <div className="text-xs text-gray-600">
            GST: <b>{data.gstNumber}</b> • Supplier UID: <b>{data.supplierUid}</b> • Status: <b>{data.status}</b>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-lg border px-4 py-2 hover:bg-gray-50" onClick={saveMediaOrder} disabled={busy}>
            Save Media Order
          </button>
          <button className="rounded-lg bg-black text-white px-4 py-2 hover:bg-zinc-900" onClick={approve} disabled={busy}>
            Approve
          </button>
        </div>
      </div>

      {/* Pricing */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
        <div className="text-lg font-semibold">Pricing</div>

        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Price Mode</div>
            <div className="text-lg font-bold">{priceMode}</div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">MRP</div>
            <div className="text-lg font-bold">{data.mrp ? `₹${data.mrp}` : "-"}</div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Offer Price</div>
            <div className="text-lg font-bold">{data.offerPrice ? `₹${data.offerPrice}` : "-"}</div>
          </div>

          <div className="rounded-xl border p-3 md:col-span-3">
            <div className="text-xs text-gray-500">Weight inputs (if provided)</div>
            <div className="mt-1"><b>Rate/gm:</b> {ratePerGm ? `₹${ratePerGm}` : "-"} • <b>Weight:</b> {weightGm ? `${weightGm} gm` : "-"}</div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Admin Margin (%)</div>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" type="number" value={marginPct} onChange={(e) => setMarginPct(Number(e.target.value))} />
            <div className="text-xs text-gray-500 mt-1">Applied on selected base price.</div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Base Price (selected)</div>
            <div className="text-lg font-bold">{baseAmount ? `₹${baseAmount}` : "-"}</div>
            <div className="text-[11px] text-gray-500 mt-1">Source: {baseSource}</div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Computed Public Price</div>
            <div className="text-2xl font-bold">{publicAmount ? `₹${publicAmount}` : "-"}</div>
          </div>
        </div>
      </div>

      {/* Media Ordering */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Media Ordering</div>
          <div className="text-xs text-gray-500">Make cover = first image</div>
        </div>

        <div className="space-y-3">
          <div className="font-medium">Images</div>
          <div className="grid md:grid-cols-2 gap-3">
            {images.map((m: any, idx) => (
              <div key={`${m.storagePath ?? m.url ?? "media"}-${idx}`} className="rounded-2xl border p-3 flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={withBust(m)} alt="img" className="w-28 h-20 rounded-xl object-cover border" />

                <div className="flex-1">
                  <div className="text-xs text-gray-500">#{idx + 1}</div>

                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => downloadMedia(m)}>Download</button>

                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={async () => {
                        const delStorage = confirm("Also delete from Firebase Storage?");
                        await deleteMedia("IMG", idx, delStorage);
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button className="rounded-lg border px-3 py-1 text-sm" disabled={idx === 0} onClick={() => setImages((prev) => move(prev, idx, idx - 1))}>↑</button>
                    <button className="rounded-lg border px-3 py-1 text-sm" disabled={idx === images.length - 1} onClick={() => setImages((prev) => move(prev, idx, idx + 1))}>↓</button>
                    <button className="rounded-lg border px-3 py-1 text-sm" disabled={idx === 0} onClick={() => setImages((prev) => move(prev, idx, 0))}>Make Cover</button>
                    <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="font-medium mt-6">Videos</div>
          <div className="grid md:grid-cols-2 gap-3">
            {videos.map((m: any, idx) => (
              <div key={`${m.storagePath ?? m.url ?? "media"}-${idx}`} className="rounded-2xl border p-3 flex gap-3">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={withBust(m)} controls className="w-28 h-20 rounded-xl object-cover border" />

                <div className="flex-1">
                  <div className="text-xs text-gray-500">#{idx + 1}</div>

                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => downloadMedia(m)}>Download</button>

                    <button
                      className="rounded-lg border px-3 py-1 text-sm"
                      onClick={async () => {
                        const delStorage = confirm("Also delete from Firebase Storage?");
                        await deleteMedia("VID", idx, delStorage);
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button className="rounded-lg border px-3 py-1 text-sm" disabled={idx === 0} onClick={() => setVideos((prev) => move(prev, idx, idx - 1))}>↑</button>
                    <button className="rounded-lg border px-3 py-1 text-sm" disabled={idx === videos.length - 1} onClick={() => setVideos((prev) => move(prev, idx, idx + 1))}>↓</button>
                    <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => setVideos((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-500 mt-2">After changes, click <b>Save Media Order</b>.</div>
        </div>
      </div>

      {/* Reject */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
        <div className="text-lg font-semibold">Reject Listing</div>
        <div className="text-sm text-gray-600">Reason is shown to supplier.</div>
        <textarea
          className="w-full border rounded-xl p-3 min-h-[110px]"
          placeholder="e.g. Wrong type / unclear images / missing mukhi…"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <div className="flex justify-end">
          <button className="rounded-lg border px-4 py-2 hover:bg-gray-50" onClick={reject} disabled={busy}>
            Reject
          </button>
        </div>
      </div>
    </div>
  );

  async function downloadMedia(m: any) {
    const url = m?.url;
    if (!url) return alert("No download URL.");
    window.open(url, "_blank");
  }

  async function deleteMedia(kind: "IMG" | "VID", idx: number, deleteFromStorage: boolean) {
    if (!data?.gstNumber || !data?.skuId) return;

    setBusy(true);
    try {
      await removeRudrakshaSubmissionMediaItem({
        gstNumber: data.gstNumber,
        skuId: data.skuId,
        kind,
        index: idx,
        deleteFromStorage,
      });
      alert(deleteFromStorage ? "Removed + deleted from storage." : "Removed from submission.");
      await load();
    } finally {
      setBusy(false);
    }
  }
}
