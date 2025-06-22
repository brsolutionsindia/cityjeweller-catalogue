'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebaseConfig';
import Image from 'next/image';
import styles from '../page.module.css';
import { useSearchParams, useRouter } from 'next/navigation';

import SkuSummaryModal from '../components/SkuSummaryModal';
import PageLayout from '../components/PageLayout';
import OfferBar from '../components/OfferBar';
import { applyFiltering } from './CatalogFilterUtil';

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
}

interface Props {
  category: 'silver' | 'gold' | 'diamond' | 'gemstone' | 'labgrown' | 'misc';
}

export default function CatalogView({ category }: Props) {
  const router = useRouter();
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [products, setProducts] = useState<{ id: string; price: number | string; image: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [menuOpen, setMenuOpen] = useState<'sort' | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
const searchParams = useSearchParams();
const searchParam = (searchParams?.get?.('search') ?? '').toLowerCase();
const ratti = parseFloat(searchParams?.get?.('ratti') ?? '0');

  const categoryTitleMap: Record<Props['category'], string> = {
    silver: 'Silver Collection',
    gold: 'Gold Collection',
    diamond: 'Diamond Jewellery',
    gemstone: 'Gemstone Strings',
    labgrown: 'Lab-Grown Diamonds',
    misc: 'Miscellaneous Collection'
  };

  const heading = searchParam ? `Search Results for "${searchParam}"` : categoryTitleMap[category];

  useEffect(() => {
    const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const dateRef = ref(db, 'Global SKU/Rates/Date');
    onValue(rateRef, (snapshot) => setGoldRate(snapshot.val()));
    onValue(dateRef, (snapshot) => setRateDate(snapshot.val()));
  }, []);

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
        if (!skuData) return;

        const allItems = Object.entries(skuData) as [string, RawSkuData][];
        const filteredItems = applyFiltering(allItems, category, searchParam);

        const items = await Promise.all(
          filteredItems.map(async ([key, value]) => {
            const imageUrl = imgData?.[key]?.Primary || '/product-placeholder.jpg';
            const rawPrice = value.grTotalPrice;
            const parsedPrice = typeof rawPrice === 'string' || typeof rawPrice === 'number'
              ? parseFloat(String(rawPrice))
              : NaN;
            const basePrice = !isNaN(parsedPrice) ? parsedPrice / 1.03 : null;

            const adjustedPrice = basePrice
              ? category === 'labgrown' && ratti > 0
                ? Math.round(basePrice * ratti)
                : Math.round(basePrice)
              : 'N/A';

            return { id: key, price: adjustedPrice, image: imageUrl };
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

    return () => window.removeEventListener('keydown', escHandler);
  }, [category, searchParam, ratti, sortOrder]);

  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />

      <section>
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
          <button onClick={() => router.back()} className="text-blue-600 hover:underline flex items-center gap-1">
            ← Back
          </button>
          <span>/</span>
          <Link href="/" className="hover:underline text-blue-600">Home</Link>
          <span>/</span>
          <span className="capitalize text-gray-800 font-medium">
            {category}
          </span>
        </div>

        <h1>{heading}</h1>
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
