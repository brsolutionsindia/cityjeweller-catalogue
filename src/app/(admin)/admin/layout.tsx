import React from "react";
import AdminGate from "@/components/admin/AdminGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <div className="min-h-screen bg-slate-50">
        {children}
      </div>
    </AdminGate>
  );
}
