'use client';

import Image from 'next/image';
import styles from '../footer.module.css';

export default function WhatsAppButton() {
  return (
    <a href="https://api.whatsapp.com/send?phone=919023130944&text=Hi%2C%20I%20was%20checking%20out%20your%20website%20and%20would%20like%20to%20know%20more%20details."className={styles.whatsappBtn} target="_blank" rel="noopener noreferrer">
      <Image src="/whatsapp-icon.png" alt="WhatsApp" width={100} height={60} style={{ objectFit: "contain" }} />
    </a>
  );
}
