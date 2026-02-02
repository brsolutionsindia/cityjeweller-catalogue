import Image from 'next/image';
import Link from 'next/link';

import TrustInfoStrip from './components/TrustInfoStrip';
import PageLayout from './components/PageLayout';
import LiveRates from './components/LiveRates';

import {
  diamondItems,
  goldItems,
  goldCollections,
  silverItems,
  gemstoneItems,
  cvdItems,
  miscItems,
  type CatalogItem,
} from '../data/catalogMenu';

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
      aria-disabled={isDisabled}
      style={isDisabled ? { opacity: 0.45, filter: 'grayscale(100%)' } : undefined}
    >
      {isDisabled ? inner : <Link href={item.link}>{inner}</Link>}
    </div>
  );
}

export default function Home() {
  const renderRow = (items: CatalogItem[]) => (
    <div className={productStyles.catalogContainer}>
      <div className={productStyles.catalogSlider}>
        <div className={productStyles.horizontalScroll}>
          {items.map((item) => (
            <Card key={item.label} item={item} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <PageLayout>
      {/* ✅ Client component: loads rates without turning the whole page client */}
      <LiveRates />

      <section className={heroStyles.hero}>
        <Link href="/catalog/solitaireRG">
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
        <h2 className={productStyles.sectionHeading}>Solitaires</h2>
        {renderRow(cvdItems)}
      </section>

      <section id="goldCollections" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Collections</h2>
        {renderRow(goldCollections)}
      </section>

      <section id="catalogue" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Diamonds</h2>
        {renderRow(diamondItems)}
      </section>

      <section id="gold" className={productStyles.catalogSection}>
        <h2 className={productStyles.sectionHeading}>Gold</h2>
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

      <TrustInfoStrip />
    </PageLayout>
  );
}
