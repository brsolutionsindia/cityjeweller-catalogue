'use client';
import styles from '../page.module.css';
import Link from 'next/link';

export default function OfferBar({ goldRate, rateDate }: { goldRate: string, rateDate: string }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

  const RateTag = (
    <>
      <span className={styles.goldLabel}>({isMobile ? rateDate?.slice(0, 5) : rateDate}) 22kt Gold Rate:</span>
      <span className={styles.goldRateText}>₹{goldRate}</span>
      <span className={styles.unitText}>/10gm</span>
    </>
  );

  return isMobile ? (
    <div className={styles.horizontalScroll} style={{ marginTop: '1rem', paddingBottom: '0.5rem', borderRadius: '12px', backgroundColor: '#f3f3f3' }}>
      <div className={styles.productCardHorizontal}>
        {RateTag}
        <Link href="/digital-gold" className={styles.bookGoldBtn} aria-label="Open Digital Gold page">
          Book
        </Link>
      </div>
    </div>
  ) : (
    <section className={styles.offerBanner} style={{ borderRadius: '12px', backgroundColor: '#f3f3f3' }}>
      <div className={styles.offerContent}>
        {RateTag}
        <Link href="/digital-gold" className={styles.bookGoldBtn} aria-label="Open Digital Gold page">
          Book Digital Gold
        </Link>
      </div>
    </section>
  );
}
