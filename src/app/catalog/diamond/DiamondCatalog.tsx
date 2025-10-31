'use client';

import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import styles from '../../page.module.css';
import PageLayout from '../../components/PageLayout';
import OfferBar from '../../components/OfferBar';
import SkuSummaryModal from '../../components/SkuSummaryModal';
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
// Supports forms like "RG101", "2665-RG101", "8165_NK009"
function extractSkuType(id: string): string | null {
  const up = id.toUpperCase();
  let m = up.match(/^([A-Z]{2,3})(?=\d)/);
  if (m) return m[1];
  m = up.match(/[-_ ]([A-Z]{2,3})(?=\d)/);
  if (m) return m[1];
  m = up.match(/(?:^|[-_ ])([A-Z]{2,3})(?:\D|$)/);
  return m ? m[1] : null;
}

export default function DiamondCatalog() {
  const [rate, setRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const typeFilter = (searchParams?.get?.('type') ?? '').toUpperCase(); // e.g. RG, MG
  const subFilter = (searchParams?.get?.('sub') ?? '').toLowerCase();   // e.g. pendant, string, antique
  const searchParam = (searchParams?.get?.('search') ?? '').toLowerCase();

  const heading = (() => {
    if (searchParam) return `Search results for "${searchParam}"`;
    if (subFilter && typeFilter) return `Diamond ${typeFilter} – ${subFilter}`;
    if (subFilter) return `Diamond ${subFilter} Collection`;
    if (typeFilter) return `Diamond ${typeFilter} Collection`;
    return 'Diamond Collection';
  })();

  // --- Load rate/date (keeping your existing paths) ---
  useEffect(() => {
    // If you have a dedicated diamond rate path, change these two refs
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

      // 1) Get the diamond index: /Global SKU/SKU/indices/tags/diamond
      const diamondRef = ref(db, 'Global SKU/SKU/indices/tags/diamond');
      const diamondSnap = await get(diamondRef);
      if (!diamondSnap.exists()) {
        setProducts([]);
        setLoading(false);
        return;
      }
      const diamondIds = Object.keys(diamondSnap.val()); // SKU IDs

      // 2) Load SKU and Image data
      const [skuSnap, imgSnap] = await Promise.all([
        get(ref(db, 'Global SKU/SKU')),
        get(ref(db, 'Global SKU/Images')),
      ]);
      const skuData = skuSnap.val() || {};
      const imgData = imgSnap.val() || {};

      // 3) Build + filter
      const filtered: ProductCard[] = [];
      for (const id of diamondIds) {
        const rec: RawSkuData = skuData[id];
        if (!rec) continue;

        const remarksLower = (rec.remarks || '').toLowerCase();
        const idLower = id.toLowerCase();

        // type (parse from SKU ID)
        if (typeFilter) {
          const actual = extractSkuType(id);
          if (actual !== typeFilter) continue;
        }

        // sub (keyword in remarks)
        if (subFilter && !remarksLower.includes(subFilter)) continue;

        // search (in id or remarks)
        if (searchParam && !idLower.includes(searchParam) && !remarksLower.includes(searchParam)) continue;

        filtered.push({
          id,
          price: computeAdjustedPrice(rec.grTotalPrice),
          image: imgData?.[id]?.Primary || '/product-placeholder.jpg',
          remarksLower,
        });
      }

      // 4) Sort by price asc
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

  const CatalogGrid = ({ list }: { list: ProductCard[] }) => (
    <section className={styles.catalogGrid}>
      {list.map((item) => (
        <div
          key={item.id}
          className={styles.catalogCard}
          onClick={() => setSelectedSku(item.id)}
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
        </div>
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
            {/* Mangalsutra (neither "pendant" nor "string") */}
            <h2 className={styles.subheading}>
              <span className={styles.sectionTitle}>Mangalsutra Section</span>{' '}
              <span className={styles.itemCountSmall}>({mgSections.mangalsutraPure.length})</span>
            </h2>
            <CatalogGrid list={mgSections.mangalsutraPure} />

            {/* Pendant */}
            <h2 className={styles.subheading}>
              <span className={styles.sectionTitle}>Pendant Section</span>{' '}
              <span className={styles.itemCountSmall}>({mgSections.pendant.length})</span>
            </h2>
            <CatalogGrid list={mgSections.pendant} />

            {/* String */}
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

      {selectedSku && (
        <SkuSummaryModal skuId={selectedSku} onClose={() => setSelectedSku(null)} />
      )}
    </PageLayout>
  );
}
