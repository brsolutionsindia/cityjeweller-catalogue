'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SupplierProvider, useSupplierSession } from '@/lib/firebase/supplierContext';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebaseConfig';

function Shell({ children }: { children: React.ReactNode }) {
  const { uid, gst, loading } = useSupplierSession();
  const router = useRouter();

  if (loading) return <div className="p-6">Loading...</div>;
  if (!uid) return <div className="p-6">Please login.</div>;

  const onLogout = async () => {
    try {
      await signOut(auth);
    } finally {
      router.replace('/supplier/login');
    }
  };

  return (
    <div>
      {/* Top bar */}
      <div className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">GST: {gst ?? '...'}</div>

          <div className="flex items-center gap-3 text-sm">
            <Link className="underline" href="/supplier/dashboard">Home</Link>
            <Link className="underline" href="/supplier/natural-diamonds">Natural Diamonds</Link>
            <Link className="underline" href="/supplier/yellow-sapphires">Yellow Sapphire</Link>

            {/* ✅ Logout */}
            <button
              type="button"
              onClick={onLogout}
              className="ml-2 inline-flex items-center justify-center rounded-lg bg-black px-3 py-1.5 font-medium !text-white hover:bg-zinc-900"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">{children}</div>
    </div>
  );
}

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupplierProvider>
      <Shell>{children}</Shell>
    </SupplierProvider>
  );
}
