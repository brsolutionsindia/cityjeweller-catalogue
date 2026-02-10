"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getPendingRudrakshaQueue,
  listAllGlobalRudraksha,
  hideRudrakshaFromWebsite,
  unhideRudrakshaToWebsite,
  sendRudrakshaBackToSupplierReview,
} from "@/lib/firebase/rudrakshaAdminDb";

import { db } from "@/firebaseConfig";
import { get, ref as dbRef } from "firebase/database";

type QueueItem = {
  skuId: string;
  gstNumber: string;
  supplierUid: string;
  status: string;
  thumbUrl?: string;
  createdAt?: any;
  updatedAt?: any;
  reason?: string;
};

type GlobalItem = QueueItem & {
  productTitle?: string;
  media?: any[];
};

const SUBMISSION_NODE = (gstNumber: string) => `GST/${gstNumber}/Submissions/Rudraksha`;

const toNum = (v: any) => (typeof v === "number" ? v : Number(v || 0));
const up = (v: any) => String(v ?? "").trim().toUpperCase();
const isApprovedLike = (s: any) => !up(s) || up(s) === "APPROVED";
const isHidden = (s: any) => up(s) === "HIDDEN";

const NO_THUMB =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
      <rect width='100%' height='100%' fill='#eee'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#666' font-size='14'>
        No Thumb
      </text>
    </svg>`
  );

// ✅ Use media[] to compute cover thumbnail
function asKind(m: any): "IMG" | "VID" | "CERT" {
  if (m?.kind === "IMG" || m?.kind === "VID" || m?.kind === "CERT") return m.kind;
  if (m?.type === "video") return "VID";
  if (m?.type === "file") return "CERT";
  return "IMG";
}

function pickCoverUrlFromMedia(media: any[] | undefined): string {
  const arr = Array.isArray(media) ? media : [];
  const imgs = arr
    .map((m) => ({ ...m, kind: m?.kind || (m?.type === "video" ? "VID" : m?.type === "file" ? "CERT" : "IMG") }))
    .filter((m) => asKind(m) === "IMG")
    .sort((a, b) => (a?.order ?? 9999) - (b?.order ?? 9999));

  // prefer url; if your items store "downloadURL" or something else, add fallback here
  return imgs?.[0]?.url || imgs?.[0]?.downloadUrl || imgs?.[0]?.downloadURL || "";
}

type TabKey = "PENDING" | "VISIBLE" | "HIDDEN";

export default function Page() {
  const [pending, setPending] = useState<QueueItem[]>([]);
  const [globalAll, setGlobalAll] = useState<GlobalItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [actingSku, setActingSku] = useState<string>("");

  const visibleApproved = useMemo(() => globalAll.filter((x) => isApprovedLike(x.status)), [globalAll]);
  const hidden = useMemo(() => globalAll.filter((x) => isHidden(x.status)), [globalAll]);

  const list = useMemo(() => {
    const base = tab === "PENDING" ? pending : tab === "VISIBLE" ? visibleApproved : hidden;
    const s = q.trim().toLowerCase();
    if (!s) return base;
    return base.filter((it) =>
      [it.skuId, it.gstNumber, it.supplierUid, it.status].some((x) => (x || "").toLowerCase().includes(s))
    );
  }, [tab, pending, visibleApproved, hidden, q]);

  async function loadSubmissionThumb(gstNumber: string, skuId: string): Promise<string> {
    if (!gstNumber || !skuId) return "";
    const snap = await get(dbRef(db, `${SUBMISSION_NODE(gstNumber)}/${skuId}/media`));
    const media = snap.exists() ? (snap.val() as any[]) : [];
    return pickCoverUrlFromMedia(media);
  }

  async function reload() {
    setBusy(true);
    try {
      // -------------------- PENDING (AdminQueue) --------------------
      const obj = await getPendingRudrakshaQueue();

      const basePending = Object.entries(obj || {}).map(([skuIdKey, raw]) => {
        const it = (raw || {}) as Partial<QueueItem>;
        return {
          skuId: it.skuId || skuIdKey,
          gstNumber: it.gstNumber || "",
          supplierUid: it.supplierUid || "",
          status: it.status || "PENDING",
          thumbUrl: it.thumbUrl || "", // may be empty
          createdAt: it.createdAt,
          updatedAt: it.updatedAt,
          reason: (it as any).reason || "",
        } as QueueItem;
      });

      // ✅ IMPORTANT: queue doesn't contain media, so fetch thumbs from submission
      const pendingWithThumbs: QueueItem[] = await Promise.all(
        basePending.map(async (it) => {
          // If thumbUrl already stored, keep it; else pull from submission.media
          if (it.thumbUrl) return it;
          const thumb = await loadSubmissionThumb(it.gstNumber, it.skuId);
          return { ...it, thumbUrl: thumb || "" };
        })
      );

      pendingWithThumbs.sort(
        (a, b) => toNum(b.updatedAt) - toNum(a.updatedAt) || toNum(b.createdAt) - toNum(a.createdAt)
      );
      setPending(pendingWithThumbs);

      // -------------------- GLOBAL (Approved + Hidden) --------------------
      const g = await listAllGlobalRudraksha();

      const gArr: GlobalItem[] = (g || []).map((it: any) => {
        const media = Array.isArray(it?.media) ? it.media : [];
        const derivedThumb = pickCoverUrlFromMedia(media);
        return {
          skuId: it.skuId,
          gstNumber: it.gstNumber || "",
          supplierUid: it.supplierUid || "",
          status: it.status || "APPROVED",
          // ✅ use derived thumb from media if thumbUrl absent
          thumbUrl: it.thumbUrl || derivedThumb || "",
          createdAt: it.createdAt,
          updatedAt: it.updatedAt,
          productTitle: it.productTitle || "",
          media,
        };
      });

      gArr.sort((a, b) => toNum(b.updatedAt) - toNum(a.updatedAt) || toNum(b.createdAt) - toNum(a.createdAt));
      setGlobalAll(gArr);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await reload();
    })();
    return () => {
      alive = false;
    };
  }, []);

  const counts = {
    PENDING: pending.length,
    VISIBLE: visibleApproved.length,
    HIDDEN: hidden.length,
  };

  const adminUid = "ADMIN"; // TODO: replace with your auth context admin uid

  async function onHide(e: React.MouseEvent, skuId: string) {
    e.preventDefault();
    e.stopPropagation();
    setActingSku(skuId);
    try {
      await hideRudrakshaFromWebsite({ skuId, adminUid });
      await reload();
      setTab("HIDDEN");
    } finally {
      setActingSku("");
    }
  }

  async function onUnhide(e: React.MouseEvent, skuId: string) {
    e.preventDefault();
    e.stopPropagation();
    setActingSku(skuId);
    try {
      await unhideRudrakshaToWebsite({ skuId, adminUid });
      await reload();
      setTab("VISIBLE");
    } finally {
      setActingSku("");
    }
  }

  async function onSendBack(e: React.MouseEvent, it: QueueItem) {
    e.preventDefault();
    e.stopPropagation();

    const reason = window.prompt(
      "Reason to send back to supplier review:",
      "Please review and resubmit with corrections."
    );
    if (!reason) return;

    if (!it.gstNumber || !it.supplierUid) {
      alert("Missing gstNumber/supplierUid for this item. Cannot send back.");
      return;
    }

    setActingSku(it.skuId);
    try {
      await sendRudrakshaBackToSupplierReview({
        skuId: it.skuId,
        gstNumber: it.gstNumber,
        supplierUid: it.supplierUid,
        adminUid,
        reason,
      });
      await reload();
      setTab("PENDING");
    } finally {
      setActingSku("");
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm underline">
            ← Back to Admin
          </Link>
          <div className="text-2xl font-bold mt-1">Rudraksha Admin</div>
          <div className="text-xs text-gray-500 mt-1">
            {busy ? "Loading…" : `Pending: ${counts.PENDING} • Visible: ${counts.VISIBLE} • Hidden: ${counts.HIDDEN}`}
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <input
            className="border rounded-xl px-3 py-2 w-72"
            placeholder="Search by SKU / GST / Supplier UID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={reload} className="border rounded-xl px-3 py-2 text-sm hover:bg-slate-50">
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["PENDING", "VISIBLE", "HIDDEN"] as TabKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl border text-sm ${
              tab === k ? "bg-black text-white border-black" : "bg-white hover:bg-slate-50"
            }`}
          >
            {k === "PENDING" ? "Under Approval" : k === "VISIBLE" ? "Approved (Visible)" : "Approved (Hidden)"}
            <span className={`ml-2 ${tab === k ? "text-white" : "text-gray-500"}`}>({counts[k]})</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {busy && <div className="text-sm text-gray-500">Loading…</div>}

        <div className="grid md:grid-cols-2 gap-3">
          {list.map((it) => (
            <Link
              key={`${tab}-${it.skuId}`}
              href={`/admin/rudraksha/${encodeURIComponent(it.skuId)}`}
              className="rounded-2xl border p-4 flex gap-4 hover:bg-slate-50"
            >
              <div className="w-24 h-24 rounded-xl border overflow-hidden bg-gray-50 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumbUrl || NO_THUMB} alt={it.skuId} className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{it.skuId}</div>
                {(it as any).productTitle ? (
                  <div className="text-xs text-gray-600 mt-1 truncate">{(it as any).productTitle}</div>
                ) : null}
                <div className="text-xs text-gray-600 mt-1">
                  GST: <b>{it.gstNumber}</b>
                </div>
                <div className="text-xs text-gray-600">
                  Supplier UID: <b>{it.supplierUid}</b>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Status: <b>{it.status}</b>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {tab === "VISIBLE" && (
                    <button
                      onClick={(e) => onHide(e, it.skuId)}
                      className="px-3 py-1 rounded-lg border text-xs hover:bg-white bg-slate-100"
                      disabled={actingSku === it.skuId}
                      title="Hide from website (no supplier trigger)"
                    >
                      {actingSku === it.skuId ? "Hiding…" : "Hide"}
                    </button>
                  )}

                  {tab === "HIDDEN" && (
                    <button
                      onClick={(e) => onUnhide(e, it.skuId)}
                      className="px-3 py-1 rounded-lg border text-xs hover:bg-white bg-slate-100"
                      disabled={actingSku === it.skuId}
                      title="Make visible on website again (no supplier trigger)"
                    >
                      {actingSku === it.skuId ? "Unhiding…" : "Unhide"}
                    </button>
                  )}

                  {(tab === "VISIBLE" || tab === "HIDDEN") && (
                    <button
                      onClick={(e) => onSendBack(e, it)}
                      className="px-3 py-1 rounded-lg border text-xs hover:bg-white bg-amber-50"
                      disabled={actingSku === it.skuId}
                      title="Send back to supplier review (triggers supplier)"
                    >
                      {actingSku === it.skuId ? "Sending…" : "Send to Supplier Review"}
                    </button>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!busy && list.length === 0 && (
          <div className="text-sm text-gray-600">
            {tab === "PENDING"
              ? "No pending rudraksha submissions."
              : tab === "VISIBLE"
              ? "No approved visible rudraksha."
              : "No hidden rudraksha."}
          </div>
        )}
      </div>
    </div>
  );
}
