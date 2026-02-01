"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebaseConfig";
import { isAdminUid } from "@/lib/auth/admin";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) return router.replace("/login");
      if (!isAdminUid(u.uid)) return router.replace("/supplier/dashboard");
      setOk(true);
    });
    return () => unsub();
  }, [router]);

  if (!ok) return <div className="p-6">Checking admin access...</div>;
  return <>{children}</>;
}
