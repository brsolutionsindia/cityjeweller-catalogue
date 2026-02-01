'use client';

import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import { useParams } from "next/navigation";

type TeamData = {
  name?: string;
  photoUrl?: string;
  title?: string;
  city?: string;
  isAuthorized?: boolean;
  phone?: string;
  region?: string;
};

function toDirectDriveUrl(url: string): string {
  if (!url) return url;

  // Fallback only for old Google Drive links
  if (url.includes('drive.google.com') && url.includes('/file/d/')) {
    const match = url.match(/\/d\/([^/]+)\//);
    if (match) {
      const fileId = match[1];
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400-h400`;
    }
  }
  return url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function TeamPage() {
  const params = useParams(); // ✅ safest for client component
  const rawSlug = params?.slug;

const slug =
  typeof rawSlug === "string"
    ? rawSlug
    : Array.isArray(rawSlug)
    ? rawSlug[0]
    : "";

  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const slugLower =
          Array.isArray(slug) ? String(slug[0]).toLowerCase() : String(slug || "").toLowerCase();

        console.log("slugLower =", slugLower);

        if (!slugLower) {
          setData(null);
          return;
        }

        // ✅ read direct
        const snap = await get(ref(db, `/Teams/${slugLower}`));

        console.log("snap.exists =", snap.exists());

        if (!snap.exists()) {
          setData(null);
          return;
        }

        const value = snap.val() as TeamData | string;
        console.log("raw value =", value);

        let teamData: TeamData;

        if (typeof value === "string") {
          const url = toDirectDriveUrl(value.trim());
          teamData = {
            name: slugLower,
            photoUrl: url,
            title: "Authorized Consultant",
            isAuthorized: true,
          };
        } else {
          const rawUrl = typeof value.photoUrl === "string" ? value.photoUrl.trim() : "";
          const finalUrl = rawUrl ? toDirectDriveUrl(rawUrl) : undefined;

          teamData = {
            ...value,
            name: value.name || slugLower,
            photoUrl: finalUrl,
          };
        }

        console.log("final teamData =", teamData);
        setData(teamData);
      } catch (err) {
        console.error("Error fetching team data", err); // <-- THIS will reveal permission denied etc.
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <p>Loading consultant profile…</p>
      </main>
    );
  }

  if (!data || !data.photoUrl) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">
            Invalid or inactive consultant ID
          </h1>
          <p>Please contact CityJeweller.in for verification.</p>
        </div>
      </main>
    );
  }

  const isActive = data.isAuthorized !== false; // default true

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-200">
      {/* ID card */}
      <div
        className="w-[320px] sm:w-[360px] rounded-3xl shadow-2xl text-center overflow-hidden border"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#facc15',
          color: '#000000',
        }}
      >
        {/* Top logo / brand area */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between text-xs tracking-wide">
          <span className="font-serif" style={{ color: '#000000' }}>
            CityJeweller.in
          </span>
          <span className="font-serif" style={{ color: '#000000' }}>
            Authorized ID
          </span>
        </div>

        {/* Big heading */}
        <div className="px-5 pb-4">
          <p
            className="text-[18px] sm:text-[20px] font-semibold tracking-[0.18em] leading-snug"
            style={{ color: '#000000' }}
          >
            AUTHORIZED
            <br />
            CONSULTANT
          </p>
        </div>

        {/* Portrait block (cream background) */}
        <div
          className="mx-5 mb-5 rounded-2xl pt-4 pb-5 px-4 shadow-inner"
          style={{ backgroundColor: '#fef3c7' }}
        >
          {/* Portrait photo */}
          <div
            className="w-32 h-40 mx-auto mb-3 rounded-2xl overflow-hidden border"
            style={{
              backgroundColor: '#ffffff',
              borderColor: '#facc15',
            }}
          >
            <img
              src={data.photoUrl}
              alt={data.name || slug}
              className="w-full h-full object-cover"
              onError={() =>
                console.error('Image failed to load', data.photoUrl)
              }
            />
          </div>

          {/* Name / phone / region */}
          <h1
            className="text-lg font-semibold mb-1"
            style={{ color: '#000000' }}
          >
            {data.name || slug}
          </h1>

          {data.phone && (
            <p
              className="text-sm font-medium mb-0.5"
              style={{ color: '#000000' }}
            >
              {data.phone}
            </p>
          )}

          {data.region && (
            <p className="text-sm" style={{ color: '#000000' }}>
              Region: {data.region}
            </p>
          )}
        </div>

        {/* Status badge */}
        <div className="pb-2">
          {isActive ? (
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: '#bbf7d0',
                color: '#065f46',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#10b981' }}
              />
              Verified Authorized Consultant
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: '#000000',
                color: '#FFFFFF',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#000000' }}
              />
              ID Not Active
            </div>
          )}
        </div>

        {/* Footer line */}
        <div
          className="px-6 pb-4 pt-2 text-[11px] leading-relaxed"
          style={{ color: '#000000' }}
        >
          This page is hosted on CityJeweller.in and confirms the identity of the
          consultant whose ID card you scanned. For any doubt, you may contact
          our support team via the official website.
        </div>

        {/* Website footer */}
        <div
          className="py-2 text-[12px] font-serif tracking-[0.18em] uppercase"
          style={{
            backgroundColor: '#fef3c7',
            color: '#000000',
          }}
        >
          cityjeweller.in
        </div>
      </div>
    </main>
  );
}
