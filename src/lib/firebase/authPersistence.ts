// src/lib/firebase/authPersistence.ts
"use client";

import { auth } from "@/firebaseConfig";
import { setPersistence, browserLocalPersistence } from "firebase/auth";

let done = false;

export async function ensureAuthPersistence() {
  if (done) return;
  done = true;

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    console.error("Auth persistence failed", e);
  }
}
