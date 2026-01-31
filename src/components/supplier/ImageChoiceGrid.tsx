"use client";

import React from "react";
import type { Choice } from "@/lib/yellowSapphire/options";

export default function ImageChoiceGrid(props: {
  title: string;
  options: Choice[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { title, options, value, onChange } = props;

  return (
    <div className="space-y-2">
      <div className="font-semibold">{title}</div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {options.map((opt) => {
          const active = value === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                "rounded-2xl border p-2 text-left transition hover:bg-gray-50",
                active ? "border-blue-600 ring-2 ring-blue-200" : "border-gray-200",
              ].join(" ")}
            >
              {/* ✅ Fixed aspect ratio tile + portrait-friendly rendering */}
              <div className="w-full aspect-[4/3] rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                {opt.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={opt.img}
                    alt={opt.label}
                    className="w-full h-full object-contain p-2"
                    loading="lazy"
                    onError={(e) => {
                      // safety: if any referenced png is missing, don't show broken icon
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="text-xs text-gray-500">No image</div>
                )}
              </div>

              <div className="mt-2 text-sm font-medium">{opt.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
