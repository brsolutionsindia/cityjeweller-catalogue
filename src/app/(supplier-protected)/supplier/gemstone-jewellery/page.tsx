"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import { db } from "@/firebaseConfig";
import { get, ref as dbRef } from "firebase/database";
import type { GemstoneJewellerySubmission } from "@/lib/gemstoneJewellery/types";
import { deleteGemstoneJewellerySubmission } from "@/lib/firebase/gemstoneJewelleryDb";


const WHATSAPP_NUMBER = "919023130944"; // your number

const SUBMISSION_NODE = (gst: string) => `GST/${gst}/Submissions/GemstoneJewellery`;
const SUPPLIER_INDEX = (gst: string, uid: string) =>
  `GST/${gst}/Indexes/GemstoneJewellerySubmissions/BySupplier/${uid}`;

const SORTS = [
  { key: "new", label: "Newest" },
  { key: "plh", label: "Price: Low → High" },
  { key: "phl", label: "Price: High → Low" },
] as const;

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}
function toNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function money(n: number | null) {
  if (n === null) return "-";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
function formatWhen(ts?: number) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}
function asKind(m: any): "IMG" | "VID" {
  if (m?.kind === "IMG" || m?.kind === "VID") return m.kind;
  if (m?.type === "video") return "VID";
  return "IMG";
}
function getThumb(s: GemstoneJewellerySubmission) {
  const imgs = (s.media || [])
    .filter((m: any) => asKind(m) === "IMG")
    .sort((a: any, b: any) => (a?.order ?? 9999) - (b?.order ?? 9999));
  return (imgs?.[0] as any)?.url || "";
}

// Supplier price only (no admin margin, no website price)
function isWeightMode(pm: any) {
  const x = String(pm || "").toUpperCase();
  return x === "WEIGHT" || x === "PRICE_PER_WEIGHT" || x === "RATE_PER_WEIGHT";
}
function pickSupplierPrice(s: any): number | null {
  const pm = String(s?.priceMode || "MRP");
  if (isWeightMode(pm)) {
    const rate = toNum(s?.ratePerGm);
    const w = toNum(s?.weightGm);
    if (rate > 0 && w > 0) return Math.round(rate * w);
    return null;
  }
  const offer = toNum(s?.offerPrice);
  const mrp = toNum(s?.mrp);
  if (offer > 0) return offer;
  if (mrp > 0) return mrp;
  return null;
}

async function confirmShareMode(): Promise<{ includePrices: boolean } | null> {
  const include = window.confirm("Include supplier prices in PDF?\n\nOK = Yes (with prices)\nCancel = No (without prices)");
  return { includePrices: include };
}

