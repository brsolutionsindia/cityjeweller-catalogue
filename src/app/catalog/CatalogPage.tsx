'use client';

import { useEffect, useState, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebaseConfig';
import Image from 'next/image';
import styles from '../page.module.css';
import { useSearchParams, useRouter } from 'next/navigation';
import SkuSummaryModal from '../components/SkuSummaryModal';
import PageLayout from '../components/PageLayout';
import OfferBar from '../components/OfferBar';

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
}

export default function CatalogPage() {
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [products, setProducts] = useState<{ id: string; price: number | string; image: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [menuOpen, setMenuOpen] = useState<'categories' | 'sort' | 'filter' | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const typeFilter = searchParams.get('type');
  const ratti = parseFloat(searchParams.get('ratti') || '0');
  const searchParam = (searchParams.get('search') || '').toLowerCase();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const typeMap: { [key: string]: string } = {
    ER: 'Earrings Collection',
    RG: 'Rings Collection',
    NK: 'Necklace Collection',
    PD: 'Pendants Collection',
    MG: 'Mangalsutra Collection',
    BG: 'Bangles Collection',
    BR: 'Bracelets Collection',
    CH: 'Chains Collection',
    NP: 'Nose Pins Collection',
    OT: 'Miscellaneous Collection',
    ST: 'Gemstones Strings Collection',
    LG: 'Loose Gemstones Collection',
  };

  const heading = (() => {
    if (searchParam) return `Search Results for "${searchParam}"`;
    if (typeFilter?.startsWith('LG-')) {
      const gem = typeFilter.replace('LG-', '');
      return ratti ? `${ratti} Ratti ${gem}` : `${gem} (Loose Gemstone)`;
    } else if (typeFilter && typeMap[typeFilter]) {
      return typeMap[typeFilter];
    } else {
      return 'All Collection';
    }
  })();

  const handleFilterClick = (type: string) => {
    router.push(`/catalog?type=${type}`);
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

          const filteredItems = allItems.filter(([key, value]) => {
            const remarks = (value.remarks || '').toLowerCase();
            const categoryOther = (value.jwelleryCategoryOther || '').toLowerCase();
            const containsSilver = remarks.includes('sil');
            const containsGemstone = remarks.includes('gemstone');

            if (searchParam) {
              return (
                key.toLowerCase().includes(searchParam) ||
                remarks.includes(searchParam) ||
                categoryOther.includes(searchParam)
              );
            }

            if (!typeFilter) return true;
            if (typeFilter === 'ST') return containsGemstone;
            if (typeFilter.startsWith('LG-')) {
              const desiredType = typeFilter.replace('LG-', '').toLowerCase();
              return categoryOther === desiredType;
            }
            if (typeFilter === 'SUT') {
  return remarks.includes('sil') && remarks.includes('utensil');
}

            if (typeFilter === 'SPF') {
  return remarks.includes('sil') && remarks.includes('frame');
}

if (typeFilter.startsWith('S')) {
  const goldType = typeFilter.substring(1).toLowerCase();
  return key.toLowerCase().includes(goldType) && containsSilver;
}


            return key.includes(typeFilter) && !containsSilver && !containsGemstone;
          });

          const items = await Promise.all(
            filteredItems.map(async ([key, value]) => {
              const imageUrl = imgData?.[key]?.Primary || '/product-placeholder.jpg';
              const rawPrice = value.grTotalPrice;
              const parsedPrice = typeof rawPrice === 'string' || typeof rawPrice === 'number'
                ? parseFloat(String(rawPrice))
                : NaN;
              const basePrice = !isNaN(parsedPrice) ? parsedPrice / 1.03 : null;

              const adjustedPrice = basePrice
                ? typeFilter?.startsWith('LG-') && ratti > 0
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
        }
        setLoading(false);
      });
    });

    return () => {
      window.removeEventListener('keydown', escHandler);
    };
  }, [typeFilter, sortOrder, searchParam, ratti]);

  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />
      <section>
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
        <button className={styles.footerButton} onClick={() => setMenuOpen(menuOpen === 'categories' ? null : 'categories')}>Categories</button>
        <button className={styles.footerButton} onClick={() => setMenuOpen(menuOpen === 'sort' ? null : 'sort')}>Sort</button>
        <button className={styles.footerButton} onClick={() => setMenuOpen(menuOpen === 'filter' ? null : 'filter')}>Filter</button>

        {menuOpen && (
          <div className={styles.popupMenu} id="footerMenuPopup" ref={menuRef}>
            {menuOpen === 'categories' && (
              <ul>
                {Object.entries(typeMap).map(([code, name]) => (
                  <li key={code} onClick={() => { handleFilterClick(code); setMenuOpen(null); }}>{name}</li>
                ))}
              </ul>
            )}
            {menuOpen === 'sort' && (
              <ul>
                <li onClick={() => { setSortOrder('asc'); setMenuOpen(null); }}>Price: Low to High</li>
                <li onClick={() => { setSortOrder('desc'); setMenuOpen(null); }}>Price: High to Low</li>
              </ul>
            )}
            {menuOpen === 'filter' && <div>Under Designing</div>}
          </div>
        )}
      </footer>
    </PageLayout>
  );
}
