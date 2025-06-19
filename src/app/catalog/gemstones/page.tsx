'use client';

import { useEffect, useState, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import Image from 'next/image';
import styles from '../../page.module.css';
import { useSearchParams } from 'next/navigation';
import SkuSummaryModal from '../../components/SkuSummaryModal';
import PageLayout from '../../components/PageLayout';

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
}

export default function GemstoneStringCatalog() {
  const [products, setProducts] = useState<{ id: string; price: number | string; image: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<'sort' | null>(null);

  const searchParams = useSearchParams();
  const typeFilter = searchParams.get('type');
  const searchParam = (searchParams.get('search') || '').toLowerCase();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const heading = (() => {
    if (searchParam) return `Search Results for "\${searchParam}"`;
    if (typeFilter === 'ST') return 'Gemstone Strings Collection';
    return 'Gemstone Products';
  })();

  useEffect(() => {
    const skuRef = ref(db, 'Global SKU/SKU/');
    const imgRef = ref(db, 'Global SKU/Images/');

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(null);
    };
    window.addEventListener('keydown', escHandler);

    onValue(skuRef, (skuSnap) => {
      const skuData = skuSnap.val();
      onValue(imgRef, async (imgSnap) => {
        const imgData = imgSnap.val();
        if (skuData) {
          const allItems = Object.entries(skuData) as [string, RawSkuData][];
          const filteredItems = allItems.filter(([key, value]) => {
            const remarks = (value.remarks || '').toLowerCase();
            const categoryOther = (value.jwelleryCategoryOther || '').toLowerCase();

            if (searchParam) {
              return (
                key.toLowerCase().includes(searchParam) ||
                remarks.includes(searchParam) ||
                categoryOther.includes(searchParam)
              );
            }

            if (typeFilter === 'ST') return remarks.includes('gemstone');
            return false;
          });

          const items = await Promise.all(
            filteredItems.map(async ([key, value]) => {
              const imageUrl = imgData?.[key]?.Primary || '/product-placeholder.jpg';
              const rawPrice = value.grTotalPrice;
              const parsedPrice = typeof rawPrice === 'string' || typeof rawPrice === 'number'
                ? parseFloat(String(rawPrice))
                : NaN;
              const basePrice = !isNaN(parsedPrice) ? parsedPrice / 1.03 : null;
              const adjustedPrice = basePrice ? Math.round(basePrice) : 'N/A';

              return { id: key, price: adjustedPrice, image: imageUrl };
            })
          );

          items.sort((a, b) => {
            const priceA = typeof a.price === 'number' ? a.price : 0;
            const priceB = typeof b.price === 'number' ? b.price : 0;
            return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
          });

          setProducts(items);
        }
        setLoading(false);
      });
    });

    return () => {
      window.removeEventListener('keydown', escHandler);
    };
  }, [typeFilter, sortOrder, searchParam]);

  return (
    <PageLayout>
      <section>
      <h1 className={styles.pageTitle}>{heading}</h1>

        <p className={styles.itemCount}>{products.length} item(s)</p>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <section className={styles.catalogGrid}>
            {products.map((item) => (
              <div key={item.id} className={styles.catalogCard} onClick={() => setSelectedSku(item.id)}>
                <Image src={item.image} alt={item.id} width={200} height={200} className={styles.catalogImage} />
                <p className={styles.catalogPrice}>₹{typeof item.price === 'number' ? item.price.toLocaleString('en-IN') : item.price}</p>
                <h3 className={styles.catalogCode}>Code: {item.id}</h3>
              </div>
            ))}
          </section>
        )}
      </section>

      {selectedSku && <SkuSummaryModal skuId={selectedSku} onClose={() => setSelectedSku(null)} />}

      <footer className={styles.footerMenu}>
        <button className={styles.footerButton} onClick={() => setMenuOpen(menuOpen === 'sort' ? null : 'sort')}>Sort</button>

        {menuOpen === 'sort' && (
          <div className={styles.popupMenu} ref={menuRef}>
            <ul>
              <li onClick={() => { setSortOrder('asc'); setMenuOpen(null); }}>Price: Low to High</li>
              <li onClick={() => { setSortOrder('desc'); setMenuOpen(null); }}>Price: High to Low</li>
            </ul>
          </div>
        )}
      </footer>
    </PageLayout>
  );
}