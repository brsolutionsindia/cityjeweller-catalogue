"use client";

import Link from "next/link";
import { useSupplierSession } from "@/lib/firebase/supplierContext";
import { useEffect, useState } from "react";
import {
  getSupplierInboxGemstoneJewellery,
  markSupplierInboxItemAsRead,
} from "@/lib/firebase/gemstoneJewelleryAdminDb";

export default function SupplierGemstoneJewelleryInboxPage() {
  const session = useSupplierSession();
  const gst = session?.gst;

  const [inbox, setInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string>("");

  useEffect(() => {
    if (!gst) return;
    load();
  }, [gst]);

  async function load() {
    if (!gst) return;
    setLoading(true);
    try {
      const items = await getSupplierInboxGemstoneJewellery(gst);
      setInbox(items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function onMarkRead(skuId: string) {
    if (!gst) return;
    setActing(skuId);
    try {
      await markSupplierInboxItemAsRead(gst, skuId);
      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to mark as read");
    } finally {
      setActing("");
    }
  }

  if (!gst) {
    return <div className="p-6">Loading session…</div>;
  }

  if (loading) {
    return <div className="p-6">Loading inbox…</div>;
  }

  const unread = inbox.filter((item: any) => !item.inboxItem?.readAt).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <Link href="/supplier/gemstone-jewellery" className="text-sm underline">
          ← Back to Listings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Review Inbox</h1>
        <p className="text-sm text-gray-600 mt-1">
          Items that need your attention ({unread} unread)
        </p>
      </div>

      {inbox.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-600">No items in inbox</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inbox.map((item) => {
            const isUnread = !item.inboxItem?.readAt;
            return (
              <div
                key={item.skuId}
                className={`p-4 border rounded-lg ${
                  isUnread ? "bg-blue-50 border-blue-200" : "bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <strong className="text-lg">{item.itemName || item.skuId}</strong>
                      {isUnread && (
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                          Unread
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Admin's Request:</strong>
                    </p>
                    <p className="text-sm text-gray-600 mb-3 border-l-2 border-blue-400 pl-3">
                      {item.inboxItem?.reason ||
                        "Admin requested you review and resubmit this listing."}
                    </p>
                    <div className="flex gap-2">
                      <Link
                        href={`/supplier/gemstone-jewellery/${item.skuId}`}
                        className="px-3 py-2 bg-black text-white text-sm rounded"
                      >
                        Edit & Resubmit
                      </Link>
                      {isUnread && (
                        <button
                          onClick={() => onMarkRead(item.skuId)}
                          disabled={acting === item.skuId}
                          className="px-3 py-2 border text-sm rounded"
                        >
                          {acting === item.skuId ? "Marking…" : "Mark as Read"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {new Date(item.inboxItem?.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

