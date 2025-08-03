// CompareNaturalDiamond.tsx with enhancements
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../../firebaseConfig';
import PageLayout from '../../../components/PageLayout';
import styles from '../../../page.module.css';
import shapeIcon from '../../../../../assets/shapeIcons';
import type { JSX } from 'react';

interface Diamond {
  StoneId?: string;
  Size?: string;
  SizeRange?: string;
  Clarity?: string;
  Color?: string;
  Cut?: string;
  Polish?: string;
  Symm?: string;
  Fluorescence?: string;
  Shape?: string;
  Measurement?: string;
  Depth?: string;
  Table?: string;
  MRP?: number;
  OfferPrice?: number;
  Certified?: string;
  Status?: string; // ✅ Add this line
}

export default function CompareNaturalDiamond() {
  const searchParams = useSearchParams();
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);

  useEffect(() => {
    const ids = searchParams?.get('ids')?.split(',') || [];
    const dataRef = ref(db, 'Global SKU/NaturalDiamonds');
    onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) return;
      const all: Diamond[] = Object.values(val);
      const selected = all.filter(
        (d) => ids.includes(d.StoneId || '') && d.Status === 'AVAILABLE'
      );
      setDiamonds(selected);
    });
  }, []);

  const fields: { label: string; key: keyof Diamond }[] = [
    { label: 'Shape', key: 'Shape' },
    { label: 'Size', key: 'Size' },
    { label: 'Measurement', key: 'Measurement' },
    { label: 'Clarity', key: 'Clarity' },
    { label: 'Color', key: 'Color' },
    { label: 'Cut', key: 'Cut' },
    { label: 'Polish', key: 'Polish' },
    { label: 'Symmetry', key: 'Symm' },
    { label: 'Fluorescence', key: 'Fluorescence' },
    { label: 'Depth %', key: 'Depth' },
    { label: 'Table %', key: 'Table' },
    { label: 'Certified By', key: 'Certified' },
  ];

  const getCell = (key: keyof Diamond, value: string | number | undefined): string | number | JSX.Element => {
    const baseValue = value ?? '-';
    const otherValues = diamonds.map((d) => d[key]);
    const isDifferent = new Set(otherValues).size > 1;
    return isDifferent ? <b>{baseValue}</b> : baseValue;
  };

  return (
    <PageLayout>
      <div className={styles.compareTable}>
        <h1 className={styles.pageTitle}>Compare Natural Diamonds</h1>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>Stone ID</th>
                {diamonds.map((d, idx) => (
                  <th key={idx}>{d.StoneId}</th>
                ))}
              </tr>
              <tr>
                <td>Price</td>
                {diamonds.map((d, idx) => (
                  <td key={idx}>
                    {d.MRP && d.OfferPrice ? (
                      <span>
                        <span style={{ textDecoration: 'line-through', color: '#888', marginRight: 6 }}>
                          ₹{Math.round(d.MRP)}
                        </span>
                        <b style={{ color: '#c00' }}>₹{Math.round(d.OfferPrice)}</b>
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Image</td>
                {diamonds.map((d, idx) => (
                  <td key={idx}>
                    <img
                      src={shapeIcon[d.Shape ?? ''] || '/default.png'}
                      alt={d.Shape}
                      style={{ width: '120px', height: 'auto' }}
                    />
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map(({ label, key }) => (
                <tr key={key}>
                  <td>{label}</td>
                  {diamonds.map((d, idx) => (
                    <td key={idx}>{getCell(key, d[key])}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td>Enquire</td>
                {diamonds.map((d, idx) => (
                  <td key={idx}>
                    <a
                      href={`https://wa.me/919023130944?text=I'm interested in diamond code: ${d.StoneId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        backgroundColor: '#25D366',
                        color: 'white',
                        padding: '6px 12px',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        display: 'inline-block',
                        fontSize: '0.85rem'
                      }}
                    >
                      Enquire
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
}
