"use client";

import React from "react";
import type { RudrakshaSubmission } from "@/lib/rudraksha/types";

export default function RudrakshaReadOnly({ value }: { value: RudrakshaSubmission }) {
  // show only fields you want admins to see (no MediaUploader)
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Title" value={value.productTitle || "-"} />
        <Field label="SKU" value={value.skuId || "-"} />
        <Field label="Status" value={value.status || "-"} />
        <Field label="Mukhi" value={(value as any).mukhiType || "-"} />
        <Field label="Category" value={(value as any).productCategory || "-"} />
        <Field label="Tags" value={(value.tags || []).join(", ") || "-"} />
      </div>

      <div>
        <div className="text-sm font-medium text-gray-700 mb-1">Description</div>
        <div className="rounded-lg border bg-white p-3 text-sm text-gray-800 whitespace-pre-wrap">
          {(value as any).description || "-"}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}
