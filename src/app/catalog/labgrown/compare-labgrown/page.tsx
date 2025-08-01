'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../../firebaseConfig';
import PageLayout from '../../../components/PageLayout';
import styles from '../../../page.module.css';
import shapeIcon from '../../../../../assets/shapeIcons';
import Image from 'next/image';

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
  Status?: string;
  Certified?: string;
  Measurement?: string;
  Depth?: string;
  Table?: string;
  MRP?: number;
  OfferPrice?: number;
}

export default function CompareLabGrown() {
  const searchParams = useSearchParams();
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);

  useEffect(() => {
    const ids = searchParams.get('ids')?.split(',') || [];
    const dataRef = ref(db, 'Global SKU/CVD');
    onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) return;
      const all = Object.values(val) as Diamond[];
      const filtered = all.filter(
        (d) => d.StoneId && ids.includes(d.StoneId) && d.Status === 'AVAILABLE'
      );
      setDiamonds(filtered);
    });
  }, [searchParams]);

  const fields: [keyof Diamond, string][] = [
    ['Size', 'Size (ct)'],
    ['Measurement', 'Measurement'],
    ['Clarity', 'Clarity'],
    ['Color', 'Color'],
    ['Cut', 'Cut'],
    ['Polish', 'Polish'],
    ['Symm', 'Symmetry'],
    ['Fluorescence', 'Fluorescence'],
    ['Depth', 'Depth %'],
    ['Table', 'Table %'],
    ['Certified', 'Certified']
  ];

  const getBoldIfDifferent = (key: keyof Diamond, value: string | number | undefined) => {
    const allValues = diamonds.map((d) => d[key]);
    const isDifferent = new Set(allValues).size > 1;
    return isDifferent ? <strong>{value || '-'}</strong> : value || '-';
  };

  return (
    <PageLayout>
      <h2 className={styles.pageTitle}>Compare Lab Grown Diamonds</h2>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
          <table className={styles.compareTable} style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Feature</th>
                {diamonds.map((d) => (
                  <th key={d.StoneId}>{d.StoneId}</th>
                ))}
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', background: '#f8f8f8' }}>Price</td>
                {diamonds.map((d) => (
                  <td key={d.StoneId + 'Price'}>
                    <span style={{ textDecoration: 'line-through', color: '#888', marginRight: '0.5rem' }}>
                      ₹{Math.round(d.MRP || 0)}
                    </span>
                    <span style={{ color: '#c00', fontWeight: 'bold' }}>
                      ₹{Math.round(d.OfferPrice || 0)}
                    </span>
                  </td>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        <table className={styles.compareTable}>
          <tbody>
            <tr>
              <td>Shape</td>
              {diamonds.map((d) => (
                <td key={d.StoneId + 'ShapeImg'} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                  <Image
                    src={shapeIcon[d.Shape ?? ''] || '/default.png'}
                    alt={d.Shape || 'Shape'}
                    width={160}
                    height={160}
                    style={{ objectFit: 'contain' }}
                  />
                </td>
              ))}
            </tr>

            {fields.map(([key, label]) => (
              <tr key={key}>
                <td>{label}</td>
                {diamonds.map((d) => (
                  <td key={d.StoneId + key}>{getBoldIfDifferent(key, d[key])}</td>
                ))}
              </tr>
            ))}

            <tr>
              <td>Enquire</td>
              {diamonds.map((d) => (
                <td key={d.StoneId + 'enquire'}>
                  <button
                    onClick={() => {
                      const msg = `I am interested in your Product ID ${d.StoneId}.`;
                      window.open(`https://wa.me/919023130944?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.3rem 0.6rem',
                      backgroundColor: '#25D366',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    Enquire
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}