async function generatePdfForListings(params: {
  items: GemstoneJewellerySubmission[];
  includePrices: boolean;
}) {
  const { items, includePrices } = params;
  const { jsPDF } = await import("jspdf");

  async function blobToDataUrl(blob: Blob): Promise<string> {
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async function imageUrlToJpegDataUrl(url: string): Promise<string | null> {
    try {
      // 1) fetch the image as blob (CORS must allow)
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();

      // If already jpeg, return as-is
      if (blob.type === "image/jpeg") {
        return await blobToDataUrl(blob);
      }

      // If png, jsPDF supports PNG too, but we standardize to JPEG for consistency
      // For webp, conversion is mandatory for most jsPDF builds.
      const imgUrl = URL.createObjectURL(blob);

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Canvas not supported"));
            ctx.drawImage(img, 0, 0);
            // convert to jpeg
            resolve(canvas.toDataURL("image/jpeg", 0.9));
          } catch (e) {
            reject(e);
          } finally {
            URL.revokeObjectURL(imgUrl);
          }
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(imgUrl);
          reject(e);
        };
        img.src = imgUrl;
      });

      return dataUrl;
    } catch {
      return null;
    }
  }

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Header
  doc.setFontSize(16);
  doc.text("Gemstone Jewellery (Supplier Share)", 40, 46);
  doc.setFontSize(10);
  doc.text(`Date: ${dateStr}`, 40, 64);
  doc.text(`Items: ${items.length}`, 40, 80);

  // ✅ Grid config: 2 per row
  const cols = 2;
  const margin = 36;
  const gap = 16;

  const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const imgH = 170;
  const cardH = 260;

  let x = margin;
  let y = 100;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const thumb = getThumb(it);

    // new page if needed
    if (y + cardH > pageH - margin) {
      doc.addPage();
      x = margin;
      y = margin;
    }

    // card box
    doc.setDrawColor(220);
    doc.roundedRect(x, y, cardW, cardH, 12, 12);

    // image
    if (thumb) {
      const jpegDataUrl = await imageUrlToJpegDataUrl(thumb);
      if (jpegDataUrl) {
        try {
          doc.addImage(jpegDataUrl, "JPEG", x + 10, y + 10, cardW - 20, imgH);
        } catch {
          // ignore image failures
        }
      } else {
        doc.setFontSize(9);
        doc.setTextColor(140);
        doc.text("Image blocked (CORS) / not fetchable", x + 12, y + 30);
        doc.setTextColor(0);
      }
    } else {
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text("No Image", x + 12, y + 30);
      doc.setTextColor(0);
    }

    // SKU
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`SKU: ${it.skuId}`, x + 12, y + imgH + 32);

    // Name (wrap into 2 lines max)
    doc.setFontSize(9);
    const name = String(it.itemName || "").trim() || "Untitled";
    const lines = doc.splitTextToSize(name, cardW - 24);
    doc.text(lines.slice(0, 2), x + 12, y + imgH + 50);

    // Price (optional)
    if (includePrices) {
      const p = pickSupplierPrice(it);
      doc.setFontSize(10);
      doc.text(`Price: ${p !== null ? money(p) : "-"}`, x + 12, y + imgH + 92);
    }

    // advance
    const colIdx = (i + 1) % cols;
    if (colIdx === 0) {
      x = margin;
      y += cardH + gap;
    } else {
      x += cardW + gap;
    }
  }

  const blob = doc.output("blob");
  const fileName = `GemstoneJewellery_${dateStr.replaceAll(" ", "_")}.pdf`;
  return { blob, fileName };
}


async function sharePdfToWhatsapp(params: { blob: Blob; fileName: string }) {
  const { blob, fileName } = params;

  const file = new File([blob], fileName, { type: "application/pdf" });

  // Best: Web Share (mobile) -> WhatsApp shows file attach flow
  const navAny = navigator as any;
    if (navAny?.share && navAny?.canShare?.({ files: [file] })) {
      // MUST be called from a user gesture (our "Share now" click)
      await navAny.share({
        title: "Gemstone Jewellery",
        text: "Sharing selected gemstone jewellery items.",
        files: [file],
      });
      return;
    }


  // Desktop fallback: download + open WhatsApp with message (user attaches downloaded PDF)
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);

  const text = encodeURIComponent(
    `Sharing selected gemstone jewellery items.\n\nPlease find the PDF attached: ${fileName}`
  );
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank");
}

