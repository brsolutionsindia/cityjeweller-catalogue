'use client';
import styles from '../page.module.css';

export default function OfferBar({ goldRate, rateDate }: { goldRate: string, rateDate: string }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

  return isMobile ? (
    <div className={styles.horizontalScroll} style={{ marginTop: '1rem', paddingBottom: '0.5rem', borderRadius: '12px', backgroundColor: '#f3f3f3' }}>
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
        <span className={styles.goldLabel}>({rateDate})22kt Gold Rate:</span>
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
  );
}
