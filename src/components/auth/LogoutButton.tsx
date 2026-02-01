"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/firebaseConfig";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded-lg border px-4 py-2 hover:bg-gray-50"
      onClick={async () => {
        await signOut(auth);
        router.push("/login");
      }}
      type="button"
    >
      Logout
    </button>
  );
}
