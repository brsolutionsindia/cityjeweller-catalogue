'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../../firebaseConfig';
import Image from 'next/image';
import styles from '../page.module.css';     // existing catalog grid/card styles
import s from './search.module.css';         // search skeleton + state styles
import PageLayout from '../components/PageLayout';
import SkuSummaryModal from '../components/SkuSummaryModal';

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
}

type ProductItem = { id: string; price: number | string; image: string };

function cx(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ');
}

function SearchSkeleton({ count = 12 }: { count?: number }) {
  return (
    <section className={styles.catalogGrid} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cx(styles.catalogCard, s.skeletonCard)}>
          <div className={s.skeletonImage} />
          <div className={s.skeletonLine} />
          <div className={s.skeletonLineShort} />
        </div>
      ))}
    </section>
  );
}

export default function SearchClient() {
  const searchParams = useSearchParams();
  const searchQueryRaw = searchParams?.get?.('query') ?? '';
  const searchQuery = useMemo(() => searchQueryRaw.trim().toLowerCase(), [searchQueryRaw]);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg(null);
      setProducts([]);
      setSelectedSku(null);

      try {
        // If query is empty, don’t fetch the entire DB and pretend it’s “search”
        if (!searchQuery) {
          if (!cancelled) {
            setProducts([]);
            setLoading(false);
          }
          return;
        }

        const skuRef = ref(db, 'Global SKU/SKU/');
        const imgRef = ref(db, 'Global SKU/Images/');

        // One-time fetch (faster + avoids lingering listeners)
        const [skuSnap, imgSnap] = await Promise.all([get(skuRef), get(imgRef)]);

        if (cancelled) return;

        const skuData = skuSnap.val() as Record<string, RawSkuData> | null;
        const imgData = imgSnap.val() as Record<string, any> | null;

        if (!skuData) {
          setProducts([]);
          setLoading(false);
          return;
        }

        const allItems = Object.entries(skuData) as [string, RawSkuData][];

        const filtered = allItems.filter(([key, value]) => {
          const idMatch = key.toLowerCase().includes(searchQuery);
          const remarksMatch = (value.remarks || '').toLowerCase().includes(searchQuery);
          const categoryMatch = (value.jwelleryCategoryOther || '').toLowerCase().includes(searchQuery);
          return idMatch || remarksMatch || categoryMatch;
        });

        const mapped: ProductItem[] = filtered.map(([key, value]) => {
          const imageUrl = imgData?.[key]?.Primary || '/product-placeholder.jpg';

          const rawPrice = value.grTotalPrice;
          const parsed =
            typeof rawPrice === 'string' || typeof rawPrice === 'number'
              ? parseFloat(String(rawPrice))
              : NaN;

          // Your existing logic (divide by 1.03)
          const price = Number.isFinite(parsed) ? Math.round(parsed / 1.03) : 'N/A';

          return { id: key, price, image: imageUrl };
        });

        // Optional: sort by cheapest first (feels “premium”)
        mapped.sort((a, b) => {
          const ap = typeof a.price === 'number' ? a.price : Number.POSITIVE_INFINITY;
          const bp = typeof b.price === 'number' ? b.price : Number.POSITIVE_INFINITY;
          return ap - bp;
        });

        setProducts(mapped);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setErrorMsg(err?.message || 'Failed to load search results.');
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const title = searchQuery ? `Search Results for “${searchQuery}”` : 'Search';

  return (
    <PageLayout>
      <section>
        <div style={{ padding: '1rem', paddingBottom: '0.25rem' }}>
          <h1 style={{ margin: 0 }}>{title}</h1>

          {searchQuery ? (
            <p className={styles.itemCount}>
              {loading ? 'Searching catalogue…' : `${products.length} item(s)`}
            </p>
          ) : (
            <p className={styles.itemCount}>
              Type something like “roseDay”, “ER”, “ring”, “pukhraj”…
            </p>
          )}
        </div>

        {/* Error State */}
        {errorMsg && !loading && (
          <div className={s.searchStateBox} role="alert">
            <div className={s.searchStateTitle}>Couldn’t load results</div>
            <div className={s.searchStateText}>{errorMsg}</div>
            <div className={s.searchStateHint}>Please try again or refresh.</div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && <SearchSkeleton count={12} />}

        {/* Empty State */}
        {!loading && !errorMsg && searchQuery && products.length === 0 && (
          <div className={s.searchStateBox}>
            <div className={s.searchStateTitle}>No matches found</div>
            <div className={s.searchStateText}>
              Try searching by SKU code, category, or a keyword in remarks.
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && !errorMsg && products.length > 0 && (
          <section className={styles.catalogGrid}>
            {products.map((item) => (
              <button
                key={item.id}
                className={s.catalogCardButton}
                onClick={() => setSelectedSku(item.id)}
                aria-label={`Open details for ${item.id}`}
              >
                <div className={styles.catalogCard}>
                  <Image
                    src={item.image}
                    alt={item.id}
                    width={260}
                    height={260}
                    className={styles.catalogImage}
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                  />
                  <p className={styles.catalogPrice}>
                    ₹{typeof item.price === 'number' ? item.price.toLocaleString('en-IN') : item.price}
                  </p>
                  <h3 className={styles.catalogCode}>Code: {item.id}</h3>
                </div>
              </button>
            ))}
          </section>
        )}

        {selectedSku && <SkuSummaryModal skuId={selectedSku} onClose={() => setSelectedSku(null)} />}
      </section>
    </PageLayout>
  );
}
