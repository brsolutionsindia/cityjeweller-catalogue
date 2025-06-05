'use client';

import styles from './page.module.css';
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';

export default function Home() {
  const [goldRate, setGoldRate] = useState("Loading...");
  const [rateDate, setRateDate] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const rateRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const dateRef = ref(db, 'Global SKU/Rates/Date');

    onValue(rateRef, (snapshot) => {
      const rate = snapshot.val();
      setGoldRate(rate);
    });

    onValue(dateRef, (snapshot) => {
      const date = snapshot.val();
      setRateDate(date);
    });
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 600);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  const productItems = [
    { label: 'Earrings', image: '/earrings.png', link: '/catalog?type=ER' },
    { label: 'Rings', image: '/rings.png', link: '/catalog?type=RG' },
    { label: 'Necklace Sets', image: '/necklace.png', link: '/catalog?type=NK' }
  ];

  const videoItems = [
    { label: 'Personalised Pendants', image: 'https://img.youtube.com/vi/9c8AfNQazzg/hqdefault.jpg', link: 'https://youtu.be/9c8AfNQazzg', isExternal: true },
    { label: 'Customized Jewellery', image: 'https://img.youtube.com/vi/l9BPespAnZA/hqdefault.jpg', link: 'https://youtu.be/l9BPespAnZA?si=ngBlVQglC_T2d7V4', isExternal: true },
    { label: 'Personalized Silver Rakhi', image: 'https://img.youtube.com/vi/F57sLhe0M0A/hqdefault.jpg', link: 'https://www.youtube.com/shorts/F57sLhe0M0A', isExternal: true }
  ];

  return (
    <main className={styles.main} id="home" style={{ backgroundColor: '#fff', padding: '1rem' }}>
      <nav
        className={`${styles.navbar} flex flex-wrap items-center justify-between gap-4`}
        style={{
          borderRadius: '12px',
          padding: '1rem',
          backgroundColor: '#f9f9f9',
        }}
      >
        {/* Logo Section */}
        <div className={styles.branding}>
          <Image src="/logo.png" alt="Logo" width={80} height={30} className={styles.logoImg} />
        </div>

        {/* Navigation Links */}
        <ul className={`${styles.navLinksScrollable}`}>
          <li><a href="#home" className="hover:underline">Home</a></li>
          <li><a href="#catalogue" className="hover:underline">Catalog</a></li>
          <li><a href="#testimonials" className="hover:underline">Testimonials</a></li>
          <li><a href="#contact" className="hover:underline">Contact</a></li>
        </ul>
      </nav>

      {/* Offer Banner or Horizontal Scroll */}
      {/* isMobile is to be ignored here*/}

      {isMobile? (
        <div className={styles.horizontalScroll} style={{ marginTop: '1rem', paddingBottom: '0.5rem', borderRadius: '12px', backgroundColor: '#f3f3f3'}}>
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
            <span className={styles.goldLabel}>
            ({rateDate})22kt Rate:
            </span>
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
      )}

      {/* Hero */}
      <section className={styles.hero} style={{ borderRadius: '12px', marginTop: '1rem', overflow: 'hidden' }}>
        <Image src="/hero-banner.png" alt="Jewellery Banner" width={1200} height={400} className={styles.heroImage} />
      </section>

      {/* Product Grid */}
      <section id="catalogue" className={styles.catalogSection} style={{ borderRadius: '12px', marginTop: '1rem', padding: '1rem', backgroundColor: '#fff8e7' }}>
        <div className={styles.catalogContainer}>
          <div className={styles.catalogBanner}><Image src="/products-banner.png" alt="Product Banner" width={500} height={350} className={styles.bannerImage} /></div>
          <div className={styles.catalogSlider}>
            <div className={styles.horizontalScroll}>
              {productItems.map((item, index) => (
                <div key={index} className={styles.productCardHorizontal}>
                  <Link href={item.link}><Image src={item.image} alt={item.label} width={160} height={160} className={styles.productImg} /></Link>
                  <h3 className={styles.productLabel}>{item.label}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Videos */}
      <section className={styles.videoSection} style={{ borderRadius: '12px', marginTop: '1rem', padding: '1rem', backgroundColor: '#f9f9f9' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '1rem', color: '#cc8c23' }}>Videos</h2>
        <div className={styles.videoGrid}>
          {videoItems.map((item, index) => (
            <div key={index} className={styles.productCard}>
              <a href={item.link} target="_blank" rel="noopener noreferrer">
                <div className={styles.thumbnailWrapper}>
                  <Image src={item.image} alt={item.label} width={200} height={200} style={{ objectFit: 'cover', borderRadius: '10px' }} />
                  <span className={styles.playIcon}>▶️</span>
                </div>
              </a>
              <h3>{item.label}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className={styles.testimonials} id="testimonials" style={{ borderRadius: '12px', marginTop: '1rem', padding: '1rem', backgroundColor: '#f3f3f3' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '1rem' }}>What Our Customers Say</h2>
        <div className={styles.googleReview}><Image src="/googlereviews-icon.png" alt="Google Reviews" width={28} height={28} /><span style={{ marginLeft: '8px' }}><strong>4.7/5</strong> based on customer reviews</span><a href="https://g.page/r/CRRKnpgHPMkCEB0/review" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '12px', backgroundColor: '#cc8c23', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '0.9rem', textDecoration: 'none' }}>Read & Rate Us ⭐</a></div>
        <div className={styles.testimonialCards}><blockquote>“Excellent experience. Fast service. Mr Rawat is very very reliable and he helped me choosing the right gem with right size. Thank you so much Mr Rawat. Will surely bother you again. - Kapil A.”</blockquote><blockquote>“Awesome quality.. Rawat Jewellers customized the product beautifully even way better than the given design.. Thanks.. I had an excellent experience.. Highly recommended.. - S. Gill”</blockquote></div>
      </section>


      {/* Footer */}
      <footer className={styles.footer} id="contact" style={{ borderRadius: '12px', marginTop: '1rem', padding: '1rem', backgroundColor: '#f3f3f3' }}>
        <p>📍 <a href="https://maps.app.goo.gl/kPp2ZNTVFte1LHt66" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>Booth No 261, Sector 37-C, Chandigarh</a></p>
        <p>📞 <a href="https://api.whatsapp.com/send?phone=919023130944&text=Hi%2C%20I%20was%20checking%20out%20your%20website%20and%20would%20like%20to%20know%20more%20details." target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>+91-90231-30944</a> &nbsp;| 🕒 11:00 AM – 8:00 PM (Sunday Closed)</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem' }}>
          <a href="https://maps.app.goo.gl/kPp2ZNTVFte1LHt66" target="_blank" rel="noopener noreferrer"><Image src="/gmaps-icon.png" alt="G-Maps" width="30" height="30" /></a>
          <a href="https://www.facebook.com/rawatgemsjewellers" target="_blank" rel="noopener noreferrer"><img src="/facebook-icon.png" alt="Facebook" width="30" height="30" /></a>
          <a href="https://www.instagram.com/rawatgemsjewellers/" target="_blank" rel="noopener noreferrer"><img src="/instagram-icon.png" alt="Instagram" width="30" height="30" /></a>
        </div>
      </footer>

      {/* WhatsApp Floating */}
      <a href="https://api.whatsapp.com/send?phone=919023130944&text=Hi%2C%20I%20was%20checking%20out%20your%20website%20and%20would%20like%20to%20know%20more%20details." className={styles.whatsappBtn} target="_blank" rel="noopener noreferrer">
        <Image src="/whatsapp-icon.png" alt="WhatsApp" width={100} height={60} style={{ objectFit: 'contain' }} />
      </a>
    </main>
  );
}
