"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebaseConfig";
import { isAdminUid } from "@/lib/auth/admin";

export default function RequireSupplier({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/login");
        return;
      }
      if (isAdminUid(u.uid)) {
        router.replace("/admin/dashboard");
        return;
      }
      setOk(true);
    });

    return () => unsub();
  }, [router]);

  if (!ok) return <div className="p-6">Checking access...</div>;

  return <>{children ?? null}</>;
}