export default function SupplierGemstoneJewelleryHome() {
    // share flow (2-step to satisfy "user gesture" requirement for navigator.share)
const [filtersOpen, setFiltersOpen] = useState(false);
const [sortOpen, setSortOpen] = useState(false);

    const [shareReady, setShareReady] = useState<{ blob: Blob; fileName: string } | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [shareBusy, setShareBusy] = useState(false);

const session = useSupplierSession();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GemstoneJewellerySubmission[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // filters (same style as customer)
  const [q, setQ] = useState("");
  const [nature, setNature] = useState<string>("ALL");
  const [type, setType] = useState<string>("ALL");
  const [stoneOrLook, setStoneOrLook] = useState<string>("ALL");
  const [material, setMaterial] = useState<string>("ALL");
  const [tag, setTag] = useState<string>("ALL");
  const [minP, setMinP] = useState<string>("");
  const [maxP, setMaxP] = useState<string>("");

  const [sortKey, setSortKey] = useState<(typeof SORTS)[number]["key"]>("new");

  const gst = session?.gst;
  const uid = session?.uid;

  async function load() {
    if (!gst || !uid) return;

    setLoading(true);
    setErr(null);

    try {
      // 1) read index -> skuIds
      const idxSnap = await get(dbRef(db, SUPPLIER_INDEX(gst, uid)));
      const skuIds = idxSnap.exists() ? Object.keys(idxSnap.val() || {}) : [];

      if (!skuIds.length) {
        setItems([]);
        setSelected({});
        return;
      }

      // 2) read each submission (parallel)
      const results = await Promise.all(
        skuIds.map(async (skuId) => {
          const snap = await get(dbRef(db, `${SUBMISSION_NODE(gst)}/${skuId}`));
          return snap.exists() ? (snap.val() as GemstoneJewellerySubmission) : null;
        })
      );

      const cleaned = results
        .filter(Boolean)
        .map((x) => x as GemstoneJewellerySubmission)
        .filter((s) => !uid || s.supplierUid === uid);

      // newest first
      cleaned.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      setItems(cleaned);

      // keep selection only for still-existing
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const it of cleaned) if (prev[it.skuId]) next[it.skuId] = true;
        return next;
      });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!gst || !uid) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gst, uid]);

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((x) => x.status === "PENDING").length;
    const approved = items.filter((x) => x.status === "APPROVED").length;
    const draft = items.filter((x) => x.status === "DRAFT").length;
    const rejected = items.filter((x) => x.status === "REJECTED").length;
    return { total, pending, approved, draft, rejected };
  }, [items]);

  // filter meta
  const meta = useMemo(() => {
    const natures = uniq(items.map((x) => String(x.nature || "").toUpperCase()).filter(Boolean));
    const types = uniq(items.map((x) => String(x.type || "").toUpperCase()).filter(Boolean));
    const materials = uniq(items.map((x) => String((x as any).material || "").toUpperCase()).filter(Boolean));

    const stones = uniq(
      items
        .map((x) =>
          (String(x.nature || "").toUpperCase() === "ARTIFICIAL"
            ? String((x as any).lookName || "")
            : String((x as any).stoneName || "")
          ).toUpperCase()
        )
        .filter(Boolean)
    );

    const tags = uniq((items.flatMap((x) => (x.tags || []) as any[]) as any[]).map((t) => String(t).toLowerCase()));
    return { natures, types, materials, stones, tags };
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const min = minP ? Number(minP) : null;
    const max = maxP ? Number(maxP) : null;

    let arr = items.filter((it) => {
      const price = pickSupplierPrice(it);

      const text = `${it.skuId} ${it.itemName || ""} ${(it as any).stoneName || ""} ${(it as any).lookName || ""} ${(it as any).material || ""} ${(it as any).type || ""}`.toLowerCase();
      if (s && !text.includes(s)) return false;

      if (nature !== "ALL" && String(it.nature || "").toUpperCase() !== nature) return false;
      if (type !== "ALL" && String((it as any).type || "").toUpperCase() !== type) return false;

      if (stoneOrLook !== "ALL") {
        const v = String(
          (String(it.nature || "").toUpperCase() === "ARTIFICIAL" ? (it as any).lookName : (it as any).stoneName) || ""
        ).toUpperCase();
        if (v !== stoneOrLook) return false;
      }

      if (material !== "ALL" && String((it as any).material || "").toUpperCase() !== material) return false;

      if (tag !== "ALL") {
        const tags = (it.tags || []).map((t) => String(t).toLowerCase());
        if (!tags.includes(tag)) return false;
      }

      if (min !== null && price !== null && price < min) return false;
      if (max !== null && price !== null && price > max) return false;

      return true;
    });

    // sort
    if (sortKey === "plh") {
      arr = arr.sort((a, b) => toNum(pickSupplierPrice(a)) - toNum(pickSupplierPrice(b)));
    } else if (sortKey === "phl") {
      arr = arr.sort((a, b) => toNum(pickSupplierPrice(b)) - toNum(pickSupplierPrice(a)));
    } else {
      arr = arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0 || (b.createdAt || 0) - (a.createdAt || 0)));
    }

    return arr;
  }, [items, q, nature, type, stoneOrLook, material, tag, minP, maxP, sortKey]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );

  const allVisibleSelected = filtered.length > 0 && filtered.every((x) => selected[x.skuId]);
  const someVisibleSelected = filtered.some((x) => selected[x.skuId]);

  function toggleSelectAllVisible(next: boolean) {
    setSelected((prev) => {
      const out = { ...prev };
      for (const it of filtered) {
        if (next) out[it.skuId] = true;
        else delete out[it.skuId];
      }
      return out;
    });
  }

  async function onDeleteSelected() {
    if (!gst || !uid) return;
    if (!selectedIds.length) return;

    const ok = window.confirm(
      `Delete ${selectedIds.length} listing(s)?\n\n` +
      `• Draft/Pending/Rejected: will be deleted.\n` +
      `• Approved: will be UNLISTED from website and moved to Review (admin re-approval required).`
    );

    if (!ok) return;

    setLoading(true);
    try {
      for (const skuId of selectedIds) {
        await deleteGemstoneJewellerySubmission({
          gstNumber: gst,
          supplierUid: uid,
          skuId,
          deleteMedia: true,
        });
      }
      setSelected({});
      await load();
      alert("Deleted.");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

    async function onShareSelected() {
      if (!selectedIds.length) return;

      // Clear any previous prepared file
      setShareReady(null);
      setShareOpen(true);

      const cfg = await confirmShareMode();
      if (!cfg) {
        setShareOpen(false);
        return;
      }

      const chosen = items.filter((x) => selectedIds.includes(x.skuId));

      try {
        setShareBusy(true);

        // ✅ async work happens here (NOT inside the final share click)
        const { blob, fileName } = await generatePdfForListings({
          items: chosen,
          includePrices: cfg.includePrices,
        });

        // store for the "Share now" button (user gesture)
        setShareReady({ blob, fileName });
      } catch (e: any) {
        console.error(e);
        alert(e?.message || "Failed to generate PDF");
        setShareOpen(false);
      } finally {
        setShareBusy(false);
      }
    }

  async function onShareNowClick() {
    if (!shareReady) return;

    try {
      // ✅ This click is a user gesture: call share immediately
      await sharePdfToWhatsapp(shareReady);
      setShareOpen(false);
      setShareReady(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Share failed");
    }
  }

  function resetFilters() {
    setQ("");
    setNature("ALL");
    setType("ALL");
    setStoneOrLook("ALL");
    setMaterial("ALL");
    setTag("ALL");
    setMinP("");
    setMaxP("");
    setSortKey("new");
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Gemstone Jewellery</h1>

        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl border"
            disabled={loading || !gst || !uid}
            type="button"
          >
            Refresh
          </button>
          <Link
            href="/supplier/gemstone-jewellery/new"
            className="px-4 py-2 rounded-xl bg-black text-white"
          >
            + New Listing
          </Link>

          <Link
            href="/supplier/gemstone-jewellery/bulk-new"
            className="px-4 py-2 rounded-xl border"
          >
            Bulk Upload
          </Link>

        </div>
      </div>

      {/* stats */}
      <div className="rounded-2xl border p-4 flex flex-wrap gap-3 text-sm">
        <div>Total: <b>{stats.total}</b></div>
        <div>Draft: <b>{stats.draft}</b></div>
        <div>Pending: <b>{stats.pending}</b></div>
        <div>Approved: <b>{stats.approved}</b></div>
        <div>Rejected: <b>{stats.rejected}</b></div>
      </div>

      {/* filters (supplier same as customers) */}
      <div className="hidden md:block rounded-2xl border p-4 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Filters</div>
          <button className="text-xs underline text-gray-600" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <div className="text-xs text-gray-500 mb-1">Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="SKU / name / stone..."
            />
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Nature</div>
            <select value={nature} onChange={(e) => setNature(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.natures.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Type</div>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.types.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Stone / Look</div>
            <select value={stoneOrLook} onChange={(e) => setStoneOrLook(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.stones.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-1">
            <div className="text-xs text-gray-500 mb-1">Min</div>
            <input value={minP} onChange={(e) => setMinP(e.target.value)} className="w-full border rounded-xl px-3 py-2" placeholder="0" />
          </div>

          <div className="md:col-span-1">
            <div className="text-xs text-gray-500 mb-1">Max</div>
            <input value={maxP} onChange={(e) => setMaxP(e.target.value)} className="w-full border rounded-xl px-3 py-2" placeholder="50000" />
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Material</div>
            <select value={material} onChange={(e) => setMaterial(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.materials.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Tag</div>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-full border rounded-xl px-3 py-2">
              <option value="ALL">All</option>
              {meta.tags.map((x) => <option key={x} value={x}>#{x}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Sort</div>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} className="w-full border rounded-xl px-3 py-2">
              {SORTS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* bulk actions bar */}
      <div className="rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="text-sm text-gray-600">
          {loading ? "Loading…" : <>Showing <b>{filtered.length}</b> items • Selected <b>{selectedIds.length}</b></>}
        </div>

        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded-xl border"
            disabled={!selectedIds.length || loading}
            onClick={onShareSelected}
            type="button"
          >
            Share Listings (PDF)
          </button>
          <button
            className="px-4 py-2 rounded-xl border border-red-300 text-red-700 bg-red-50"
            disabled={!selectedIds.length || loading}
            onClick={onDeleteSelected}
            type="button"
          >
            Delete Listings
          </button>
        </div>
      </div>

      {/* Share Modal (2-step share to preserve user gesture) */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl border">
            <div className="text-lg font-semibold">Share Listings (PDF)</div>
            <div className="text-sm text-gray-600 mt-1">
              {shareBusy
                ? "Generating PDF… please wait."
                : shareReady
                ? "PDF is ready. Tap Share now."
                : "Preparing…"}
            </div>

            {shareReady && (
              <div className="mt-2 text-xs text-gray-500">
                File: <b>{shareReady.fileName}</b>
              </div>
            )}

            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border"
                onClick={() => {
                  setShareOpen(false);
                  setShareReady(null);
                }}
                disabled={shareBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
                disabled={!shareReady || shareBusy}
                onClick={() => {
                  // IMPORTANT: do not "await" before share; this click must trigger share directly
                  void onShareNowClick();
                }}
              >
                Share now
              </button>
            </div>
          </div>
        </div>
      )}



      {err && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-700">
          {err}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border p-4 text-gray-600">Loading listings…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border p-6 text-gray-600">
          No listings matched your filters. Try resetting filters.
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden bg-white">
          <div className="grid grid-cols-[44px_90px_1fr_120px_180px_140px] gap-0 px-4 py-3 text-xs font-semibold bg-gray-50 border-b">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                }}
                onChange={(e) => toggleSelectAllVisible(e.target.checked)}
              />
            </div>
            <div>Media</div>
            <div>Item</div>
            <div>Supplier Price</div>
            <div>Updated</div>
            <div className="text-right">Action</div>
          </div>

          {filtered.map((s) => {
            const thumb = getThumb(s);
            const price = pickSupplierPrice(s);

            return (
              <div
                key={s.skuId}
                className="grid grid-cols-[44px_90px_1fr_120px_180px_140px] gap-0 px-4 py-3 border-b last:border-b-0 items-center"
              >
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={!!selected[s.skuId]}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = { ...prev };
                        if (e.target.checked) next[s.skuId] = true;
                        else delete next[s.skuId];
                        return next;
                      })
                    }
                  />
                </div>

                <div>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={s.itemName || s.skuId}
                      className="h-14 w-14 rounded-xl object-cover border"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl border flex items-center justify-center text-xs text-gray-400">
                      No media
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.itemName || "(No item name)"}</div>
                  <div className="text-xs text-gray-500 truncate">{s.skuId}</div>
                  <div className="text-xs mt-1">
                    <span className="px-2 py-1 rounded-full border text-[11px]">
                      {s.status || "DRAFT"}
                    </span>
                  </div>
                </div>

                <div className="text-sm font-semibold">{money(price)}</div>

                <div className="text-sm text-gray-600">
                  {formatWhen((s.updatedAt as any) || (s.createdAt as any))}
                </div>

                <div className="text-right">
                  <Link
                    href={`/supplier/gemstone-jewellery/${encodeURIComponent(s.skuId)}`}
                    className="px-3 py-2 rounded-xl border inline-block text-sm"
                  >
                    View / Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

  {/* Mobile footer tabs */}
  <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-white">
    <div className="flex">
      <button
        type="button"
        className="flex-1 py-3 text-sm font-semibold"
        onClick={() => { setSortOpen(false); setFiltersOpen(true); }}
      >
        Filters
      </button>
      <button
        type="button"
        className="flex-1 py-3 text-sm font-semibold border-l"
        onClick={() => { setFiltersOpen(false); setSortOpen(true); }}
      >
        Sort
      </button>
    </div>
  </div>

  {/* add padding so list doesn't hide behind footer */}
  <div className="md:hidden h-14" />

  {/* Filters Sheet (mobile) */}
  {filtersOpen && (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 border shadow-xl max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Filters</div>
          <button className="text-sm underline" onClick={() => setFiltersOpen(false)}>Close</button>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full border rounded-xl px-3 py-2"
              placeholder="SKU / name / stone..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Nature</div>
              <select value={nature} onChange={(e) => setNature(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                <option value="ALL">All</option>
                {meta.natures.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Type</div>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                <option value="ALL">All</option>
                {meta.types.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Stone / Look</div>
              <select value={stoneOrLook} onChange={(e) => setStoneOrLook(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                <option value="ALL">All</option>
                {meta.stones.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Material</div>
              <select value={material} onChange={(e) => setMaterial(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                <option value="ALL">All</option>
                {meta.materials.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Min</div>
              <input value={minP} onChange={(e) => setMinP(e.target.value)} className="w-full border rounded-xl px-3 py-2" placeholder="0" />
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Max</div>
              <input value={maxP} onChange={(e) => setMaxP(e.target.value)} className="w-full border rounded-xl px-3 py-2" placeholder="50000" />
            </div>

            <div className="col-span-2">
              <div className="text-xs text-gray-500 mb-1">Tag</div>
              <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                <option value="ALL">All</option>
                {meta.tags.map((x) => <option key={x} value={x}>#{x}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button className="flex-1 px-4 py-2 rounded-xl border" onClick={resetFilters} type="button">
              Reset
            </button>
            <button className="flex-1 px-4 py-2 rounded-xl bg-black text-white" onClick={() => setFiltersOpen(false)} type="button">
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Sort Sheet (mobile) */}
  {sortOpen && (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 border shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Sort</div>
          <button className="text-sm underline" onClick={() => setSortOpen(false)}>Close</button>
        </div>

        <div className="mt-3">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            className="w-full border rounded-xl px-3 py-3"
          >
            {SORTS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>

          <button
            className="w-full mt-3 px-4 py-3 rounded-xl bg-black text-white"
            onClick={() => setSortOpen(false)}
            type="button"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )}

    </div>
  );
}
