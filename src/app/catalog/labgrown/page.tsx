'use client';

import { useEffect, useRef, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { db } from '../../../firebaseConfig';
import PageLayout from '../../components/PageLayout';
import styles from '../../page.module.css';
import shapeIcon from '../../../../assets/shapeIcons';
import TrustInfoStrip from '../../components/TrustInfoStrip';

interface Diamond {
  StoneId: string;
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
  CertNo?: string;
  Certified?: string;
  VideoURL?: string;
  Measurement?: string;
  Depth?: string;
  Table?: string;
  MRP?: number;
  OfferPrice?: number;
}

const clarityMap = {
  IF: 'Internally Flawless (best grade)',
  VVS1: 'Very Very Slightly Included 1',
  VVS2: 'Very Very Slightly Included 2',
  VS1: 'Very Slightly Included 1',
  VS2: 'Very Slightly Included 2',
  SI1: 'Slightly Included 1',
  SI2: 'Slightly Included 2',
  I1: 'Included – Visible inclusions',
};
const colorMap = {
  D: 'Colorless (highest grade)',
  E: 'Colorless – Slightly less than D',
  F: 'Colorless – Slight warmth',
  G: 'Near Colorless – Faint trace of color',
  H: 'Near Colorless – Slightly noticeable warmth',
  I: 'Near Colorless – Slight visible warmth',
  FIP: 'Fancy Intense Pink',
  FP: 'Fancy Pink',
  FVB: 'Fancy Vivid Blue',
  FVG: 'Fancy Vivid Green',
  FVP: 'Fancy Vivid Pink',
};
const gradeMap = { EX: 'Excellent', VG: 'Very Good', GD: 'Good', ID: 'Ideal', FR: 'Fair' };
const fluorescenceMap = { NON: 'None – No reaction to UV light', SLT: 'Slight – Very minimal fluorescence', VSL: 'Very Slight – Slightly visible under UV' };

const InfoPopup = ({ text, label, valueMap }: { text: string; label?: string; valueMap: Record<string, string> }) => {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setShow(false);
    };
    if (show) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [show]);

  return (
    <span
      ref={ref}
      style={{
        cursor: 'pointer',
        color: '#0070f3',
        fontWeight: 'bold',
        position: 'relative', // NOTE: fontSize removed so it inherits
      }}
      onClick={(e) => {
        e.stopPropagation();
        setShow((prev) => !prev);
      }}
    >
      {text}
      {show && (
        <span
          style={{
            display: 'block',
            background: '#fff',
            border: '1px solid #ccc',
            padding: '0.5rem',
            marginTop: '0.25rem',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            position: 'absolute',
            zIndex: 10,
            whiteSpace: 'normal',
            maxWidth: '250px',
          }}
        >
          <strong>{label || text}:</strong> {valueMap[text] || 'No info available'}
        </span>
      )}
    </span>
  );
};

