'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebaseConfig';
import Image from 'next/image';
import styles from '../page.module.css';
import PageLayout from '../components/PageLayout';
import SkuSummaryModal from '../components/SkuSummaryModal';

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
}

export default function SearchClient() {
  const searchParams = useSearchParams();
  const searchQuery = (searchParams.get('query') || '').toLowerCase();
  const [products, setProducts] = useState<{ id: string; price: number | string; image: string }[]>([]);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  useEffect(() => {
    const skuRef = ref(db, 'Global SKU/SKU/');
    const imgRef = ref(db, 'Global SKU/Images/');

    onValue(skuRef, (skuSnap) => {
      const skuData = skuSnap.val();
      onValue(imgRef, async (imgSnap) => {
        const imgData = imgSnap.val();
        if (!skuData) return;

        const allItems = Object.entries(skuData) as [string, RawSkuData][];
        const filteredItems = allItems.filter(([key, value]) => {
          const idMatch = key.toLowerCase().includes(searchQuery);
          const remarksMatch = (value.remarks || '').toLowerCase().includes(searchQuery);
          const categoryMatch = (value.jwelleryCategoryOther || '').toLowerCase().includes(searchQuery);
          return idMatch || remarksMatch || categoryMatch;
        });

        const items = await Promise.all(
          filteredItems.map(async ([key, value]) => {
            const imageUrl = imgData?.[key]?.Primary || '/product-placeholder.jpg';
            const rawPrice = value.grTotalPrice;
            const price = typeof rawPrice === 'string' || typeof rawPrice === 'number'
              ? Math.round(parseFloat(String(rawPrice)) / 1.03)
              : 'N/A';

            return { id: key, price, image: imageUrl };
          })
        );

        setProducts(items);
      });
    });
  }, [searchQuery]);

  return (
    <PageLayout>
      <section>
        <h1 style={{ paddingLeft: '1rem' }}>Search Results for “{searchQuery}”</h1>
        <p className={styles.itemCount}>{products.length} item(s)</p>

        <section className={styles.catalogGrid}>
          {products.map((item) => (
            <div key={item.id} className={styles.catalogCard} onClick={() => setSelectedSku(item.id)}>
              <Image src={item.image} alt={item.id} width={200} height={200} className={styles.catalogImage} />
              <p className={styles.catalogPrice}>₹{typeof item.price === 'number' ? item.price.toLocaleString('en-IN') : item.price}</p>
              <h3 className={styles.catalogCode}>Code: {item.id}</h3>
            </div>
          ))}
        </section>

        {selectedSku && <SkuSummaryModal skuId={selectedSku} onClose={() => setSelectedSku(null)} />}
      </section>
    </PageLayout>
  );
}
