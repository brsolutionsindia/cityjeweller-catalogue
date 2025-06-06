'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';
import Link from 'next/link';
import Image from 'next/image';

// Import individual module CSS files
import bannerStyles from './banner.module.css';
import footerStyles from './footer.module.css';
import heroStyles from './hero.module.css';
import navbarStyles from './navbar.module.css';
import productStyles from './product.module.css';
import './globals.css';

export default function Home() {
  const [goldRate, setGoldRate] = useState("Loading...");
  const [rateDate, setRateDate] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const dateRef = ref(db, 'Global SKU/Rates/Date');

    onValue(rateRef, (snapshot) => setGoldRate(snapshot.val()));
    onValue(dateRef, (snapshot) => setRateDate(snapshot.val()));

    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 600);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const productItems = [
    { label: 'Earrings', image: '/earrings.png', link: '/catalog?type=ER' },
    { label: 'Rings', image: '/rings.png', link: '/catalog?type=RG' },
    { label: 'Necklace Sets', image: '/necklace.png', link: '/catalog?type=NK' },
    { label: 'Pendants', image: '/pendants.png', link: '/catalog?type=PD' },
    { label: 'Mangalsutra', image: '/mangalsutra.png', link: '/catalog?type=MG' },
    { label: 'Bangles', image: '/bangles.png', link: '/catalog?type=BG' },
    { label: 'Bracelets', image: '/bracelets.png', link: '/catalog?type=BR' },
    { label: 'Chains', image: '/chains.png', link: '/catalog?type=CH' },
    { label: 'Nose Pins', image: '/nosepins.png', link: '/catalog?type=NP' },
    { label: 'Others', image: '/others.png', link: '/catalog?type=OT' }
  ];

  return (
    <main style={{ backgroundColor: '#fff', padding: '1rem' }}>
      {/* Navbar */}
      <nav className={`${navbarStyles.navbar} flex flex-wrap items-center justify-between gap-4`} style={{ borderRadius: '12px', padding: '1rem', backgroundColor: '#f9f9f9' }}>
        <div className={navbarStyles.branding}>
          <Image src="/logo.png" alt="Logo" width={80} height={30} className={navbarStyles.logoImg} />
        </div>
        <ul className={navbarStyles.navLinksScrollable}>
          <li><a href="#home" className="hover:underline">Home</a></li>
          <li><a href="#catalogue" className="hover:underline">Catalog</a></li>
          <li><a href="#contact" className="hover:underline">Contact</a></li>
        </ul>
      </nav>

      {/* Banner */}
      {isMobile ? (
        <div className={bannerStyles.horizontalScroll}>
          <div className={bannerStyles.productCardHorizontal}>
            <span className={bannerStyles.goldLabel}>({rateDate?.slice(0, 5)})22kt Gold Rate:</span>
            <span className={bannerStyles.goldRateText}>₹{goldRate}</span>
            <span className={bannerStyles.unitText}>/10gm</span>
            <a href="https://api.whatsapp.com/send?phone=919023130944&text=Hello%2C%20I%20am%20interested%20in%20learning%20more%20about%20your%20Digital%20Gold%20services.%20Please%20share%20the%20details." target="_blank" rel="noopener noreferrer" className={bannerStyles.bookGoldBtn}>Book</a>
          </div>
        </div>
      ) : (
        <section className={bannerStyles.offerBanner}>
          <div className={bannerStyles.offerContent}>
            <span className={bannerStyles.goldLabel}>({rateDate})22kt Rate:</span>
            <span className={bannerStyles.goldRateText}>₹{goldRate}</span>
            <span className={bannerStyles.unitText}>/10gm</span>
            <a href="https://api.whatsapp.com/send?phone=919023130944&text=Hello%2C%20I%20am%20interested%20in%20learning%20more%20about%20your%20Digital%20Gold%20services.%20Please%20share%20the%20details." target="_blank" rel="noopener noreferrer" className={bannerStyles.bookGoldBtn}>Book Digital Gold</a>
          </div>
        </section>
      )}

      {/* Hero */}
      <section className={heroStyles.hero}>
        <Image src="/hero-banner.png" alt="Jewellery Banner" width={1200} height={400} className={heroStyles.heroImage} />
      </section>

      {/* Product Grid */}
      <section id="catalogue" className={productStyles.catalogSection}>
        <div className={productStyles.catalogContainer}>
          <div className={productStyles.catalogBanner}>
            <Image src="/products-banner.png" alt="Product Banner" width={500} height={350} className={productStyles.bannerImage} />
          </div>
          <div className={productStyles.catalogSlider}>
            <div className={productStyles.horizontalScroll}>
              {productItems.map((item, index) => (
                <div key={index} className={productStyles.productCardHorizontal}>
                  <Link href={item.link}>
                    <Image src={item.image} alt={item.label} width={160} height={160} className={productStyles.productImg} />
                  </Link>
                  <h3 className={productStyles.productLabel}>{item.label}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={footerStyles.footer} id="contact">
        <p>📞 <a href="https://api.whatsapp.com/send?phone=919023130944&text=Hi%2C%20I%20was%20checking%20out%20your%20website%20and%20would%20like%20to%20know%20more%20details." target="_blank" rel="noopener noreferrer">+91-90231-30944</a></p>
        <div className={footerStyles.socialIcons}>
          <a href="https://www.facebook.com/cityJewellersIndia/" target="_blank" rel="noopener noreferrer">
            <img src="/facebook-icon.png" alt="Facebook" width="30" height="30" />
          </a>
        </div>
      </footer>

      {/* WhatsApp Floating */}
      <a href="https://api.whatsapp.com/send?phone=919023130944&text=Hi%2C%20I%20was%20checking%20out%20your%20website%20and%20would%20like%20to%20know%20more%20details." className={footerStyles.whatsappBtn} target="_blank" rel="noopener noreferrer">
        <Image src="/whatsapp-icon.png" alt="WhatsApp" width={100} height={60} style={{ objectFit: 'contain' }} />
      </a>
    </main>
  );
}
