'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import Image from 'next/image';
import styles from '../../page.module.css';
import { useSearchParams } from 'next/navigation';
import SkuSummaryModal from '../../components/SkuSummaryModal';
import PageLayout from '../../components/PageLayout';
import OfferBar from '../../components/OfferBar';
import { computeAdjustedPrice } from '../utils';
import { filterSolitaireRings, RawSkuData } from './filters';

type ProductCard = {
  id: string;
  price: number | string;
  image: string;
  remarksLower?: string;
};

const NATURAL_ROUTE = '/catalog/naturalD';
const LABGROWN_ROUTE = '/catalog/labgrown';

export default function GoldCatalog() {
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const searchParam = (searchParams?.get?.('search') ?? '').toLowerCase();

  const heading = useMemo(() => {
    if (searchParam) return `Solitaire Rings — search: "${searchParam}"`;
    return 'Solitaire Rings Collection';
  }, [searchParam]);

  // rates header
  useEffect(() => {
    const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const dateRef = ref(db, 'Global SKU/Rates/Date');
    const un1 = onValue(rateRef, (snapshot) => setGoldRate(snapshot.val()));
    const un2 = onValue(dateRef, (snapshot) => setRateDate(snapshot.val()));
    return () => { un1(); un2(); };
  }, []);

  // fetch & filter SKUs + images
  useEffect(() => {
    const skuRef = ref(db, 'Global SKU/SKU/');
    const imgRef = ref(db, 'Global SKU/Images/');

    const unsub = onValue(skuRef, (skuSnap) => {
      const skuData = skuSnap.val();
      onValue(imgRef, async (imgSnap) => {
        const imgData = imgSnap.val();
        if (!skuData) {
          setProducts([]);
          setLoading(false);
          return;
        }

        const allItems = Object.entries(skuData) as [string, RawSkuData][];
        const filteredItems = allItems.filter(([key, value]) =>
          filterSolitaireRings(key, value, searchParam)
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

    return () => unsub();
  }, [searchParam, sortOrder]);

  const FindYourDiamondSection = () => (
    <section className="my-10 rounded-2xl border border-neutral-200 bg-white/70 p-5 md:p-6 text-center md:text-left">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold">Find Your Diamond</h2>
          <p className="text-sm text-neutral-600">
            We list certified Natural & Lab-Grown diamonds from multiple trusted suppliers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto">
          <Link
            href={NATURAL_ROUTE}
            className="group rounded-xl px-5 py-3 text-center border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition"
          >
            <span className="block font-medium">Choose Natural Diamond</span>
            <span className="block text-xs text-emerald-800/80 group-hover:text-emerald-900">
              GIA / IGI certified options
            </span>
          </Link>

          <Link
            href={LABGROWN_ROUTE}
            className="group rounded-xl px-5 py-3 text-center border border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
          >
            <span className="block font-medium">Choose Lab-Grown Diamond</span>
            <span className="block text-xs text-blue-800/80 group-hover:text-blue-900">
              Best value, certified pieces
            </span>
          </Link>
        </div>
      </div>
    </section>
  );

  const CatalogGrid = ({ list }: { list: ProductCard[] }) => {
    const firstBatch = list.slice(0, 30);
    const remaining = list.slice(30);

    return (
      <section className={styles.catalogGridWrapper}>
        <div className={styles.catalogGrid}>
          {firstBatch.map((item) => (
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
        </div>

        {/* Insert the chooser section after 30 items */}
        {list.length > 30 && <FindYourDiamondSection />}

        <div className={styles.catalogGrid}>
          {remaining.map((item) => (
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
        </div>
      </section>
    );
  };

  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center py-2 rounded mb-4">
        Prices shown are for gold ring mount only — <b>solitaire diamond cost is not included.</b>
      </div>

      <section>
        <h1>{heading}</h1>
        <p className={styles.itemCount}>{products.length} item(s)</p>

        {loading ? <p>Loading...</p> : <CatalogGrid list={products} />}
      </section>

      {selectedSku && (
        <SkuSummaryModal skuId={selectedSku} onClose={() => setSelectedSku(null)} />
      )}
    </PageLayout>
  );
}
