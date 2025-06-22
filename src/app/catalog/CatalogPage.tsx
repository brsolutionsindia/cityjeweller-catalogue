'use client';

import { useEffect, useState, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebaseConfig';
import Image from 'next/image';
import styles from '../page.module.css';
import { useSearchParams } from 'next/navigation';
import SkuSummaryModal from '../components/SkuSummaryModal';
import PageLayout from '../components/PageLayout';
import OfferBar from '../components/OfferBar';

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
}

type Props = {
  category: 'silver' | 'gold' | 'diamond' | 'gemstone' | 'labgrown' | 'misc';
};

export default function CatalogView({ category }: Props) {
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [products, setProducts] = useState<{ id: string; price: number | string; image: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [menuOpen, setMenuOpen] = useState<'sort' | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

const searchParams = useSearchParams();
const ratti = parseFloat(searchParams?.get('ratti') ?? '0');
  const menuRef = useRef<HTMLDivElement | null>(null);

  const headingMap: Record<Props['category'], string> = {
    silver: 'Silver Collection',
    gold: 'Gold Collection',
    diamond: 'Diamond Collection',
    gemstone: 'Gemstone Collection',
    labgrown: 'Lab-Grown Diamond Collection',
    misc: 'Miscellaneous Collection',
  };

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
        if (skuData) {
          const allItems = Object.entries(skuData) as [string, RawSkuData][];

          const filteredItems = allItems.filter(([, value]) => {
            const remarks = (value.remarks || '').toLowerCase();
            const categoryOther = (value.jwelleryCategoryOther || '').toLowerCase();

            if (category === 'silver') return remarks.includes('sil');
            if (category === 'gold') return !remarks.includes('sil') && remarks.includes('gold');
            if (category === 'diamond') return remarks.includes('diamond');
            if (category === 'gemstone') return remarks.includes('gemstone') || categoryOther.includes('gem');
            if (category === 'labgrown') return remarks.includes('cvd') || remarks.includes('labgrown');
            if (category === 'misc') return !remarks.includes('sil') && !remarks.includes('gold') && !remarks.includes('diamond') && !remarks.includes('gemstone');
            return true;
          });

          const items = await Promise.all(
            filteredItems.map(async ([key, value]) => {
              const imageUrl = imgData?.[key]?.Primary || '/product-placeholder.jpg';
              const rawPrice = value.grTotalPrice;
              const parsedPrice = typeof rawPrice === 'string' || typeof rawPrice === 'number'
                ? parseFloat(String(rawPrice))
                : NaN;
              const basePrice = !isNaN(parsedPrice) ? parsedPrice / 1.03 : null;

              const adjustedPrice = basePrice && ratti > 0 ? Math.round(basePrice * ratti) : Math.round(basePrice || 0);

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
  }, [category, sortOrder, ratti]);

  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />
      <section>
        <h1>{headingMap[category]}</h1>
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

        {menuOpen && (
          <div className={styles.popupMenu} id="footerMenuPopup" ref={menuRef}>
            {menuOpen === 'sort' && (
              <ul>
                <li onClick={() => { setSortOrder('asc'); setMenuOpen(null); }}>Price: Low to High</li>
                <li onClick={() => { setSortOrder('desc'); setMenuOpen(null); }}>Price: High to Low</li>
              </ul>
            )}
          </div>
        )}
      </footer>
    </PageLayout>
  );
}