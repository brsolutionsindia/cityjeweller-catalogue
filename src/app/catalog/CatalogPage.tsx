'use client';

import { useEffect, useState, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebaseConfig';
import Image from 'next/image';
import styles from '../page.module.css';
import { useSearchParams, useRouter } from 'next/navigation';
import SkuSummaryModal from '../components/SkuSummaryModal';
import Link from 'next/link';

export default function CatalogPage() {
  type SkuData = {
    grTotalPrice?: number;
  };

  const [products, setProducts] = useState<{ id: string; price: number | string; image: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [menuOpen, setMenuOpen] = useState<'categories' | 'sort' | 'filter' | null>(null);

  const searchParams = useSearchParams();
  const typeFilter = searchParams.get('type');
  const router = useRouter();

  const typeMap: { [key: string]: string } = {
    ER: 'Earrings Collection',
    RG: 'Rings Collection',
    NK: 'Necklace Collection',
  };

  const heading = typeFilter && typeMap[typeFilter] ? typeMap[typeFilter] : 'All Collection';
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleFilterClick = (type: string) => {
    router.push(`/catalog?type=${type}`);
  };

  useEffect(() => {
    const skuRef = ref(db, 'Global SKU/SKU/');
    const imgRef = ref(db, 'Global SKU/Images/');
    const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const dateRef = ref(db, 'Global SKU/Rates/Date');

    onValue(rateRef, (snapshot) => setGoldRate(snapshot.val()));
    onValue(dateRef, (snapshot) => setRateDate(snapshot.val()));

    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 600);
    };

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(null);
    };
    window.addEventListener('keydown', escHandler);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    onValue(skuRef, (skuSnap) => {
      const skuData = skuSnap.val();
      onValue(imgRef, async (imgSnap) => {
        const imgData = imgSnap.val();
        if (skuData) {
          const allItems = Object.entries(skuData) as [string, SkuData][];
          const filteredItems = allItems.filter(([key]) => {
            if (!typeFilter) return true;
            return key.includes(typeFilter);
          });

          const items = await Promise.all(
            filteredItems.map(async ([key, value]) => {
              const imageUrl = imgData?.[key]?.Primary || '/product-placeholder.jpg';
              return {
                id: key,
                price: value?.grTotalPrice || 'N/A',
                image: imageUrl,
              };
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
      window.removeEventListener('resize', checkScreenSize);
      window.removeEventListener('keydown', escHandler);
    };
  }, [typeFilter, sortOrder]);

  return (
    <main className={styles.main} id="home">
      <nav 
      className={`${styles.navbar} flex flex-wrap items-center justify-between gap-4`} 
      style={{ borderRadius: '12px', padding: '1rem', backgroundColor: '#f9f9f9' }}
      >
        <div className={styles.branding}>
          <Image src="/logo.png" alt="Logo" width={80} height={30} className={styles.logoImg} />
        </div>
        <ul className={`${styles.navLinksScrollable}`}>
          <li><Link href="/#home" className="hover:underline">Home</Link></li>
          <li><Link href="/#catalogue" className="hover:underline">Catalog</Link></li>
          <li><Link href="/#testimonials" className="hover:underline">Testimonials</Link></li>
          <li><Link href="/#contact" className="hover:underline">Contact</Link></li>
        </ul>
      </nav>

{/* Offer Banner */}
      {/* isMobile is to be ignored here*/}
      {/* isMobile is to be ignored here*/}

      {isMobile? (
        <div className={styles.horizontalScroll} style={{ marginTop: '1rem', paddingBottom: '0.5rem', borderRadius: '12px', backgroundColor: '#f3f3f3'}}>
          <div className={styles.productCardHorizontal}>
            <span className={styles.goldLabel}>({rateDate?.slice(0, 5)})22kt Gold Rate:</span>
            <span className={styles.goldRateText}>₹{goldRate}</span>
            <span className={styles.unitText}>/10gm</span>
            <a
              href="https://api.whatsapp.com/send?phone=919023130944&text=Hello%2C%20I%20am%20interested%20in%20learning%20more%20about%20your%20Digital%20Gold%20services.%20Please%20share%20the%20details."
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bookGoldBtn}
            >
              Book
            </a>
          </div>
        </div>
      ) : (
        <section className={styles.offerBanner} style={{ borderRadius: '12px', backgroundColor: '#f3f3f3' }}>
          <div className={styles.offerContent}>
            <span className={styles.goldLabel}>
            ({rateDate})22kt Rate:
            </span>
            <span className={styles.goldRateText}>₹{goldRate}</span>
            <span className={styles.unitText}>/10gm</span>
            <a
              href="https://api.whatsapp.com/send?phone=919023130944&text=Hello%2C%20I%20am%20interested%20in%20learning%20more%20about%20your%20Digital%20Gold%20services.%20Please%20share%20the%20details."
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bookGoldBtn}
            >
              Book Digital Gold
            </a>
          </div>
        </section>
      )}

{/* Catalog Grid */}
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
                <li onClick={() => { handleFilterClick(''); setMenuOpen(null); }}>All</li>
                <li onClick={() => { handleFilterClick('ER'); setMenuOpen(null); }}>Earrings</li>
                <li onClick={() => { handleFilterClick('RG'); setMenuOpen(null); }}>Rings</li>
                <li onClick={() => { handleFilterClick('NK'); setMenuOpen(null); }}>Necklaces</li>
              </ul>
            )}
            {menuOpen === 'sort' && (
              <ul>
                <li onClick={() => { setSortOrder('asc'); setMenuOpen(null); }}>Price: Low to High</li>
                <li onClick={() => { setSortOrder('desc'); setMenuOpen(null); }}>Price: High to Low</li>
              </ul>
            )}
            {menuOpen === 'filter' && (
              <div>Under Designing</div>
            )}
          </div>
        )}
      </footer>
    </main>
  );
}