'use client';

import Image from 'next/image';
import styles from '../footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer} id="contact">
      <p>📞 <a href="https://api.whatsapp.com/send?phone=919023130944&text=Hi%2C%20I%20was%20checking%20out%20your%20website%20and%20would%20like%20to%20know%20more%20details." target="_blank" rel="noopener noreferrer">+91-90231-30944</a></p>
      <div className={styles.socialIcons}>
        <a href="https://www.facebook.com/cityJewellersIndia/" target="_blank" rel="noopener noreferrer" className={styles.iconCircle}>
          <Image src="/facebook-icon.png" alt="Facebook" width={30} height={30} />
        </a>
      </div>
    </footer>
  );
}
