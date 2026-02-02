"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";
import { getPendingYellowSapphireQueue } from "@/lib/firebase/yellowSapphireAdminDb";

export default function Page() {
  const [ysPending, setYsPending] = useState<number>(0);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const run = async () => {
      setBusy(true);
      try {
        const q = await getPendingYellowSapphireQueue();
        setYsPending(Object.keys(q || {}).length);
      } finally {
        setBusy(false);
      }
    };
    run();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
  <div>
    <div className="text-sm text-gray-500">Admin</div>
    <div className="text-2xl font-bold">Approvals Dashboard</div>
    <div className="text-xs text-gray-500 mt-1">
      {busy ? "Loading counts…" : "Live from AdminQueue"}
    </div>
  </div>

  {/* ✅ Logout button */}
  <LogoutButton />
</div>


      <div className="grid md:grid-cols-3 gap-4">
        {/* Yellow Sapphire */}
        <Link
          href="/admin/yellow-sapphires"
          className="rounded-2xl border bg-white p-5 shadow-sm hover:shadow transition"
        >
          <div className="text-sm text-gray-500">Category</div>
          <div className="text-xl font-semibold mt-1">Yellow Sapphires</div>
          <div className="mt-3 text-sm">
            Pending:{" "}
            <span className="font-bold">{ysPending}</span>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Review media, set margin, approve/reject.
          </div>
        </Link>

        {/* Diamonds (placeholder) */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm opacity-60">
          <div className="text-sm text-gray-500">Category</div>
          <div className="text-xl font-semibold mt-1">Diamonds</div>
          <div className="mt-3 text-sm">Pending: <span className="font-bold">—</span></div>
          <div className="mt-3 text-xs text-gray-500">Coming next.</div>
        </div>

        {/* Others (placeholder) */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm opacity-60">
          <div className="text-sm text-gray-500">Category</div>
          <div className="text-xl font-semibold mt-1">Others</div>
          <div className="mt-3 text-sm">Pending: <span className="font-bold">—</span></div>
          <div className="mt-3 text-xs text-gray-500">Coming next.</div>
        </div>
      </div>
    </div>
  );
}
