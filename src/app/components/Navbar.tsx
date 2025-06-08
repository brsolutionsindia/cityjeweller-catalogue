'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from '../navbar.module.css';
import { goldItems, silverItems, gemstoneItems } from '../../data/catalogMenu';

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
      router.push(`/catalog?search=${encodeURIComponent(searchText.trim())}`);
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

      {/* Branding */}
      <div className="flex items-center gap-2">
        <Image src="/logo.png" alt="Logo" width={80} height={30} className={styles.logoImg} />
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={styles.searchInput}
            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #ccc', minWidth: '180px' }}
          />
        </form>
      </div>

      {/* Top Nav */}
      <ul className={styles.navLinksScrollable}>
        <li><Link href="/">Home</Link></li>
        <li><Link href="/#contact">Contact</Link></li>
      </ul>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div ref={menuRef} className={styles.dropdownMenu}>
          <div className={styles.menuSection}>
            <h4>Gold & Diamond</h4>
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
        </div>
      )}
    </nav>
  );
}
