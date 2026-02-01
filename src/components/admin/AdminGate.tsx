"use client";

import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/firebaseClient";

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || "";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const isAdmin = useMemo(() => !!uid && !!ADMIN_UID && uid === ADMIN_UID, [uid]);

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
      <div className="p-6 space-y-2">
        <div className="text-lg font-semibold">Admin login required</div>
        <div className="text-sm text-gray-600">Please login with the admin account.</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 space-y-2">
        <div className="text-lg font-semibold">Access denied</div>
        <div className="text-sm text-gray-600">
          This UID is not authorized for admin dashboard.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
