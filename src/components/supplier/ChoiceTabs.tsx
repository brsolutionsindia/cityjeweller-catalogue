"use client";

import React from "react";

export default function ChoiceTabs(props: {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { title, options, value, onChange } = props;

  return (
    <div className="space-y-2">
      <div className="font-semibold">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={[
                "px-3 py-2 rounded-xl border text-sm",
                active
                  ? "bg-blue-600 !text-white border-blue-600"
                  : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
              ].join(" ")}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
