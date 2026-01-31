"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, db } from "./firebaseClient";

type SupplierSession = {
  user: User | null;
  uid: string | null;
  gst: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<SupplierSession | null>(null);

async function fetchSupplierGst(uid: string) {
  const snap = await get(ref(db, `User ID/${uid}/Shop GST`));
  const gst = (snap.val() || "").toString().trim();
  return gst || null;
}

export function SupplierProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [gst, setGst] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const uid = user?.uid ?? null;

  const refresh = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const g = await fetchSupplierGst(uid);
      setGst(g);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setGst(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const g = await fetchSupplierGst(u.uid);
        setGst(g);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({ user, uid, gst, loading, refresh }),
    [user, uid, gst, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupplierSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSupplierSession must be used inside SupplierProvider");
  return v;
}
