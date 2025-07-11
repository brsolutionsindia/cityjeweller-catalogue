'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import Image from 'next/image';
import styles from '../../page.module.css';
import SkuSummaryModal from '../../components/SkuSummaryModal';
import PageLayout from '../../components/PageLayout';
import OfferBarSilver from '../../components/OfferBarSilver';
import { filterSilverItems } from './filters';
import { computeAdjustedPrice } from '../utils';

interface RawSkuData {
  grTotalPrice?: number | string;
  remarks?: string;
  jwelleryCategoryOther?: string;
  goldPurety?: string;
}

export default function SilverCatalog() {
  const searchParams = useSearchParams();
  const router = useRouter();
const typeFilter = searchParams?.get?.('type') ?? '';
const searchParam = (searchParams?.get?.('search') ?? '').toLowerCase();

  const [silverRate, setSilverRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [products, setProducts] = useState<{ id: string; price: number | string; image: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedPurity, setSelectedPurity] = useState('');
  const [selectedPriceRange, setSelectedPriceRange] = useState<[number, number | null] | null>(null);


  const typeMap: { [key: string]: string } = {
    SRK: 'Silver Rakhi',
    SBL: 'Silver Bracelet',
    SUT: 'Silver Utensils',
    SPF: 'Silver Photo Frames',
    SID: 'Silver Idols',
    SDC: 'Silver Decor',
    SAQ: 'Silver Antique',
    SDS: 'Silver Dinner Set',
    SDF: 'Silver Dry Fruit Bowl',
    SGL: 'Silver Glass',
    SKD: 'Silver Kids Items',
    SPL: 'Silver Plates',
    SSD: 'Silver Sindoor Dibbi',
    SSN: 'Silver Sinhaasan',
    STR: 'Silver Tray',
    SWC: 'Silver Wedding Card',
    SPY: 'Silver Payal',
    SRG: 'Silver Rings',
    SOT: 'Silver Kada',
    SBR: 'Silver Nazariye',
    SPD: 'Silver Pendants',
  };

  const heading = (() => {
    if (searchParam) return `Search Results for "${searchParam}"`;
    if (typeFilter && typeMap[typeFilter]) return typeMap[typeFilter];
    return 'Silver Collection';
  })();

  const priceRanges: [number, number | null][] = [
    [0, 3000], [3000, 10000], [10000, 20000], [20000, 50000], [50000, 100000], [100000, null]
  ];

  useEffect(() => {
    const rateRef = ref(db, 'Global SKU/Rates/Silver');
    const dateRef = ref(db, 'Global SKU/Rates/Date');
    onValue(rateRef, (snapshot) => setSilverRate(snapshot.val()));
    onValue(dateRef, (snapshot) => setRateDate(snapshot.val()));
  }, []);

  useEffect(() => {
    const skuRef = ref(db, 'Global SKU/SKU/');
    const imgRef = ref(db, 'Global SKU/Images/');

    onValue(skuRef, (skuSnap) => {
      const skuData = skuSnap.val();

      // Collect unique categories
      const categorySet = new Set<string>();
Object.values(skuData || {}).forEach((item) => {
  const castedItem = item as RawSkuData;
  const remarks = (castedItem?.remarks || '').toLowerCase();
  const category = castedItem?.jwelleryCategoryOther?.toLowerCase();
  if (remarks.includes('silver') && category) {
    categorySet.add(category);
  }
});

      setAvailableCategories([...categorySet].sort());

      onValue(imgRef, async (imgSnap) => {
        const imgData = imgSnap.val();
        if (!skuData) return;

        const allItems = Object.entries(skuData) as [string, RawSkuData][];
        const filteredItems = allItems.filter(([key, value]) =>
          filterSilverItems(key, value, searchParam, typeFilter)
        ).filter(([, value]) => {
          const isSilver = (value.remarks || '').toLowerCase().includes('sil');
          if (selectedCategory && (!isSilver || value.jwelleryCategoryOther?.toLowerCase() !== selectedCategory)) return false;
if (selectedPurity && (!isSilver || value.goldPurety !== selectedPurity)) return false;

          if (selectedPriceRange) {
            const price = computeAdjustedPrice(value.grTotalPrice);
            if (typeof price !== 'number') return false;
            const [min, max] = selectedPriceRange;
            if (price < min) return false;
            if (max !== null && price > max) return false;
          }
          return true;
        });

        const items = await Promise.all(
          filteredItems.map(async ([key, value]) => {
            const imageUrl = imgData?.[key]?.Primary || '/product-placeholder.jpg';
            const adjustedPrice = computeAdjustedPrice(value.grTotalPrice);
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
  }, [searchParam, sortOrder, typeFilter, selectedCategory, selectedPurity, selectedPriceRange]);

  return (
    <PageLayout>

{/* YouTube Shorts Embed with Height Limit */}
  <section style={{ maxWidth: '560px', margin: '1rem auto' }}>
    <div style={{
      position: 'relative',
      width: '100%',
      height: '400px', // ✅ Set your desired height here
      overflow: 'hidden',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <iframe
        src="https://www.youtube.com/embed/F57sLhe0M0A"
        title="Rakhi Collection"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      ></iframe>
    </div>
  </section>

      <OfferBarSilver silverRate={silverRate} rateDate={rateDate} />
      <section>
        <h1 style={{ paddingLeft: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>{heading}</h1>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '1rem auto', gap: '0.75rem', maxWidth: '960px'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem' }}>

            <select
  onChange={(e) => {
    const newCat = e.target.value.toLowerCase();
    setSelectedCategory(newCat);
    setSelectedPurity('');
    setSelectedPriceRange(null);
    router.push('/catalog/silver'); // reset typeFilter & searchParams if needed
  }}
  value={selectedCategory}
>


              <option value=''>All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>

<select
  onChange={(e) => setSelectedPurity(e.target.value)}
  value={selectedPurity}
>
  <option value=''>All Purity</option>
  {['92.5', '99.0'].map(purity => (
    <option key={purity} value={purity}>{purity}</option>
  ))}
</select>

            {priceRanges.map(([min, max], index) => (
              <button
                key={index}
                style={{
                  padding: '0.3rem 0.75rem', borderRadius: '999px', border: '1px solid #ccc',
                  background: selectedPriceRange?.[0] === min ? '#444' : '#fff',
                  color: selectedPriceRange?.[0] === min ? '#fff' : '#000', cursor: 'pointer'
                }}
                onClick={() => setSelectedPriceRange([min, max])}
              >
                ₹{min.toLocaleString()} - {max ? `₹${max.toLocaleString()}` : 'up'}
              </button>
            ))}
          </div>

          {(selectedCategory || selectedPurity || selectedPriceRange) && (
            <button
              onClick={() => {
                setSelectedCategory('');
                setSelectedPurity('');
                setSelectedPriceRange(null);
              }}
              style={{
                marginTop: '0.5rem', backgroundColor: '#f44336', color: '#fff',
                border: 'none', borderRadius: '4px', padding: '0.4rem 1rem', cursor: 'pointer'
              }}
            >
              Clear All Filters
            </button>
          )}
        </div>

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
    </PageLayout>
  );
}
