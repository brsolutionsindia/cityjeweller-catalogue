'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import PageLayout from '../../components/PageLayout';
import styles from '../../page.module.css';
import shapeIcon from '../../../../assets/shapeIcons';

const clarityMap = {
  IF: 'Internally Flawless (best grade)',
  VVS1: 'Very Very Slightly Included 1',
  VVS2: 'Very Very Slightly Included 2',
  VS1: 'Very Slightly Included 1',
  VS2: 'Very Slightly Included 2',
  SI1: 'Slightly Included 1',
  SI2: 'Slightly Included 2',
  I1: 'Included – Visible inclusions'
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
  FVP: 'Fancy Vivid Pink'
};

const gradeMap = {
  EX: 'Excellent',
  VG: 'Very Good',
  GD: 'Good',
  ID: 'Ideal',
  FR: 'Fair'
};

const fluorescenceMap = {
  NON: 'None – No reaction to UV light',
  SLT: 'Slight – Very minimal fluorescence',
  VSL: 'Very Slight – Slightly visible under UV'
};

const InfoPopup = ({
  text,
  label,
  valueMap
}: {
  text: string;
  label?: string;
  valueMap: Record<string, string>;
}) => {
  const [show, setShow] = useState(false);
  return (
    <span
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
            maxWidth: '250px'
          }}
        >
          <strong>{label || text}:</strong>{' '}
          {valueMap[text] || 'No info available'}
        </span>
      )}
    </span>
  );
};

