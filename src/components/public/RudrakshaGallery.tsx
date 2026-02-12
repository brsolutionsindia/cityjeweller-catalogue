//src/components/public/RudrakshaGallery.tsx
"use client";

import { useMemo, useState } from "react";

function asKind(m: any): "IMG" | "VID" {
  if (m?.kind === "IMG" || m?.kind === "VID") return m.kind;
  if (m?.type === "video") return "VID";
  return "IMG";
}

export default function RudrakshaGallery({ media }: { media: any[] | undefined }) {
  const list = useMemo(() => {
    const arr = Array.isArray(media) ? media : [];
    return arr
      .map((m) => ({ ...m, kind: asKind(m), order: m?.order ?? 9999 }))
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  }, [media]);

  const [idx, setIdx] = useState(0);
  const cur = list[idx];

  if (!list.length) return <div className="rounded-2xl border bg-gray-50 aspect-square flex items-center justify-center text-gray-400">No media</div>;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border overflow-hidden bg-black/5 aspect-square">
        {cur.kind === "VID" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={cur.url} controls className="w-full h-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cur.url} alt="media" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="flex gap-2 overflow-auto">
        {list.map((m, i) => (
          <button
            key={`${m.storagePath || m.url}-${i}`}
            onClick={() => setIdx(i)}
            className={"h-16 w-16 rounded-xl border overflow-hidden flex-shrink-0 " + (i === idx ? "ring-2 ring-black" : "")}
            type="button"
          >
            {m.kind === "VID" ? (
              <div className="w-full h-full bg-black/5 flex items-center justify-center text-xs">VIDEO</div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="thumb" className="w-full h-full object-cover" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
