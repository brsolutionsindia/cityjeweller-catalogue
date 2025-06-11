'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';
import Image from 'next/image';
import Link from 'next/link';
import { goldItems, silverItems, gemstoneItems, cvdItems } from '../data/catalogMenu';

import PageLayout from './components/PageLayout';
import OfferBar from './components/OfferBar';

import heroStyles from './hero.module.css';
import productStyles from './product.module.css';

export default function Home() {
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');

  useEffect(() => {
    const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const dateRef = ref(db, 'Global SKU/Rates/Date');
    onValue(rateRef, (snapshot) => setGoldRate(snapshot.val()));
    onValue(dateRef, (snapshot) => setRateDate(snapshot.val()));
  }, []);

  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />

      {/* Hero */}
      <section className={heroStyles.hero}>
        <Image src="/hero-banner.png" alt="Jewellery Banner" width={1200} height={400} className={heroStyles.heroImage} />
      </section>

      {/* Gold & Diamond */}
      <section id="catalogue" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Gold & Diamond</h2>
        <div className={productStyles.catalogContainer}>
          <div className={productStyles.catalogSlider}>
            <div className={productStyles.horizontalScroll}>
              {goldItems.map(item => (
                <div className={productStyles.productCardHorizontal} key={item.label}>
                  <Link href={item.link}>
                    <Image src={item.image} alt={item.label} width={160} height={160} className={productStyles.productImg} />
                    <h4 className={productStyles.productLabel}>{item.label}</h4>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Silver */}
      <section id="silver" className={`${productStyles.catalogSection} ${productStyles.silverSection}`}>
        <h2 className={productStyles.sectionHeading}>Silver Store</h2>
        <div className={productStyles.catalogContainer}>
          <div className={productStyles.catalogSlider}>
            <div className={productStyles.horizontalScroll}>
              {silverItems.map(item => (
                <div className={productStyles.productCardHorizontal} key={item.label}>
                  <Link href={item.link}>
                    <Image src={item.image} alt={item.label} width={160} height={160} className={productStyles.productImg} />
                    <h4 className={productStyles.productLabel}>{item.label}</h4>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Gemstones */}
      <section id="gemstone" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Gemstones Jewellery</h2>
        <div className={productStyles.catalogContainer}>
          <div className={productStyles.catalogSlider}>
            <div className={productStyles.horizontalScroll}>
              {gemstoneItems.map(item => (
                <div className={productStyles.productCardHorizontal} key={item.label}>
                  <Link href={item.link}>
                    <Image src={item.image} alt={item.label} width={160} height={160} className={productStyles.productImg} />
                    <h4 className={productStyles.productLabel}>{item.label}</h4>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CVD*/}
      <section id="cvd" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Lab Grown Diamonds</h2>
        <div className={productStyles.catalogContainer}>
          <div className={productStyles.catalogSlider}>
            <div className={productStyles.horizontalScroll}>
              {cvdItems.map(item => (
                <div className={productStyles.productCardHorizontal} key={item.label}>
                  <Link href={item.link}>
                    <Image src={item.image} alt={item.label} width={160} height={160} className={productStyles.productImg} />
                    <h4 className={productStyles.productLabel}>{item.label}</h4>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>




    </PageLayout>
  );
}
