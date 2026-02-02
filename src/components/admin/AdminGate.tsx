"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebaseConfig";
import { isAdminUid } from "@/lib/auth/admin";
import LogoutButton from "@/components/auth/LogoutButton";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const isAdmin = useMemo(() => isAdminUid(uid), [uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid || null);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) return <div className="p-6">Checking admin access…</div>;

  if (!uid) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-lg font-semibold">Admin login required</div>
        <Link href="/login" className="inline-flex border px-4 py-2 rounded-lg">
          Go to Login
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 space-y-3">
        <div>
          <div className="text-lg font-semibold">Access denied</div>
          <div className="text-sm text-gray-600">
            This UID is not authorized for admin dashboard.
          </div>
          <div className="text-xs text-gray-500 mt-2">UID: {uid}</div>
        </div>

        <div className="flex gap-2">
          <LogoutButton />
          <Link
            href="/supplier/dashboard"
            className="border px-4 py-2 rounded-lg text-sm"
          >
            Supplier Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
