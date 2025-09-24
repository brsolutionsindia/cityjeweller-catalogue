// GoldCatalog.tsx
'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import Image from 'next/image';
import styles from '../../page.module.css';
import { useSearchParams } from 'next/navigation';
import SkuSummaryModal from '../../components/SkuSummaryModal';
import PageLayout from '../../components/PageLayout';
import OfferBar from '../../components/OfferBar';
import { computeAdjustedPrice } from '../utils';
import { filterGoldItems } from './filters';

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
}

type ProductCard = {
  id: string;
  price: number | string;
  image: string;
  remarksLower?: string;
};

export default function GoldCatalog() {
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const typeFilter = searchParams?.get?.('type') ?? '';
  const searchParam = (searchParams?.get?.('search') ?? '').toLowerCase();

  const typeMap: { [key: string]: string } = {
    ER: 'Earrings Collection',
    RG: 'Rings Collection',
    NK: 'Necklace Sets Collection',
    PD: 'Pendants Collection',
    MG: 'Mangalsutra Collection',
    BG: 'Bangles Collection',
    BR: 'Bracelets Collection',
    CH: 'Chains Collection',
    NP: 'Nose Pins Collection',
    OT: 'Others Collection',
  };

  const heading = (() => {
    if (searchParam) return `Search Results for "${searchParam}"`;
    if (typeFilter && typeMap[typeFilter]) return typeMap[typeFilter];
    return 'Gold Collection';
  })();

  useEffect(() => {
    const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const dateRef = ref(db, 'Global SKU/Rates/Date');
    onValue(rateRef, (snapshot) => setGoldRate(snapshot.val()));
    onValue(dateRef, (snapshot) => setRateDate(snapshot.val()));
  }, []);

  useEffect(() => {
    const skuRef = ref(db, 'Global SKU/SKU/');
    const imgRef = ref(db, 'Global SKU/Images/');

    onValue(skuRef, (skuSnap) => {
      const skuData = skuSnap.val();
      onValue(imgRef, async (imgSnap) => {
        const imgData = imgSnap.val();
        if (!skuData) return;

        const allItems = Object.entries(skuData) as [string, RawSkuData][];
        const filteredItems = allItems.filter(([key, value]) =>
          filterGoldItems(key, value, searchParam, typeFilter)
        );

        const items = await Promise.all(
          filteredItems.map(async ([key, value]) => {
            const imageUrl = imgData?.[key]?.Primary || '/product-placeholder.jpg';
            const adjustedPrice = computeAdjustedPrice(value.grTotalPrice);
            const remarksLower = (value.remarks ?? '').toLowerCase();
            return { id: key, price: adjustedPrice, image: imageUrl, remarksLower };
          })
        );

        items.sort((a, b) => {
          const priceA = typeof a.price === 'number' ? a.price : 0;
          const priceB = typeof b.price === 'number' ? b.price : 0;
          return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
        });

        setProducts(items);
        setLoading(false);
      });
    });
  }, [searchParam, sortOrder, typeFilter]);

  // --- Helpers for Mangalsutra split ---
// --- Helpers for Mangalsutra split (mutually exclusive) ---
const mangalsutraSections = (() => {
  if (typeFilter !== 'MG') return null;

  const pendant: ProductCard[] = [];
  const stringOnly: ProductCard[] = [];
  const mangalsutraPure: ProductCard[] = [];

  for (const p of products) {
    const r = (p.remarksLower || '').toLowerCase();
    const hasPendant = r.includes('pendant');
    const hasString = r.includes('string');

    if (hasPendant) {
      pendant.push(p);
    } else if (hasString) {
      stringOnly.push(p);
    } else {
      // neither "pendant" nor "string"
      mangalsutraPure.push(p);
    }
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
            ₹
            {typeof item.price === 'number'
              ? item.price.toLocaleString('en-IN')
              : item.price}
          </p>
          <h3 className={styles.catalogCode}>Code: {item.id}</h3>
        </div>
      ))}
    </section>
  );

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
      {/* Mangalsutra Section (remarks WITHOUT "pendant" or "string") */}
      <h2 className={styles.subheading}>
        <span className={styles.sectionTitle}>Mangalsutra Section</span>{' '}
        <span className={styles.itemCountSmall}>
          ({mangalsutraSections.mangalsutraPure.length})
        </span>
      </h2>
      {mangalsutraSections.mangalsutraPure.length > 0 ? (
        <CatalogGrid list={mangalsutraSections.mangalsutraPure} />
      ) : (
        <p>No classic mangalsutras found.</p>
      )}

      {/* Pendant Section */}
      <h2 className={styles.subheading}>
        <span className={styles.sectionTitle}>Pendant Section</span>{' '}
        <span className={styles.itemCountSmall}>
          ({mangalsutraSections.pendant.length})
        </span>
      </h2>
      {mangalsutraSections.pendant.length > 0 ? (
        <CatalogGrid list={mangalsutraSections.pendant} />
      ) : (
        <p>No pendant-style mangalsutras found.</p>
      )}

      {/* String Section */}
      <h2 className={styles.subheading}>
        <span className={styles.sectionTitle}>String Section</span>{' '}
        <span className={styles.itemCountSmall}>
          ({mangalsutraSections.stringOnly.length})
        </span>
      </h2>
      {mangalsutraSections.stringOnly.length > 0 ? (
        <CatalogGrid list={mangalsutraSections.stringOnly} />
      ) : (
        <p>No string-style mangalsutras found.</p>
      )}
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
