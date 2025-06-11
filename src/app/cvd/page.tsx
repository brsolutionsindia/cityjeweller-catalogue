'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebaseConfig';
import PageLayout from '../components/PageLayout';
import styles from '../page.module.css';

type Diamond = {
  StoneId: string;
  Size: string;
  SizeRange: string;
  Clarity: string;
  Color: string;
  Cut: string;
  Polish: string;
  Symm: string;
  Fluorescence: string;
  Shape: string;
  Status: string;
  VideoURL: string;
  CertNo: string;
  Certified: string;
  Measurement: string;
  Depth: string;
  Table: string;
};

// ✅ Extract URL from Excel-style HYPERLINK string
const extractUrl = (val: string): string => {
  const match = val?.match(/HYPERLINK\("(.+?)"/);
  return match?.[1] || '';
};

// ✅ IGI Filter
const isIGICertified = (val: string): boolean => val?.includes('IGI');

// ✅ Obfuscate StoneId by shifting each alphanumeric character by 3
const obfuscateStoneId = (id: string): string => {
  return id
    .split('')
    .map(char => {
      if (/[A-Z]/i.test(char)) {
        const base = char === char.toUpperCase() ? 65 : 97;
        return String.fromCharCode(((char.charCodeAt(0) - base + 3) % 26) + base);
      } else if (/\d/.test(char)) {
        return String.fromCharCode(((+char + 3) % 10) + 48);
      }
      return char;
    })
    .join('');
};

export default function CvdCatalogPage() {
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [filtered, setFiltered] = useState<Diamond[]>([]);
  const [filters, setFilters] = useState({
    SizeRange: '',
    Shape: '',
    Clarity: '',
    Color: '',
    Cut: '',
    Polish: '',
    Symm: '',
    Fluorescence: '',
  });


  useEffect(() => {
    const dataRef = ref(db, 'Global SKU/CVD');

    onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (!val || typeof val !== 'object') return;

      const parsed: Diamond[] = Object.values(val)
        .filter((d: any) => d.Status === 'AVAILABLE' && isIGICertified(d.Certified))
        .map((d: Partial<Diamond>): Diamond => ({
  StoneId: d.StoneId ?? '',
  Size: d.Size ?? '',
  SizeRange: d.SizeRange ?? '',
  Clarity: d.Clarity ?? '',
  Color: d.Color ?? '',
  Cut: d.Cut ?? '',
  Polish: d.Polish ?? '',
  Symm: d.Symm ?? '',
  Fluorescence: d.Fluorescence ?? '',
  Shape: d.Shape ?? '',
  Status: d.Status ?? '',
  CertNo: d.CertNo ?? '',
  Certified: d.Certified ?? '',
  VideoURL: extractUrl(d.VideoURL ?? ''),
  Measurement: d.Measurement ?? '',
  Depth: d.Depth ?? '',
  Table: d.Table ?? '',
}))

      setDiamonds(parsed);
      setFiltered(parsed);
    });
  }, []);

  useEffect(() => {
    const result = diamonds.filter(d =>
      (filters.SizeRange ? d.SizeRange === filters.SizeRange : true) &&
      (filters.Shape ? d.Shape === filters.Shape : true) &&
      (filters.Clarity ? d.Clarity === filters.Clarity : true) &&
      (filters.Color ? d.Color === filters.Color : true) &&
      (filters.Cut ? d.Cut === filters.Cut : true) &&
      (filters.Polish ? d.Polish === filters.Polish : true) &&
      (filters.Symm ? d.Symm === filters.Symm : true) &&
      (filters.Fluorescence ? d.Fluorescence === filters.Fluorescence : true)
    );
    setFiltered(result);
  }, [filters, diamonds]);

  const unique = (key: keyof Diamond) =>
    Array.from(new Set(diamonds.map(d => d[key]))).sort();

  return (
    <PageLayout>

      <h1 className={styles.pageTitle}>Lab Grown Diamonds</h1>

      {/* Filters */}
      <div className={styles.filterContainer}>
        {['SizeRange', 'Shape', 'Clarity', 'Color', 'Cut', 'Polish', 'Symm', 'Fluorescence'].map((key) => (
          <select
            key={key}
            value={filters[key as keyof typeof filters]}
            onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.value }))}
          >
            <option value="">{`All ${key}`}</option>
            {unique(key as keyof Diamond).map(val => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        ))}
      </div>

      {/* Cards */}
      <div className={styles.catalogGrid}>
        {filtered.map(d => (
          <div key={d.StoneId} className={styles.catalogCard}>
            <p className={styles.catalogHeading}>
              <strong>{d.Size}ct (CVD*)</strong>
            </p>
            <p className={styles.catalogSubheading}>
              ({d.Measurement}; D{d.Depth}; T{d.Table})
            </p>
            <p className={styles.catalogText}>Code: {obfuscateStoneId(d.StoneId)}</p>
            <p className={styles.catalogText}>Shape: {d.Shape}</p>
            <p className={styles.catalogText}>Clarity: {d.Clarity}</p>
            <p className={styles.catalogText}>Color: {d.Color}</p>
            <p className={styles.catalogText}>Cut: {d.Cut}</p>
            <p className={styles.catalogText}>Polish: {d.Polish}</p>
            <p className={styles.catalogText}>Symmetry: {d.Symm}</p>
            <p className={styles.catalogText}>Fluorescence: {d.Fluorescence}</p>
            <a
              href={`https://wa.me/919023130944?text=${encodeURIComponent(
                `Hi, I am interested in CVD Diamond ${d.StoneId}. Please confirm availability.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className={styles.enquiryBtn}>Enquire</button>
            </a>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
