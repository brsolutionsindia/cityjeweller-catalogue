'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';
import Image from 'next/image';
import Link from 'next/link';

import {
  diamondItems,
  goldItems,
  silverItems,
  gemstoneItems,
  cvdItems,
  miscItems,
  type CatalogItem,
} from '../data/catalogMenu';

import PageLayout from './components/PageLayout';
import OfferBar from './components/OfferBar';
import OfferBarSilver from './components/OfferBarSilver';

import heroStyles from './hero.module.css';
import productStyles from './product.module.css';

function Card({ item }: { item: CatalogItem }) {
  const isDisabled = !!item.disabled;

  const inner = (
    <>
      <Image
        src={item.image}
        alt={item.label}
        width={160}
        height={160}
        className={productStyles.productImg}
      />
      <h4 className={productStyles.productLabel}>{item.label}</h4>
    </>
  );

  return (
    <div
      className={`${productStyles.productCardHorizontal} ${isDisabled ? productStyles.dimmed : ''}`}
      key={item.label}
      aria-disabled={isDisabled}
      // Fallback inline style in case some CSS is overridden
      style={isDisabled ? { opacity: 0.45, filter: 'grayscale(100%)' } : undefined}
    >
      {isDisabled ? inner : <Link href={item.link}>{inner}</Link>}
    </div>
  );
}

export default function Home() {
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [silverRate, setSilverRate] = useState('Loading...');

  useEffect(() => {
    const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const silRateRef = ref(db, 'Global SKU/Rates/Silver');
    const dateRef = ref(db, 'Global SKU/Rates/Date');
    onValue(rateRef, (s) => setGoldRate(s.val()));
    onValue(dateRef, (s) => setRateDate(s.val()));
    onValue(silRateRef, (s) => setSilverRate(s.val()));
  }, []);

  const renderRow = (items: CatalogItem[]) => (
    <div className={productStyles.catalogContainer}>
      <div className={productStyles.catalogSlider}>
        <div className={productStyles.horizontalScroll}>
          {items.map((item) => <Card key={item.label} item={item} />)}
        </div>
      </div>
    </div>
  );

  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />
      <OfferBarSilver silverRate={silverRate} rateDate={rateDate} />

<section className={heroStyles.hero}>
  <Link href="/rmr/registration">
    <Image
      src="/hero-banner.png"
      alt="Jewellery Banner"
      width={1200}
      height={400}
      className={heroStyles.heroImage}
      priority
    />
  </Link>
</section>


      <section id="cvd" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Loose Solitaire Diamonds</h2>
        {renderRow(cvdItems)}
      </section>

      <section id="catalogue" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Diamond Jewellery</h2>
        {renderRow(diamondItems)}
      </section>

      <section id="gold" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Gold Jewellery</h2>
        {renderRow(goldItems)}
      </section>

      <section id="silver" className={`${productStyles.catalogSection} ${productStyles.silverSection}`}>
        <h2 className={productStyles.sectionHeading}>Silver Store</h2>
        {renderRow(silverItems)}
      </section>

      <section id="gemstone" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Gemstones Jewellery</h2>
        {renderRow(gemstoneItems)}
      </section>

      <section id="miscItems" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Miscellaneous Items</h2>
        {renderRow(miscItems)}
      </section>
    </PageLayout>
  );
}
