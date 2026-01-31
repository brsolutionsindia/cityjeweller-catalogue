"use client";

import { useEffect } from "react";
import { ensureAuthPersistence } from "@/lib/firebase/authPersistence";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    ensureAuthPersistence();
  }, []);

  return <>{children}</>;
}
