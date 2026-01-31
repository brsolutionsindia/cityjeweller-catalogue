'use client';

import Link from 'next/link';
import { useEffect } from "react";
import { ensureAuthPersistence } from "@/lib/firebase/authPersistence";

export default function SupplierDashboardHome() {
  // ✅ Hooks must be INSIDE the component
  useEffect(() => {
    ensureAuthPersistence();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">Supplier Dashboard</h1>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/supplier/natural-diamonds" className="border rounded-xl p-5 hover:bg-gray-50">
          <div className="font-semibold">Natural Diamonds</div>
          <div className="text-sm text-gray-600 mt-1">Add / Edit / Delete / Share</div>
        </Link>

        <Link href="/supplier/yellow-sapphires" className="border rounded-xl p-5 hover:bg-gray-50">
          <div className="font-semibold">Yellow Sapphire</div>
          <div className="text-sm text-gray-600 mt-1">Photo-card form + media upload</div>
        </Link>
      </div>
    </main>
  );
}