const extractUrl = (val: string): string => {
  const match = val?.match(/HYPERLINK\("(.+?)"/);
  return match?.[1] || '';
};

const isIGICertified = (val: string): boolean => val?.includes('IGI');

const obfuscateStoneId = (id: string): string => {
  return id
    .split('')
    .map((char) => {
      if (/[A-Z]/.test(char)) {
        return String.fromCharCode(((char.charCodeAt(0) - 65 + 3) % 26) + 65);
      } else if (/[a-z]/.test(char)) {
        return String.fromCharCode(((char.charCodeAt(0) - 97 + 3) % 26) + 97);
      } else if (/[0-9]/.test(char)) {
        return String.fromCharCode(((parseInt(char) + 3) % 10) + 48);
      }
      return char;
    })
    .join('');
};

export default function CvdCatalogPage() {
  const [diamonds, setDiamonds] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [availableShapes, setAvailableShapes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [priceSortOrder, setPriceSortOrder] = useState<'asc' | 'desc' | ''>('');
  const [filters, setFilters] = useState({
    SizeRange: '1.000 - 1.100',
    Shape: 'ROUND',
    Clarity: '',
    Color: '',
    Cut: '',
    Polish: '',
    Symm: '',
    Fluorescence: ''
  });

  useEffect(() => {
    const dataRef = ref(db, 'Global SKU/CVD');
    onValue(
      dataRef,
      (snapshot) => {
        const val = snapshot.val();
        if (!val) return;
        const shapes = new Set();
        Object.values(val).forEach((d) => {
          if (d.Shape && d.Status === 'AVAILABLE' && isIGICertified(d.Certified ?? '')) {
            shapes.add(d.Shape);
          }
        });
        setAvailableShapes(Array.from(shapes).sort());
      },
      { onlyOnce: true }
    );
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const shapeToQuery = filters.Shape || 'ROUND';
    const dataRef = ref(db, 'Global SKU/CVD');

    onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) return;

      const parsed = Object.values(val)
        .filter(
          (d) =>
            d.Status === 'AVAILABLE' &&
            isIGICertified(d.Certified ?? '') &&
            d.Shape === shapeToQuery
        )
        .map((d) => ({
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
          MRP: d.MRP ?? 0,
          OfferPrice: d.OfferPrice ?? 0
        }));

      setDiamonds(parsed);
      setIsLoading(false);
    });
  }, [filters.Shape]);

  useEffect(() => {
    let result = diamonds.filter(
      (d) =>
        (filters.SizeRange ? d.SizeRange === filters.SizeRange : true) &&
        (filters.Clarity ? d.Clarity === filters.Clarity : true) &&
        (filters.Color ? d.Color === filters.Color : true) &&
        (filters.Cut ? d.Cut === filters.Cut : true) &&
        (filters.Polish ? d.Polish === filters.Polish : true) &&
        (filters.Symm ? d.Symm === filters.Symm : true) &&
        (filters.Fluorescence ? d.Fluorescence === filters.Fluorescence : true)
    );

    if (priceSortOrder) {
      result = result.sort((a, b) => {
        const priceA = a.OfferPrice || 0;
        const priceB = b.OfferPrice || 0;
        return priceSortOrder === 'asc' ? priceA - priceB : priceB - priceA;
      });
    } else {
      result = result.sort((a, b) => {
        const sizeA = parseFloat(a.Size) || 0;
        const sizeB = parseFloat(b.Size) || 0;
        return sortOrder === 'asc' ? sizeA - sizeB : sizeB - sizeA;
      });
    }

    setFiltered(result);
  }, [filters, diamonds, sortOrder, priceSortOrder]);

  const unique = (key) => Array.from(new Set(diamonds.map((d) => d[key]))).sort();

  return (
    <PageLayout>
      <div className="labGrownPage">
        <h1 className={styles.pageTitle}>Lab Grown Diamonds</h1>
        {!isLoading && <p className={styles.itemCount}>Showing {filtered.length} items</p>}
        {isLoading && <p className={styles.loadingBlink}>Loading...</p>}

        <div className={styles.stickyFilterContainer}>
          <label className={styles.filterLabel}>
            Shape:{' '}
            <select
              value={filters.Shape}
              onChange={e => {
                const newShape = e.target.value;
                setFilters(prev => ({
                  ...prev,
                  Shape: newShape,
                  SizeRange: '',
                }));
              }}
            >
              {availableShapes.map(shape => (
                <option key={shape} value={shape}>{shape}</option>
              ))}
            </select>
          </label>
          {([
            ['SizeRange', 'Size'], ['Clarity', 'Clarity'], ['Color', 'Color'], ['Cut', 'Cut'],
            ['Polish', 'Polish'], ['Symm', 'Symm'], ['Fluorescence', 'Fluorescence'],
          ] as [keyof typeof filters, string][]).map(([key, label]) => (
            <label key={key} className={styles.filterLabel}>
              {label}:{' '}
              <select
                value={filters[key]}
                onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.value }))}
              >
                <option value="">{`All ${label}`}</option>
                {unique(key as keyof Diamond).map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className={styles.sortingContainer}>
          <label htmlFor="sortOrder">Sort by Size:&nbsp;</label>
          <select
            id="sortOrder"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
            disabled={!!priceSortOrder}
          >
            <option value="asc">Smallest to Largest</option>
            <option value="desc">Largest to Smallest</option>
          </select>

          <label htmlFor="priceSortOrder" style={{ marginLeft: '1rem' }}>Sort by Price:&nbsp;</label>
          <select
            id="priceSortOrder"
            value={priceSortOrder}
            onChange={e => setPriceSortOrder(e.target.value as 'asc' | 'desc' | '')}
          >
            <option value="">-- None --</option>
            <option value="asc">Low to High</option>
            <option value="desc">High to Low</option>
          </select>
        </div>
        <div className={styles.catalogGrid}>
          {filtered.map((d) => (
            <div className={`${styles.catalogCard} ${styles.labGrownPage}`} key={d.StoneId}>
              <div className="imageContainer">
                <img
                  src={shapeIcon[d.Shape] || '/default.png'}
                  alt={d.Shape}
                  className="shapeImage"
                />
              </div>
              <div className="cardContent">
                <p>{d.Size}ct ({d.Shape})</p>
                
                <div style={{ fontSize: '0.70rem', lineHeight: '1.3', textAlign: 'center' }}>
<p>
                  
                  <span
                    onClick={() =>
                      alert('Lab-grown diamond using Chemical Vapor Deposition (CVD).')
                    }
                    style={{ cursor: 'pointer', color: '#0070f3', fontWeight: 'bold' }}
                  >
                    CVD
                  </span>
                  (
{d.Measurement} mm)</p>
  <p>
    D<InfoPopup text={`${d.Depth}%`} valueMap={{ [`D${d.Depth}%`]: 'Depth % – Ratio of depth to width. Affects brilliance.' }} />
    ; T<InfoPopup text={`${d.Table}%`} valueMap={{ [`T${d.Table}%`]: 'Table % – Size of the flat top facet. Affects sparkle.' }} />
  </p>
  <p>
    <InfoPopup text={d.Clarity} label="Clarity " valueMap={clarityMap} />,
    <InfoPopup text={d.Color} label="Color " valueMap={colorMap} />,
    <InfoPopup text={d.Cut} label="Cut " valueMap={gradeMap} />,
    <InfoPopup text={d.Polish} label="Polish " valueMap={gradeMap} />,
    <InfoPopup text={d.Symm} label="Symmetry " valueMap={gradeMap} />,
    <InfoPopup text={d.Fluorescence} label="Fluorescence: " valueMap={fluorescenceMap} />
  </p>
</div>
<p>
                  
                </p>
                {d.MRP && d.OfferPrice ? (
                  <p>
                    <span
                      style={{
                        textDecoration: 'line-through',
                        color: '#888',
                        marginRight: '0.5rem'
                      }}
                    >
                      ₹{Math.round(d.MRP)}
                    </span>
                    <span style={{ color: '#c00', fontWeight: 'bold' }}>
                      ₹{Math.round(d.OfferPrice)}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="cardFooter">
                <div className="codeSection">
                  <span className="codeLabel">Code:</span>
                  <span className="codeValue">{obfuscateStoneId(d.StoneId)}</span>
                </div>
                <a
                  href={`https://wa.me/919023130944?text=I'm interested in diamond code: ${obfuscateStoneId(
                    d.StoneId
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.enquiryBtn} ${styles.labGrownPage}`}
                >
                  Enquire
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
