'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ref, get, onValue } from 'firebase/database';
import { db } from '@/firebaseConfig';

import PageLayout from '@/app/components/PageLayout';
import OfferBar from '@/app/components/OfferBar';
import OfferBarSilver from '@/app/components/OfferBarSilver';
import SkuSummaryModal from '@/app/components/SkuSummaryModal';

type RawSkuData = {
  remarks?: string;
  goldPurety?: string;
  jwelleryCategoryOther?: string;
};

// --- Helper: extract URL from plain string or Excel HYPERLINK("...") ---
const extractUrl = (val: unknown): string => {
  if (!val) return '';
  const str = String(val).trim();
  const match = str.match(/HYPERLINK\("(.+?)"/);
  if (match?.[1]) return match[1];
  if (str.startsWith('http')) return str;
  return '';
};

export default function CatalogSkuPage() {
  const router = useRouter();
  const params = useParams();
const skuIdParam = (params as { skuId?: string } | null)?.skuId;

if (!skuIdParam) {
  return (
    <PageLayout>
      <OfferBar goldRate="Loading..." rateDate="" />
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
        <p>Invalid product URL.</p>
      </section>
    </PageLayout>
  );
}

const decodedSkuId = decodeURIComponent(skuIdParam);


  const [rateDate, setRateDate] = useState('');
  const [goldRate, setGoldRate] = useState('Loading...');
  const [silverRate, setSilverRate] = useState('Loading...');

  const [exists, setExists] = useState<boolean | null>(null);
  const [skuData, setSkuData] = useState<RawSkuData | null>(null);

  // Diamond video section
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);

  // Detect “silver” / “diamond” from SKU data
  const remarksLower = useMemo(() => (skuData?.remarks || '').toLowerCase(), [skuData]);
  const isSilver = useMemo(() => remarksLower.includes('sil') || remarksLower.includes('silver'), [remarksLower]);
  const isDiamond = useMemo(() => remarksLower.includes('diamond'), [remarksLower]);

  // --- Load rates/date (gold + silver + date) ---
  useEffect(() => {
    const goldRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const silverRef = ref(db, 'Global SKU/Rates/Silver');
    const dateRef = ref(db, 'Global SKU/Rates/Date');

    const unsubGold = onValue(goldRef, (s) => setGoldRate(s.val()));
    const unsubSilver = onValue(silverRef, (s) => setSilverRate(s.val()));
    const unsubDate = onValue(dateRef, (s) => setRateDate(s.val()));

    return () => {
      unsubGold();
      unsubSilver();
      unsubDate();
    };
  }, []);

  // --- Load SKU record (existence + data) ---
  useEffect(() => {
    (async () => {
      const snap = await get(ref(db, `Global SKU/SKU/${decodedSkuId}`));
      const ok = snap.exists();
      setExists(ok);
      setSkuData(ok ? (snap.val() as RawSkuData) : null);
    })();
  }, [decodedSkuId]);

  // --- Load diamond video (only if diamond) ---
  useEffect(() => {
    if (!exists) return;

    if (!isDiamond) {
      setVideoUrl(null);
      setVideoMessage(null);
      setVideoLoading(false);
      return;
    }

    (async () => {
      setVideoLoading(true);
      setVideoUrl(null);
      setVideoMessage(null);

      try {
        const videoRef = ref(db, `Global SKU/NaturalDiamonds/${decodedSkuId}/Video`);
        const snap = await get(videoRef);

        if (!snap.exists()) {
          setVideoMessage('Enquire Now to get Video');
        } else {
          const url = extractUrl(snap.val());
          if (url) setVideoUrl(url);
          else setVideoMessage('Enquire Now to get Video');
        }
      } catch (e) {
        console.error('Video load error:', e);
        setVideoMessage('Enquire Now to get Video');
      } finally {
        setVideoLoading(false);
      }
    })();
  }, [decodedSkuId, exists, isDiamond]);

  return (
    <PageLayout>
      {/* Offer bar */}
      {isSilver ? (
        <OfferBarSilver silverRate={silverRate} rateDate={rateDate} />
      ) : (
        <OfferBar goldRate={goldRate} rateDate={rateDate} />
      )}

      {/* Modern product page shell */}
      <section
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 12px 28px',
        }}
      >
        {/* Breadcrumb + actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => router.back()}
              style={{
                border: '1px solid rgba(0,0,0,0.12)',
                background: '#fff',
                borderRadius: 10,
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ← Back
            </button>

            <div style={{ color: 'rgba(0,0,0,0.65)', fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>Catalog</span>
              <span style={{ margin: '0 8px' }}>›</span>
              <span style={{ fontWeight: 700, color: 'rgba(0,0,0,0.9)' }}>{decodedSkuId}</span>
              {isSilver && (
                <span
                  style={{
                    marginLeft: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,0.06)',
                    color: 'rgba(0,0,0,0.75)',
                  }}
                >
                  Silver
                </span>
              )}
              {isDiamond && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,0.06)',
                    color: 'rgba(0,0,0,0.75)',
                  }}
                >
                  Diamond
                </span>
              )}
            </div>
          </div>

          {/* Right side quick actions */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                const url = window.location.href;
                if (navigator.share) {
                  navigator.share({ title: decodedSkuId, url }).catch(() => {});
                } else {
                  navigator.clipboard?.writeText(url);
                  alert('Link copied');
                }
              }}
              style={{
                border: '1px solid rgba(0,0,0,0.12)',
                background: '#fff',
                borderRadius: 10,
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Share
            </button>

            <button
              type="button"
              onClick={() => {
                const msg = `I am interested in Product ID ${decodedSkuId}. Please share details.`;
                window.open(`https://wa.me/919023130944?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              style={{
                border: 'none',
                background: '#25D366',
                color: '#fff',
                borderRadius: 10,
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 800,
              }}
            >
              WhatsApp
            </button>
          </div>
        </div>

        {/* Error / content */}
        {exists === false ? (
          <div
            style={{
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 16,
              background: '#fff',
              padding: 18,
            }}
          >
            <h2 style={{ margin: 0, marginBottom: 6 }}>Product not found</h2>
            <p style={{ margin: 0, color: 'rgba(0,0,0,0.7)' }}>SKU: {decodedSkuId}</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 360px',
              gap: 16,
            }}
          >
            {/* Left: Primary content (your existing detail UI) */}
            <div
              style={{
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 18,
                background: '#fff',
                overflow: 'hidden',
              }}
            >
              {/* Header strip like modern PDP */}
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)', fontWeight: 700 }}>
                    Product ID
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.2 }}>
                    {decodedSkuId}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', fontWeight: 700 }}>
                    Rate Date
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(0,0,0,0.85)' }}>
                    {rateDate || '—'}
                  </div>
                </div>
              </div>

              {/* ✅ Keep ALL existing detail: your SkuSummaryModal */}
              <div style={{ padding: 10 }}>
                <SkuSummaryModal skuId={decodedSkuId} onClose={() => router.back()} fullPage />
              </div>
            </div>

            {/* Right: Sticky purchase panel (modern e-commerce) */}
            <aside
              style={{
                position: 'sticky',
                top: 12,
                alignSelf: 'start',
              }}
            >
              <div
                style={{
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 18,
                  background: '#fff',
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>
                  Quick Actions
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const msg = `I am interested in Product ID ${decodedSkuId}. Please share best offer price and details.`;
                      window.open(`https://wa.me/919023130944?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: '#111',
                      color: '#fff',
                      borderRadius: 12,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontWeight: 900,
                    }}
                  >
                    Get Best Price on WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const url = window.location.href;
                      navigator.clipboard?.writeText(url);
                      alert('Link copied');
                    }}
                    style={{
                      width: '100%',
                      border: '1px solid rgba(0,0,0,0.12)',
                      background: '#fff',
                      color: '#111',
                      borderRadius: 12,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontWeight: 800,
                    }}
                  >
                    Copy Share Link
                  </button>
                </div>

                {/* Product meta */}
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    display: 'grid',
                    gap: 8,
                    fontSize: 13,
                    color: 'rgba(0,0,0,0.75)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontWeight: 700 }}>Category</span>
                    <span style={{ textAlign: 'right' }}>
                      {skuData?.jwelleryCategoryOther ? skuData.jwelleryCategoryOther : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontWeight: 700 }}>Purity</span>
                    <span style={{ textAlign: 'right' }}>
                      {skuData?.goldPurety ? skuData.goldPurety : '—'}
                    </span>
                  </div>
                </div>

                {/* Trust strip */}
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 14,
                    background: 'rgba(0,0,0,0.04)',
                    padding: 12,
                    display: 'grid',
                    gap: 6,
                    fontSize: 12.5,
                    color: 'rgba(0,0,0,0.75)',
                  }}
                >
                  <div style={{ fontWeight: 900, color: 'rgba(0,0,0,0.85)' }}>Why CityJeweller</div>
                  <div>• Transparent pricing based on live gold & silver rates</div>
                  <div>• Certified diamonds & BIS-hallmarked gold</div>
                  <div>• Direct WhatsApp support for quotes & availability</div>
                </div>
              </div>

              {/* ✅ Diamond-only: video section (embedded) — KEEP EXISTING DETAIL */}
              {isDiamond && (
                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 18,
                    padding: 12,
                    background: '#000',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Video Preview (if available)</div>

                  {videoLoading ? (
                    <p style={{ textAlign: 'center', padding: '0.75rem' }}>Loading video...</p>
                  ) : videoUrl ? (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                      <iframe
                        src={videoUrl}
                        title={`Diamond Video ${decodedSkuId}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          borderRadius: 12,
                        }}
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '0.75rem' }}>
                      <p style={{ marginBottom: '0.75rem', fontSize: 13 }}>
                        {videoMessage || 'Enquire Now to get Video'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const msg = `I am interested in your Product ID ${decodedSkuId}. Please share the video link.`;
                          window.open(
                            `https://wa.me/919023130944?text=${encodeURIComponent(msg)}`,
                            '_blank'
                          );
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#25D366',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 10,
                          cursor: 'pointer',
                          fontWeight: 900,
                          width: '100%',
                        }}
                      >
                        Enquire on WhatsApp
                      </button>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        )}

        {/* Responsive fallback for small screens */}
        <style jsx>{`
          @media (max-width: 980px) {
            section :global(.pdpGrid) {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </section>
    </PageLayout>
  );
}
