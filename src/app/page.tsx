'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';
import Image from 'next/image';
import Link from 'next/link';
import { diamondItems, goldItems, silverItems, gemstoneItems, cvdItems, miscItems } from '../data/catalogMenu';

import PageLayout from './components/PageLayout';
import OfferBar from './components/OfferBar';
import OfferBarSilver from './components/OfferBarSilver';


import heroStyles from './hero.module.css';
import productStyles from './product.module.css';

export default function Home() {
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');
  const [silverRate, setSilverRate] = useState('Loading...');

  useEffect(() => {
    const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const silRateRef = ref(db, 'Global SKU/Rates/Silver');
    const dateRef = ref(db, 'Global SKU/Rates/Date');
    onValue(rateRef, (snapshot) => setGoldRate(snapshot.val()));
    onValue(dateRef, (snapshot) => setRateDate(snapshot.val()));
    onValue(silRateRef, (snapshot) => setSilverRate(snapshot.val()));

  }, []);

  return (
    <PageLayout>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />
      <OfferBarSilver silverRate={silverRate} rateDate={rateDate} />


      {/* Hero */}
      <section className={heroStyles.hero}>
        <Image src="/hero-banner.png" alt="Jewellery Banner" width={1200} height={400} className={heroStyles.heroImage} />
      </section>

      {/*Diamond */}
      <section id="catalogue" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Diamond Jewellery</h2>
        <div className={productStyles.catalogContainer}>
          <div className={productStyles.catalogSlider}>
            <div className={productStyles.horizontalScroll}>
              {diamondItems.map(item => (
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

      {/*Gold */}
      <section id="gold" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Gold Jewellery</h2>
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
        <h2 className={productStyles.sectionHeading}>Loose Solitaire Diamonds</h2>
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

      {/* MISC Items*/}
      <section id="miscItems" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Miscellaneous Items</h2>
        <div className={productStyles.catalogContainer}>
          <div className={productStyles.catalogSlider}>
            <div className={productStyles.horizontalScroll}>
              {miscItems.map(item => (
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
