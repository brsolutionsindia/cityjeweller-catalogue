'use client';

import { useEffect, useRef, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { db } from '../../../firebaseConfig';
import PageLayout from '../../components/PageLayout';
import styles from '../../page.module.css';
import shapeIcon from '../../../../assets/shapeIcons';
import Image from 'next/image';
import TrustInfoStrip from '../../components/TrustInfoStrip';

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
  CertNo?: string;
  Certified?: string;
  VideoURL?: string;
  Video?: string;
  Measurement?: string;
  Depth?: string;
  Table?: string;
  MRP?: number;
  OfferPrice?: number;
}

type RawDiamond = Diamond;

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

const fluorescenceMap = {
  NON: 'None – No reaction to UV light',
  SLT: 'Slight – Very minimal fluorescence',
  VSL: 'Very Slight – Slightly visible under UV',
};

const extractUrl = (val: string | undefined): string => {
  if (!val) return '';
  const str = String(val).trim();
  const match = str.match(/HYPERLINK\("(.+?)"/);
  if (match?.[1]) return match[1];
  if (str.startsWith('http')) return str;
  return '';
};

const InfoPopup = ({
  text,
  label,
  valueMap,
}: {
  text: string;
  label?: string;
  valueMap: Record<string, string>;
}) => {
  const [show, setShow] = useState(false);
  const refEl = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (refEl.current && !refEl.current.contains(event.target as Node)) setShow(false);
    };
    if (show) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [show]);

  if (!text) return null;

  return (
    <span
      ref={refEl}
      style={{ cursor: 'pointer', color: '#0070f3', fontWeight: 'bold', position: 'relative' }}
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

export default function NaturalCatalogPage() {
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [filtered, setFiltered] = useState<Diamond[]>([]);
  const [availableShapes, setAvailableShapes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOption, setSortOption] =
    useState<'price-asc' | 'price-desc' | 'size-asc' | 'size-desc'>('price-asc');
  const [filters, setFilters] = useState({
    SizeRange: '1.00-1.19',
    Shape: 'ROUND',
    Clarity: '',
    Color: '',
    Cut: '',
    Polish: '',
    Symm: '',
    Fluorescence: '',
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const router = useRouter();

  const handleSelectionToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  useEffect(() => {
    const dataRef = ref(db, 'Global SKU/NaturalDiamonds');
    onValue(
      dataRef,
      (snapshot) => {
        const val = snapshot.val() as Record<string, RawDiamond> | null;
        if (!val) return;
        const shapes = new Set<string>();
        Object.values(val).forEach((d) => {
          if (d.Shape && d.Status === 'AVAILABLE') shapes.add(d.Shape);
        });
        setAvailableShapes(Array.from(shapes).sort());
      },
      { onlyOnce: true }
    );
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const dataRef = ref(db, 'Global SKU/NaturalDiamonds');
    onValue(dataRef, (snapshot) => {
      const val = snapshot.val() as Record<string, RawDiamond> | null;
      if (!val) {
        setDiamonds([]);
        setIsLoading(false);
        return;
      }

      const parsed: Diamond[] = Object.values(val)
        .filter((d) => d.Status === 'AVAILABLE' && d.Shape === filters.Shape)
        .map((d) => ({
          ...d,
          VideoURL: extractUrl(d.Video || d.VideoURL),
        }));

      setDiamonds(parsed);
      setIsLoading(false);
    });
  }, [filters.Shape]);

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

  const unique = (key: keyof Diamond) => Array.from(new Set(diamonds.map((d) => d[key]))).sort();

  return (
    <PageLayout>
      <div className="labGrownPage">
        <h1 className={styles.pageTitle}>Natural Diamonds</h1>

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
                  <option key={String(val)} value={String(val)}>
                    {String(val)}
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

        {selectedIds.length >= 2 && (
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <a
              className={styles.compareButton}
              href={`/catalog/naturalD/compare-natural?ids=${selectedIds.join(',')}`}
              style={{
                background: '#0070f3',
                color: '#fff',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                display: 'inline-block',
              }}
            >
              Compare ({selectedIds.length})
            </a>
          </div>
        )}

        <div className={styles.catalogGrid}>
          {filtered.map((d) => (
            <div
              className={`${styles.catalogCard} ${styles.labGrownPage}`}
              key={d.StoneId}
              onClick={() => {
                const id = d.StoneId ?? '';
                if (!id) return;
                router.push(`/diamond/${encodeURIComponent(id)}?type=natural`);
              }}
            >
              <div className="compareCheckbox" style={{ textAlign: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.65rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(d.StoneId ?? '')}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => handleSelectionToggle(d.StoneId ?? '')}
                  />{' '}
                  Compare
                </label>
              </div>

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
                <p>{(parseFloat(d.Size ?? '0')).toFixed(2)}ct ({d.Shape})</p>

                <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: '4px 0', textAlign: 'center' }}>
                  <InfoPopup text={d.Color ?? ''} label="Color" valueMap={colorMap} />
                  {' · '}
                  <InfoPopup text={d.Clarity ?? ''} label="Clarity" valueMap={clarityMap} />
                </p>

                <div style={{ fontSize: '0.65rem', lineHeight: '1.3', textAlign: 'center' }}>
                  <p>({d.Measurement ?? ''} mm)</p>

                  <p>
                    D
                    <InfoPopup
                      text={`${(parseFloat(d.Depth ?? '0')).toFixed(2)}%`}
                      valueMap={{
                        [`${(parseFloat(d.Depth ?? '0')).toFixed(2)}%`]:
                          'Depth % – Ratio of depth to width. Affects brilliance.',
                      }}
                    />
                    , T
                    <InfoPopup
                      text={`${(parseFloat(d.Table ?? '0')).toFixed(2)}%`}
                      valueMap={{
                        [`${(parseFloat(d.Table ?? '0')).toFixed(2)}%`]:
                          'Table % – Size of the flat top facet. Affects sparkle.',
                      }}
                    />
                  </p>

                  <p>
                    <InfoPopup text={d.Cut ?? ''} label="Cut" valueMap={gradeMap} />,{' '}
                    <InfoPopup text={d.Polish ?? ''} label="Polish" valueMap={gradeMap} />,{' '}
                    <InfoPopup text={d.Symm ?? ''} label="Symmetry" valueMap={gradeMap} />,{' '}
                    <InfoPopup text={d.Fluorescence ?? ''} label="Fluorescence" valueMap={fluorescenceMap} />
                  </p>
                </div>

                {d.MRP && d.OfferPrice ? (
                  <p>
                    <span style={{ textDecoration: 'line-through', color: '#888', marginRight: '0.5rem' }}>
                      ₹{Math.round(d.MRP)}
                    </span>
                    <span style={{ color: '#c00', fontWeight: 'bold' }}>₹{Math.round(d.OfferPrice)}</span>
                  </p>
                ) : null}
              </div>

              <div className="cardFooter">
                <div className="codeSection">
                  <span className="codeValue">{d.StoneId ?? ''}</span>
                </div>

                <a
                  href={`https://wa.me/919023130944?text=${encodeURIComponent(
                    `I am interested in Product ID ${d.StoneId ?? ''}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.enquiryBtn} ${styles.labGrownPage}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  Enquire
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TrustInfoStrip />
    </PageLayout>
  );
}
