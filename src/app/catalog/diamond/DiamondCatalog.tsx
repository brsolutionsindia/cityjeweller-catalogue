'use client';

import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from '../../page.module.css';
import PageLayout from '../../components/PageLayout';
import OfferBar from '../../components/OfferBar';
import { computeAdjustedPrice } from '../utils';

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
}

type ProductCard = {
  id: string;
  price: number | string;
  image: string;
  remarksLower: string;
};

// --- Helper: extract 2–3 letter type code (RG, ER, MG, etc.) from SKU ID ---
function extractSkuType(id: string): string | null {
  const up = id.toUpperCase();
  let m = up.match(/^([A-Z]{2,3})(?=\d)/);
  if (m) return m[1];
  m = up.match(/[-_ ]([A-Z]{2,3})(?=\d)/);
  if (m) return m[1];
  m = up.match(/(?:^|[-_ ])([A-Z]{2,3})(?:\D|$)/);
  return m ? m[1] : null;
}

// --- Helper: extract URL from plain string or Excel HYPERLINK("...") ---
const extractUrl = (val: unknown): string => {
  if (!val) return '';
  const str = String(val).trim();
  const match = str.match(/HYPERLINK\("(.+?)"/);
  if (match?.[1]) return match[1];
  if (str.startsWith('http')) return str;
  return '';
};

export default function DiamondCatalog() {
  const [rate, setRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Video modal state
  const [videoSkuId, setVideoSkuId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const typeFilter = (searchParams?.get?.('type') ?? '').toUpperCase();
  const subFilter = (searchParams?.get?.('sub') ?? '').toLowerCase();
  const searchParam = (searchParams?.get?.('search') ?? '').toLowerCase();

  const heading = (() => {
    if (searchParam) return `Search results for "${searchParam}"`;
    if (subFilter && typeFilter) return `Diamond ${typeFilter} – ${subFilter}`;
    if (subFilter) return `Diamond ${subFilter} Collection`;
    if (typeFilter) return `Diamond ${typeFilter} Collection`;
    return 'Diamond Collection';
  })();

  // --- Load rate/date ---
  useEffect(() => {
    import('firebase/database').then(({ ref, onValue }) => {
      const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
      const dateRef = ref(db, 'Global SKU/Rates/Date');
      onValue(rateRef, (s) => setRate(s.val()));
      onValue(dateRef, (s) => setRateDate(s.val()));
    });
  }, []);

  // --- Load Diamond SKUs using the tag index ---
  useEffect(() => {
    async function loadDiamond() {
      setLoading(true);

      const diamondRef = ref(db, 'Global SKU/SKU/indices/tags/diamond');
      const diamondSnap = await get(diamondRef);

      if (!diamondSnap.exists()) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const diamondIds = Object.keys(diamondSnap.val());

      const [skuSnap, imgSnap] = await Promise.all([
        get(ref(db, 'Global SKU/SKU')),
        get(ref(db, 'Global SKU/Images')),
      ]);

      const skuData = skuSnap.val() || {};
      const imgData = imgSnap.val() || {};

      const filtered: ProductCard[] = [];
      for (const id of diamondIds) {
        const rec: RawSkuData = skuData[id];
        if (!rec) continue;

        const remarksLower = (rec.remarks || '').toLowerCase();
        const idLower = id.toLowerCase();

        if (typeFilter) {
          const actual = extractSkuType(id);
          if (actual !== typeFilter) continue;
        }

        if (subFilter && !remarksLower.includes(subFilter)) continue;

        if (searchParam && !idLower.includes(searchParam) && !remarksLower.includes(searchParam))
          continue;

        filtered.push({
          id,
          price: computeAdjustedPrice(rec.grTotalPrice),
          image: imgData?.[id]?.Primary || '/product-placeholder.jpg',
          remarksLower,
        });
      }

      filtered.sort((a, b) => {
        const pa = typeof a.price === 'number' ? a.price : 0;
        const pb = typeof b.price === 'number' ? b.price : 0;
        return pa - pb;
      });

      setProducts(filtered);
      setLoading(false);
    }

    loadDiamond();
  }, [typeFilter, subFilter, searchParam]);

  // --- MG special split (only when type=MG & no "sub") ---
  const mgSections = (() => {
    if (typeFilter !== 'MG' || subFilter) return null;
    const pendant: ProductCard[] = [];
    const stringOnly: ProductCard[] = [];
    const mangalsutraPure: ProductCard[] = [];
    for (const p of products) {
      const r = p.remarksLower;
      if (r.includes('pendant')) pendant.push(p);
      else if (r.includes('string')) stringOnly.push(p);
      else mangalsutraPure.push(p);
    }
    return { pendant, stringOnly, mangalsutraPure };
  })();

  // --- Video modal loader (kept) ---
  const openVideoModal = async (skuId: string) => {
    setVideoSkuId(skuId);
    setVideoLoading(true);
    setVideoUrl(null);
    setVideoMessage(null);

    try {
      const videoRef = ref(db, `Global SKU/NaturalDiamonds/${skuId}/Video`);
      const snap = await get(videoRef);

      if (!snap.exists()) {
        setVideoMessage('Enquire Now to get Video');
      } else {
        const url = extractUrl(snap.val());
        if (url) setVideoUrl(url);
        else setVideoMessage('Enquire Now to get Video');
      }
    } catch (err) {
      console.error('Error loading video URL for', skuId, err);
      setVideoMessage('Enquire Now to get Video');
    } finally {
      setVideoLoading(false);
    }
  };

  const closeVideoModal = () => {
    setVideoSkuId(null);
    setVideoUrl(null);
    setVideoMessage(null);
    setVideoLoading(false);
  };

const CatalogGrid = ({ list }: { list: ProductCard[] }) => (
  <section className={styles.catalogGrid}>
    {list.map((item) => (
      <Link
        key={item.id}
        href={`/catalog/${encodeURIComponent(item.id)}`}
        className={styles.catalogCard}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <Image
          src={item.image}
          alt={item.id}
          width={200}
          height={200}
          className={styles.catalogImage}
        />
        <p className={styles.catalogPrice}>
          ₹{typeof item.price === 'number' ? item.price.toLocaleString('en-IN') : item.price}
        </p>
        <h3 className={styles.catalogCode}>Code: {item.id}</h3>
      </Link>
      
      ))}
    </section>
  );

  return (
    <PageLayout>
      <OfferBar goldRate={rate} rateDate={rateDate} />

      <section>
        <h1>{heading}</h1>
        <p className={styles.itemCount}>{products.length} item(s)</p>

        {loading ? (
          <p>Loading...</p>
        ) : mgSections ? (
          <>
            <h2 className={styles.subheading}>
              <span className={styles.sectionTitle}>Mangalsutra Section</span>{' '}
              <span className={styles.itemCountSmall}>({mgSections.mangalsutraPure.length})</span>
            </h2>
            <CatalogGrid list={mgSections.mangalsutraPure} />

            <h2 className={styles.subheading}>
              <span className={styles.sectionTitle}>Pendant Section</span>{' '}
              <span className={styles.itemCountSmall}>({mgSections.pendant.length})</span>
            </h2>
            <CatalogGrid list={mgSections.pendant} />

            <h2 className={styles.subheading}>
              <span className={styles.sectionTitle}>String Section</span>{' '}
              <span className={styles.itemCountSmall}>({mgSections.stringOnly.length})</span>
            </h2>
            <CatalogGrid list={mgSections.stringOnly} />
          </>
        ) : (
          <CatalogGrid list={products} />
        )}
      </section>

      {/* Embedded video/webpage viewer for NaturalDiamonds/<SKU>/Video */}
      {videoSkuId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={closeVideoModal}
        >
          <div
            style={{
              background: '#000',
              borderRadius: '8px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '80vh',
              padding: '0.75rem',
              color: '#fff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ fontWeight: 'bold' }}>Product ID: {videoSkuId}</span>
              <button
                type="button"
                onClick={closeVideoModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                }}
              >
                ✕ Close
              </button>
            </div>

            {videoLoading ? (
              <p style={{ textAlign: 'center', padding: '1rem' }}>Loading video...</p>
            ) : videoUrl ? (
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                <iframe
                  src={videoUrl}
                  title={`Diamond Video ${videoSkuId}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  }}
                  allowFullScreen
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                <p style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                  {videoMessage || 'Enquire Now to get Video'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const msg = `I am interested in your Product ID ${videoSkuId}. Please share the video link.`;
                    window.open(
                      `https://wa.me/919023130944?text=${encodeURIComponent(msg)}`,
                      '_blank'
                    );
                  }}
                  style={{
                    padding: '0.4rem 0.9rem',
                    backgroundColor: '#25D366',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                  }}
                >
                  Enquire on WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
