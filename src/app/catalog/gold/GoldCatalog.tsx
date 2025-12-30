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

interface ProductCard {
  id: string;
  price: number | string;
  image: string;
  remarksLower: string;
}

function extractSkuType(id: string): string | null {
  const up = id.toUpperCase();

  let m = up.match(/^([A-Z]{2})(?=\d)/);
  if (m) return m[1];

  m = up.match(/[-_ ]([A-Z]{2})(?=\d)/);
  if (m) return m[1];

  m = up.match(/(?:^|[-_ ])([A-Z]{2})(?:\D|$)/);
  return m ? m[1] : null;
}

export default function GoldCatalog() {
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  const typeFilter = searchParams?.get?.('type') ?? '';
  const subFilter = (searchParams?.get?.('sub') ?? '').toLowerCase();
  const searchParam = (searchParams?.get?.('search') ?? '').toLowerCase();

  const heading = (() => {
    if (searchParam) return `Search results for "${searchParam}"`;
    if (subFilter) return `Gold ${subFilter} Collection`;
    if (typeFilter) return `Gold ${typeFilter} Collection`;
    return 'Gold Collection';
  })();

  // --- Load rates ---
  useEffect(() => {
    import('firebase/database').then(({ ref, onValue }) => {
      const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
      const dateRef = ref(db, 'Global SKU/Rates/Date');
      onValue(rateRef, (s) => setGoldRate(s.val()));
      onValue(dateRef, (s) => setRateDate(s.val()));
    });
  }, []);

  // --- Load SKUs by index ---
  useEffect(() => {
    async function loadGoldItems() {
      setLoading(true);

      const goldRef = ref(db, 'Global SKU/SKU/indices/tags/gold');
      const goldSnap = await get(goldRef);

      if (!goldSnap.exists()) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const goldIds = Object.keys(goldSnap.val());

      const [skuSnap, imgSnap] = await Promise.all([
        get(ref(db, 'Global SKU/SKU')),
        get(ref(db, 'Global SKU/Images'))
      ]);

      const skuData = skuSnap.val() || {};
      const imgData = imgSnap.val() || {};

      const filtered: ProductCard[] = [];
      for (const id of goldIds) {
        if (!skuData[id]) continue;

        const r = (skuData[id].remarks || '').toLowerCase();
        const price = computeAdjustedPrice(skuData[id].grTotalPrice);
        const image = imgData?.[id]?.Primary || '/product-placeholder.jpg';
        const idLower = id.toLowerCase();

        if (typeFilter) {
          const desired = typeFilter.toUpperCase();
          const actual = extractSkuType(id);
          if (actual !== desired) continue;
        }

        if (subFilter && !r.includes(subFilter)) continue;
        if (searchParam && !r.includes(searchParam) && !idLower.includes(searchParam)) continue;

        filtered.push({ id, price, image, remarksLower: r });
      }

      filtered.sort((a, b) => {
        const pa = typeof a.price === 'number' ? a.price : 0;
        const pb = typeof b.price === 'number' ? b.price : 0;
        return pa - pb;
      });

      setProducts(filtered);
      setLoading(false);
    }

    loadGoldItems();
  }, [typeFilter, subFilter, searchParam]);

  const CatalogGrid = ({ list }: { list: ProductCard[] }) => (
    <section className={styles.catalogGrid}>
      {list.map((p) => (
        <Link
          key={p.id}
          href={`/catalog/${encodeURIComponent(p.id)}`}
          className={styles.catalogCard}
        >
          <Image
            src={p.image}
            alt={p.id}
            width={200}
            height={200}
            className={styles.catalogImage}
          />
          <p className={styles.catalogPrice}>
            ₹{typeof p.price === 'number' ? p.price.toLocaleString('en-IN') : p.price}
          </p>
          <h3 className={styles.catalogCode}>{p.id}</h3>
        </Link>
      ))}
    </section>
  );

  // --- Mangalsutra special split ---
  const mangalsutraSections = (() => {
    if (typeFilter !== 'MG') return null;

    const pendant: ProductCard[] = [];
    const stringOnly: ProductCard[] = [];
    const pure: ProductCard[] = [];

    for (const p of products) {
      const r = p.remarksLower;
      if (r.includes('pendant')) pendant.push(p);
      else if (r.includes('string')) stringOnly.push(p);
      else pure.push(p);
    }

    return { pendant, stringOnly, pure };
  })();

  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />

      <section>
        <h1>{heading}</h1>
        <p className={styles.itemCount}>{products.length} item(s)</p>

        {loading ? (
          <p>Loading...</p>
        ) : typeFilter === 'MG' && mangalsutraSections ? (
          <>
            <h2>Mangalsutra Section ({mangalsutraSections.pure.length})</h2>
            <CatalogGrid list={mangalsutraSections.pure} />

            <h2>Pendant Section ({mangalsutraSections.pendant.length})</h2>
            <CatalogGrid list={mangalsutraSections.pendant} />

            <h2>String Section ({mangalsutraSections.stringOnly.length})</h2>
            <CatalogGrid list={mangalsutraSections.stringOnly} />
          </>
        ) : (
          <CatalogGrid list={products} />
        )}
      </section>
    </PageLayout>
  );
}
