'use client';
import styles from '../page.module.css';

export default function OfferBarSilver({ silverRate, rateDate }: { silverRate: string, rateDate: string }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;

  return isMobile ? (
    <div className={styles.horizontalScroll} style={{ marginTop: '1rem', paddingBottom: '0.5rem', borderRadius: '12px', backgroundColor: '#f3f3f3' }}>
      <div className={styles.productCardHorizontal}>
        <span className={styles.silverLabel}>({rateDate?.slice(0, 5)})Silver Rate:</span>
        <span className={styles.silverRateText}>₹{silverRate}</span>
        <span className={styles.unitText}>/10gm</span>
        <a
          href="https://api.whatsapp.com/send?phone=919023130944&text=Hello%2C%20I%20am%20interested%20in%20learning%20more%20about%20your%20Digital%20Silver%20services.%20Please%20share%20the%20details."
          target="_blank"
          rel="noopener noreferrer"
          className={styles.bookSilverBtn}
        >
          Book
        </a>
      </div>
    </div>
  ) : (
    <section className={styles.offerBanner} style={{ borderRadius: '12px', backgroundColor: '#f3f3f3' }}>
      <div className={styles.offerContent}>
        <span className={styles.silverLabel}>({rateDate})Silver Rate:</span>
        <span className={styles.silverRateText}>
  ₹{(parseFloat(silverRate) / 100).toFixed(0)}
</span>

        <span className={styles.unitText}>/10gm</span>
        <a
          href="https://api.whatsapp.com/send?phone=919023130944&text=Hello%2C%20I%20am%20interested%20in%20learning%20more%20about%20your%20Digital%20Silver%20services.%20Please%20share%20the%20details."
          target="_blank"
          rel="noopener noreferrer"
          className={styles.bookSilverBtn}
        >
          Book Digital Silver
        </a>
      </div>
    </section>
  );
}