const extractUrl = (val: string): string => val?.match(/HYPERLINK\("(.+?)"/)?.[1] || '';

export default function CvdCatalogPage() {
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [filtered, setFiltered] = useState<Diamond[]>([]);
  const [availableShapes, setAvailableShapes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOption, setSortOption] =
    useState<'price-asc' | 'price-desc' | 'size-asc' | 'size-desc'>('price-asc');
  const [filters, setFilters] = useState({
    SizeRange: '1.000 - 1.100',
    Shape: 'ROUND',
    Clarity: '',
    Color: '',
    Cut: '',
    Polish: '',
    Symm: '',
    Fluorescence: '',
  });
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();

  // Build available shapes (NO certification check)
  useEffect(() => {
    const dataRef = ref(db, 'Global SKU/CVD');
    onValue(
      dataRef,
      (snapshot) => {
        const val = snapshot.val();
        if (!val) return;
        const shapes = new Set<string>();
        Object.values(val).forEach((dRaw) => {
          const d = dRaw as Diamond;
          if (d.Shape && d.Status === 'AVAILABLE') shapes.add(d.Shape);
        });
        setAvailableShapes(Array.from(shapes).sort());
      },
      { onlyOnce: true }
    );
  }, []);

  // Load items for selected shape (NO certification check)
  useEffect(() => {
    setIsLoading(true);
    const dataRef = ref(db, 'Global SKU/CVD');
    onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) {
        setDiamonds([]);
        setIsLoading(false);
        return;
      }
      const parsed = Object.values(val)
        .map((dRaw) => dRaw as Diamond)
        .filter((d) => d.Status === 'AVAILABLE' && d.Shape === filters.Shape)
        .map((d) => ({ ...d, VideoURL: extractUrl(d.VideoURL ?? '') }));
      setDiamonds(parsed);
      setIsLoading(false);
    });
  }, [filters.Shape]);

  // Apply optional filters + sort
  useEffect(() => {
    let result = diamonds.filter(
      (d) =>
        (!filters.SizeRange || d.SizeRange === filters.SizeRange) &&
        (!filters.Clarity || d.Clarity === filters.Clarity) &&
        (!filters.Color || d.Color === filters.Color) &&
        (!filters.Cut || d.Cut === filters.Cut) &&
        (!filters.Polish || d.Polish === filters.Polish) &&
        (!filters.Symm || d.Symm === filters.Symm) &&
        (!filters.Fluorescence || d.Fluorescence === filters.Fluorescence)
    );
    result = result.sort((a, b) => {
      if (sortOption === 'price-asc') return (a.OfferPrice ?? 0) - (b.OfferPrice ?? 0);
      if (sortOption === 'price-desc') return (b.OfferPrice ?? 0) - (a.OfferPrice ?? 0);
      if (sortOption === 'size-asc') return parseFloat(a.Size ?? '0') - parseFloat(b.Size ?? '0');
      return parseFloat(b.Size ?? '0') - parseFloat(a.Size ?? '0');
    });
    setFiltered(result);
  }, [filters, diamonds, sortOption]);

  const unique = (key: keyof Diamond) =>
    Array.from(new Set(diamonds.map((d) => d[key]))).sort();

  return (
    <PageLayout>
      <div className="labGrownPage">
        <h1 className={styles.pageTitle}>Lab Grown Diamonds</h1>

        <div
          className={styles.stickyFilterContainer}
          style={{
            justifyContent: 'center',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            margin: '1rem 0',
          }}
        >
          <label className={styles.filterLabel}>
            Shape:{' '}
            <select
              value={filters.Shape}
              onChange={(e) => setFilters((prev) => ({ ...prev, Shape: e.target.value, SizeRange: '' }))}
            >
              {availableShapes.map((shape) => (
                <option key={shape} value={shape}>
                  {shape}
                </option>
              ))}
            </select>
          </label>

          {[
            ['SizeRange', 'Size'],
            ['Clarity', 'Clarity'],
            ['Color', 'Color'],
            ['Cut', 'Cut'],
            ['Polish', 'Polish'],
            ['Symm', 'Symm'],
            ['Fluorescence', 'Fluorescence'],
          ].map(([key, label]) => (
            <label key={key} className={styles.filterLabel}>
              {label}:{' '}
              <select
                value={filters[key as keyof typeof filters]}
                onChange={(e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }))}
              >
                <option value="">All {label}</option>
                {unique(key as keyof Diamond).map((val) => (
                  <option key={val as string} value={val as string}>
                    {val as string}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className={styles.sortingContainer}>
          <label htmlFor="sortOption">Sort by: </label>
          <select
            id="sortOption"
            value={sortOption}
            onChange={(e) =>
              setSortOption(e.target.value as 'price-asc' | 'price-desc' | 'size-asc' | 'size-desc')
            }
          >
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="size-asc">Size: Small to Large</option>
            <option value="size-desc">Size: Large to Small</option>
          </select>
        </div>

        {!isLoading && <p className={styles.itemCount}>Showing {filtered.length} items</p>}
        {isLoading && <p className={styles.loadingBlink}>Loading...</p>}

        {selected.length > 1 && (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/catalog/labgrown/compare-labgrown?ids=${selected.join(',')}`);
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#0070f3',
                color: '#fff',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Compare {selected.length} Selected
            </button>
          </div>
        )}

        <div className={styles.catalogGrid}>
          {filtered.map((d) => (
            <div
              className={`${styles.catalogCard} ${selected.includes(d.StoneId) ? styles.selectedCard : ''}`}
              key={d.StoneId}
              style={{ border: selected.includes(d.StoneId) ? '2px solid #0070f3' : '1px solid #ccc' }}
            >
              {/* Select for comparison */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(d.StoneId)}
                  disabled={!selected.includes(d.StoneId) && selected.length >= 4}
                  onChange={(e) => {
                    if (e.target.checked) setSelected((prev) => [...prev, d.StoneId]);
                    else setSelected((prev) => prev.filter((id) => id !== d.StoneId));
                  }}
                />
                <span>{d.StoneId}</span>
              </div>

              {/* Shape icon */}
              <div className="imageContainer">
                <Image
                  src={shapeIcon[d.Shape ?? ''] || '/default.png'}
                  alt={d.Shape || 'shape'}
                  className="shapeImage"
                  width={120}
                  height={120}
                />
              </div>

              <div className="cardContent">
                {/* Size & Shape */}
                <p>{(parseFloat(d.Size ?? '0')).toFixed(2)}ct ({d.Shape})</p>

                {/* Color & Clarity (bigger line) */}
                <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: '4px 0', textAlign: 'center' }}>
                  <InfoPopup text={d.Color ?? ''} label="Color" valueMap={colorMap} />
                  {' · '}
                  <InfoPopup text={d.Clarity ?? ''} label="Clarity" valueMap={clarityMap} />
                </p>

                {/* Details (small) */}
                <div style={{ fontSize: '0.65rem', lineHeight: '1.3', textAlign: 'center' }}>
                  <p>
                    <span
                      onClick={() => alert('Lab-grown diamond using Chemical Vapor Deposition (CVD).')}
                      style={{ cursor: 'pointer', color: '#0070f3', fontWeight: 'bold' }}
                    >
                      CVD
                    </span>{' '}
                    ({d.Measurement ?? ''} mm)
                  </p>
                  <p>
                    D
                    <InfoPopup
                      text={`${(parseFloat(d.Depth ?? '0')).toFixed(2)}%`}
                      valueMap={{ [`D${d.Depth}%`]: 'Depth % – Ratio of depth to width. Affects brilliance.' }}
                    />
                    , T
                    <InfoPopup
                      text={`${(parseFloat(d.Table ?? '0')).toFixed(2)}%`}
                      valueMap={{ [`T${d.Table}%`]: 'Table % – Size of the flat top facet. Affects sparkle.' }}
                    />
                  </p>
                  <p>
                    <InfoPopup text={d.Cut ?? ''} label="Cut" valueMap={gradeMap} />,{' '}
                    <InfoPopup text={d.Polish ?? ''} label="Polish" valueMap={gradeMap} />,{' '}
                    <InfoPopup text={d.Symm ?? ''} label="Symmetry" valueMap={gradeMap} />,{' '}
                    <InfoPopup text={d.Fluorescence ?? ''} label="Fluorescence" valueMap={fluorescenceMap} />
                  </p>
                </div>

                {d.MRP && d.OfferPrice && (
                  <p>
                    <span style={{ textDecoration: 'line-through', color: '#888', marginRight: '0.5rem' }}>
                      ₹{Math.round(d.MRP)}
                    </span>
                    <span style={{ color: '#c00', fontWeight: 'bold' }}>₹{Math.round(d.OfferPrice)}</span>
                  </p>
                )}
              </div>

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
            </div>
          ))}
        </div>
      </div>
<TrustInfoStrip />

    </PageLayout>
  );
}
