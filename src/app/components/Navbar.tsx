'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from '../navbar.module.css';
import { diamondItems, goldItems, silverItems, gemstoneItems, cvdItems, miscItems } from '../../data/catalogMenu';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // Close menu when clicked outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchText.trim()) {
	router.push(`/search?query=${encodeURIComponent(searchText.trim())}`);
      setSearchText('');
    }
  };

  return (
    <nav className={`${styles.navbar} flex items-center justify-between gap-4`} style={{ borderRadius: '12px', padding: '1rem', backgroundColor: '#f9f9f9' }}>
      
      {/* Hamburger Icon */}
      <div style={{ cursor: 'pointer' }} onClick={() => setMenuOpen(!menuOpen)}>
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
    </nav>
  );
}
