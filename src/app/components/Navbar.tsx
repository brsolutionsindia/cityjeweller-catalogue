'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from '../navbar.module.css';
import { diamondItems, goldItems, silverItems, gemstoneItems, cvdItems, miscItems } from '../../data/catalogMenu';

/** ✅ This child is the only place that uses useSearchParams() */
function QuoteParamListener({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const quote = searchParams?.get('getquote');
    if (quote === '1') onOpen();
    // optional: you can also remove param via router.replace if you want
  }, [searchParams, onOpen]);

  return null;
}


export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  // ✅ Get Quote modal state
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [designLink, setDesignLink] = useState('');

  const menuRef = useRef<HTMLDivElement | null>(null);
  const quoteRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const WHATSAPP_NUMBER = '919023130944'; // +91 9023130944

  const openQuote = useCallback(() => setQuoteOpen(true), []);

  // Close dropdown menu when clicked outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close quote modal on outside click + ESC
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (quoteOpen && quoteRef.current && !quoteRef.current.contains(e.target as Node)) {
        setQuoteOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (quoteOpen && e.key === 'Escape') setQuoteOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [quoteOpen]);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchText.trim()) {
      router.push(`/search?query=${encodeURIComponent(searchText.trim())}`);
      setSearchText('');
    }
  };

  // ✅ WhatsApp actions
  const openWhatsappWithLink = () => {
    const link = designLink.trim();
    if (!link) return;

    const msg = `Hi! I want a quote for this design:\n${link}`;
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setDesignLink('');
    setQuoteOpen(false);
  };

  const openWhatsappForPhoto = () => {
    const msg = `Hi! I want a quote. I will share the design photo here.`;
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setDesignLink('');
    setQuoteOpen(false);
  };

  return (
    <nav
      className={`${styles.navbar} flex items-center justify-between gap-4`}
      style={{ borderRadius: '12px', padding: '1rem', backgroundColor: '#f9f9f9' }}
    >
      {/* ✅ Wrap the listener in Suspense */}
      <Suspense fallback={null}>
        <QuoteParamListener onOpen={openQuote} />
      </Suspense>

      {/* Hamburger Icon */}
      <div style={{ cursor: 'pointer' }} onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">
        <div className={styles.hamburgerIcon}>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
        </div>
      </div>

      <div className={styles.mainFlexWrapper}>
        {/* Branding + Search */}
        <div className={styles.brandSearchWrapper}>
          <Image src="/logo.png" alt="Logo" width={80} height={30} className={styles.logoImg} />
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <input
              type="text"
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className={styles.searchInput}
            />
          </form>
        </div>

        {/* Top Nav */}
        <ul className={styles.navLinksScrollable}>
          <li><Link href="/">Home</Link></li>
{/* ✅ New: Get Quote (styled like Home/Contact) */}
<li>
  <a
    href="#"
    onClick={(e) => {
      e.preventDefault();
      setQuoteOpen(true);
    }}
    style={{ textDecoration: 'none' }}
    aria-label="Get Quote"
  >
    Get Quote
  </a>
</li>
          <li><Link href="/compare-calculations">Compare</Link></li>
          <li><Link href="/#contact">Contact</Link></li>




        </ul>
      </div>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div ref={menuRef} className={styles.dropdownMenu}>
          <div className={styles.menuSection}>
            <h4>Diamond Jewellery</h4>
            {diamondItems.map((item) => (
              <Link key={item.label} href={item.link} onClick={() => setMenuOpen(false)}>
                <p>{item.label}</p>
              </Link>
            ))}
          </div>

          <div className={styles.menuSection}>
            <h4>Gold Jewellery</h4>
            {goldItems.map((item) => (
              <Link key={item.label} href={item.link} onClick={() => setMenuOpen(false)}>
                <p>{item.label}</p>
              </Link>
            ))}
          </div>

          <div className={styles.menuSection}>
            <h4>Silver Store</h4>
            {silverItems.map((item) => (
              <Link key={item.label} href={item.link} onClick={() => setMenuOpen(false)}>
                <p>{item.label}</p>
              </Link>
            ))}
          </div>

          <div className={styles.menuSection}>
            <h4>Gemstones Jewellery</h4>
            {gemstoneItems.map((item) => (
              <Link key={item.label} href={item.link} onClick={() => setMenuOpen(false)}>
                <p>{item.label}</p>
              </Link>
            ))}
          </div>

          <div className={styles.menuSection}>
            <h4>CVD Lab Grown Diamonds</h4>
            {cvdItems.map((item) => (
              <Link key={item.label} href={item.link} onClick={() => setMenuOpen(false)}>
                <p>{item.label}</p>
              </Link>
            ))}
          </div>

          <div className={styles.menuSection}>
            <h4>Miscellaneous Items</h4>
            {miscItems.map((item) => (
              <Link key={item.label} href={item.link} onClick={() => setMenuOpen(false)}>
                <p>{item.label}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ✅ Quote Modal */}
      {quoteOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            ref={quoteRef}
            style={{
              width: 'min(520px, 100%)',
              background: '#fff',
              borderRadius: '16px',
              padding: '16px',
              boxShadow: '0 18px 60px rgba(0,0,0,0.20)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800 }}>Get Quote</div>
              <button
                type="button"
                onClick={() => setQuoteOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '18px',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: '10px', fontSize: '13px', opacity: 0.75 }}>
              Paste the design link below, or send a photo on WhatsApp.
            </div>

            <input
              value={designLink}
              onChange={(e) => setDesignLink(e.target.value)}
              placeholder="Paste design link (product URL / Instagram / etc.)"
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.15)',
                outline: 'none',
                fontSize: '14px',
              }}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={openWhatsappWithLink}
                disabled={!designLink.trim()}
                style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: designLink.trim() ? '#111' : 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  cursor: designLink.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                }}
              >
                Get Quote
              </button>

              <button
                type="button"
                onClick={openWhatsappForPhoto}
                style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                Send photo to get quote
              </button>
            </div>

            <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.6 }}>
              Tip: On WhatsApp, you can attach photo/video/document from the clip icon.
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
