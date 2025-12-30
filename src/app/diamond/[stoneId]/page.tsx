'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { db } from '@/firebaseConfig';

import PageLayout from '@/app/components/PageLayout';
import TrustInfoStrip from '@/app/components/TrustInfoStrip';
import shapeIcon from '../../../../assets/shapeIcons';
import Image from 'next/image';

import styles from './DiamondDetail.module.css';

type Diamond = {
  StoneId: string;
  Size?: string;
  SizeRange?: string;
  Clarity?: string;
  Color?: string;
  Cut?: string;
  Polish?: string;
  Symm?: string;
  Fluorescence?: string;
  Shape?: string;
  Status?: string;
  CertNo?: string;
  Certified?: string;
  VideoURL?: string;
  Video?: string;
  Measurement?: string;
  Depth?: string;
  Table?: string;
  MRP?: number;
  OfferPrice?: number;
};

type DiamondSource = 'lab' | 'natural';

type RawDiamond = Diamond & { 'Video URL'?: string };

const extractUrl = (val: unknown): string => {
  if (!val) return '';
  const str = String(val).trim();

  // Excel-style: HYPERLINK("https://...")
  const match = str.match(/HYPERLINK\("(.+?)"/i);
  if (match?.[1]) return match[1];

  // If it already contains http(s)
  if (str.startsWith('http://') || str.startsWith('https://')) return str;

  // If it starts with www, upgrade to https
  if (str.startsWith('www.')) return `https://${str}`;

  // If it looks like a URL but missing protocol (basic check)
  if (str.includes('.') && !str.includes(' ')) return `https://${str}`;

  return '';
};


export default function DiamondDetailPage() {
  const params = useParams<{ stoneId: string }>();
  const router = useRouter();
  const qp = useSearchParams();

  const stoneId = decodeURIComponent(params.stoneId || '');
  const hintedType = (qp.get('type') || '').toLowerCase() as DiamondSource | '';

  const [diamond, setDiamond] = useState<Diamond | null>(null);
  const [source, setSource] = useState<DiamondSource | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Fetch from Firebase: try hinted node first, then fallback ---
  useEffect(() => {
    let alive = true;

    const fetchDiamond = async () => {
      setLoading(true);
      setDiamond(null);
      setSource(null);

      const tryRead = async (node: string) => {
        const snap = await get(ref(db, node + '/' + stoneId));
        return snap.exists() ? (snap.val() as RawDiamond) : null;

      };

      try {
        // 1) try hinted type first (if provided)
        if (hintedType === 'lab') {
          const d = await tryRead('Global SKU/CVD');
          if (d && alive) {
            setDiamond(normalize(d));
            setSource('lab');
            setLoading(false);
            return;
          }
        }
        if (hintedType === 'natural') {
          const d = await tryRead('Global SKU/NaturalDiamonds');
          if (d && alive) {
            setDiamond(normalize(d));
            setSource('natural');
            setLoading(false);
            return;
          }
        }

        // 2) fallback auto-detect
        const lab = await tryRead('Global SKU/CVD');
        if (lab && alive) {
          setDiamond(normalize(lab));
          setSource('lab');
          setLoading(false);
          return;
        }

        const natural = await tryRead('Global SKU/NaturalDiamonds');
        if (natural && alive) {
          setDiamond(normalize(natural));
          setSource('natural');
          setLoading(false);
          return;
        }

        if (alive) {
          setDiamond(null);
          setSource(null);
          setLoading(false);
        }
      } catch (e) {
        if (alive) setLoading(false);
      }
    };

    fetchDiamond();
    return () => {
      alive = false;
    };
  }, [stoneId, hintedType]);

const normalize = (d: RawDiamond): Diamond => {
  const videoCandidate =
    d.VideoURL ??
    d.Video ??
    (d as any)['Video URL']; // IMPORTANT for Lab data

  return {
    ...d,
    StoneId: d.StoneId || stoneId,
    VideoURL: extractUrl(videoCandidate),
  };
};


  const title = useMemo(() => {
    if (!diamond) return 'Diamond Details';
    const c = Number.parseFloat(diamond.Size || '0').toFixed(2);
    const shape = diamond.Shape || '';
    const color = diamond.Color || '';
    const clarity = diamond.Clarity || '';
    return `${c}ct ${shape} • ${color} ${clarity} • ${diamond.StoneId}`;
  }, [diamond]);

  const price = useMemo(() => {
    if (!diamond) return { mrp: null as number | null, offer: null as number | null };
    return {
      mrp: diamond.MRP ?? null,
      offer: diamond.OfferPrice ?? null,
    };
  }, [diamond]);

  const waMsg = useMemo(() => {
    if (!diamond) return `I am interested in your Product ID ${stoneId}.`;
    return `I am interested in your ${source === 'lab' ? 'Lab Grown' : 'Natural'} Diamond Product ID ${diamond.StoneId}.`;
  }, [diamond, source, stoneId]);

  return (
    <PageLayout>
      <div className={styles.page}>
        <div className={styles.breadcrumbs}>
          <button
            className={styles.backBtn}
            onClick={() => router.back()}
            type="button"
          >
            ← Back
          </button>

          <span className={styles.crumb}>
            {source === 'lab' ? 'Lab Grown' : source === 'natural' ? 'Natural' : 'Diamond'}
          </span>

          <span className={styles.crumbStrong}>{stoneId}</span>
        </div>

        {loading && <div className={styles.loading}>Loading diamond…</div>}

        {!loading && !diamond && (
          <div className={styles.notFound}>
            <h1>Diamond not found</h1>
            <p>This StoneId doesn’t exist (or is not accessible).</p>
          </div>
        )}

        {!loading && diamond && (
          <>
            <h1 className={styles.h1}>{title}</h1>

            <div className={styles.grid}>
              {/* LEFT: Media */}
              <section className={styles.media}>
                <div className={styles.mediaTop}>
                  <div className={styles.shapeWrap}>
                    <Image
                      src={shapeIcon[diamond.Shape ?? ''] || '/default.png'}
                      alt={diamond.Shape || 'shape'}
                      width={160}
                      height={160}
                      className={styles.shapeImg}
                      priority
                    />
                    <div className={styles.badges}>
                      <span className={styles.badge}>
                        {source === 'lab' ? 'LAB GROWN' : 'NATURAL'}
                      </span>
                      {diamond.Certified ? <span className={styles.badgeAlt}>{diamond.Certified}</span> : null}
                    </div>
                  </div>

                  <div className={styles.keyLine}>
                    <div><b>Carat:</b> {Number.parseFloat(diamond.Size || '0').toFixed(2)}ct</div>
                    <div><b>Color:</b> {diamond.Color || '-'}</div>
                    <div><b>Clarity:</b> {diamond.Clarity || '-'}</div>
                    <div><b>Cut:</b> {diamond.Cut || '-'}</div>
                  </div>
                </div>

                <div className={styles.videoBox}>
                  {diamond.VideoURL ? (
                    <iframe
                      src={diamond.VideoURL}
                      title="Diamond Video"
                      className={styles.iframe}
                      allowFullScreen
                    />
                  ) : (
                    <div className={styles.noVideo}>
                      <div className={styles.noVideoTitle}>Video not available</div>
                      <div className={styles.noVideoSub}>Enquire to get the 360° video.</div>
                    </div>
                  )}
                </div>

                <div className={styles.trustMini}>
                  <div className={styles.trustItem}>✅ Certified stone</div>
                  <div className={styles.trustItem}>✅ Verified specs</div>
                  <div className={styles.trustItem}>✅ WhatsApp support</div>
                </div>
              </section>

              {/* RIGHT: Price + CTA + Specs */}
              <aside className={styles.sidebar}>
                <div className={styles.priceCard}>
                  <div className={styles.priceTop}>
                    <div className={styles.stoneId}>{diamond.StoneId}</div>
                    <div className={styles.status}>
                      {diamond.Status === 'AVAILABLE' ? 'Available' : diamond.Status || '—'}
                    </div>
                  </div>

                  {price.mrp && price.offer ? (
                    <div className={styles.priceRow}>
                      <span className={styles.mrp}>₹{Math.round(price.mrp)}</span>
                      <span className={styles.offer}>₹{Math.round(price.offer)}</span>
                    </div>
                  ) : (
                    <div className={styles.priceRow}>
                      <span className={styles.offer}>Price on request</span>
                    </div>
                  )}

                  <div className={styles.ctaRow}>
                    <button
                      type="button"
                      className={styles.waBtn}
                      onClick={() => {
                        window.open(
                          `https://wa.me/919023130944?text=${encodeURIComponent(waMsg)}`,
                          '_blank'
                        );
                      }}
                    >
                      WhatsApp Enquiry
                    </button>

                    <button
                      type="button"
                      className={styles.shareBtn}
                      onClick={() => {
                        const url = window.location.href;
                        navigator.clipboard.writeText(url);
                        alert('Link copied!');
                      }}
                    >
                      Copy Link
                    </button>
                  </div>

                </div>

                <div className={styles.specCard}>
                  <div className={styles.specTitle}>Diamond Specifications</div>
                  <div className={styles.specGrid}>
                    <Spec k="Shape" v={diamond.Shape} />
                    <Spec k="Carat" v={diamond.Size ? `${Number.parseFloat(diamond.Size).toFixed(2)} ct` : undefined} />
                    <Spec k="Measurements" v={diamond.Measurement ? `${diamond.Measurement} mm` : undefined} />
                    <Spec k="Depth" v={diamond.Depth ? `${Number.parseFloat(diamond.Depth).toFixed(2)}%` : undefined} />
                    <Spec k="Table" v={diamond.Table ? `${Number.parseFloat(diamond.Table).toFixed(2)}%` : undefined} />
                    <Spec k="Color" v={diamond.Color} />
                    <Spec k="Clarity" v={diamond.Clarity} />
                    <Spec k="Cut" v={diamond.Cut} />
                    <Spec k="Polish" v={diamond.Polish} />
                    <Spec k="Symmetry" v={diamond.Symm} />
                    <Spec k="Fluorescence" v={diamond.Fluorescence} />
                    <Spec k="Certified By" v={diamond.Certified} />
                    <Spec k="Certificate No" v={diamond.CertNo} />
                  </div>
                </div>
              </aside>
            </div>

            {/* Sticky mobile CTA */}
            <div className={styles.mobileSticky}>
              <div className={styles.mobilePrice}>
                {price.offer ? `₹${Math.round(price.offer)}` : 'Price on request'}
              </div>
              <button
                className={styles.mobileWa}
                type="button"
                onClick={() => {
                  window.open(
                    `https://wa.me/919023130944?text=${encodeURIComponent(waMsg)}`,
                    '_blank'
                  );
                }}
              >
                WhatsApp
              </button>
            </div>
          </>
        )}
      </div>

      <TrustInfoStrip />
    </PageLayout>
  );
}

function Spec({ k, v }: { k: string; v?: string }) {
  return (
    <div>
      <div style={{ opacity: 0.7, fontSize: '0.8rem' }}>{k}</div>
      <div style={{ fontWeight: 700 }}>{v || '—'}</div>
    </div>
  );
}
