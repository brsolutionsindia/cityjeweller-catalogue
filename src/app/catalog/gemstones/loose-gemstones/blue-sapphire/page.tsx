'use client';

import { useEffect, useRef, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../../../firebaseConfig';
import PageLayout from '../../../../components/PageLayout';
import styles from '../../../../page.module.css';


interface BlueSapphire {
  StoneId?: string;
  Carat?: string;
  ColorShade?: string;
  Clarity?: string;
  Cut?: string;
  Origin?: string;
  Treatment?: string;
  OfferPrice?: number;
  MRP?: number;
  VideoURL?: string;
}

const clarityMap = {EC: 'Eye-Clean', SI: 'Slightly Included', MI: 'Moderately Included', HI: 'Highly Included'};

const colorMap = { RB: 'Royal Blue', CB: 'Cornflower Blue', DB: 'Deep Blue', VB: 'Violet Blue', TB: 'Transparent Blue'};

const originMap = { 
SL: 'Sri Lanka', 
BM: 'Burma',
KS: 'Kashmir',
TH: 'Thailand', 
AF: 'Africa' 
};

const treatmentMap = { 
Untreated: 'Natural and highest value', 
'Heat Treated': 'Common and stable', 
Diffused: 'Surface treated, lower value' 
};

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
    <span ref={ref} style={{ cursor: 'pointer', color: '#0070f3', fontWeight: 'bold', position: 'relative', fontSize: '0.65rem' }} onClick={(e) => { e.stopPropagation(); setShow((prev) => !prev); }}>
      {text}
      {show && (
        <span style={{ display: 'block', background: '#fff', border: '1px solid #ccc', padding: '0.5rem', marginTop: '0.25rem', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', position: 'absolute', zIndex: 10, whiteSpace: 'normal', maxWidth: '250px' }}>
          <strong>{label || text}:</strong> {valueMap[text] || 'No info available'}
        </span>
      )}
    </span>
  );
};

export default function BlueSapphireCatalogPage() {
  const [items, setItems] = useState<BlueSapphire[]>([]);
  const [filtered, setFiltered] = useState<BlueSapphire[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOption, setSortOption] = useState<'price-asc' | 'price-desc' | 'carat-asc' | 'carat-desc'>('price-asc');
  const [filters, setFilters] = useState({ Cut: 'Oval', ColorShade: '', Clarity: '', Origin: '', Treatment: ''});

  useEffect(() => {
    const dataRef = ref(db, 'Global SKU/BlueSapphires');
    onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) return;
      const parsed = Object.values(val).map(d => d as BlueSapphire).filter(d => d.OfferPrice).map(d => ({ ...d }));
      setItems(parsed);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    let result = items.filter(d =>
      (!filters.ColorShade || d.ColorShade === filters.ColorShade) &&
      (!filters.Clarity || d.Clarity === filters.Clarity) &&
      (!filters.Cut || d.Cut === filters.Cut) &&
      (!filters.Origin || d.Origin === filters.Origin) &&
      (!filters.Treatment || d.Treatment === filters.Treatment)
    );

    result = result.sort((a, b) => {
      if (sortOption === 'price-asc') return (a.OfferPrice ?? 0) - (b.OfferPrice ?? 0);
      if (sortOption === 'price-desc') return (b.OfferPrice ?? 0) - (a.OfferPrice ?? 0);
      if (sortOption === 'carat-asc') return parseFloat(a.Carat ?? '0') - parseFloat(b.Carat ?? '0');
      return parseFloat(b.Carat ?? '0') - parseFloat(a.Carat ?? '0');
    });

    setFiltered(result);
  }, [filters, items, sortOption]);

  const unique = (key: keyof BlueSapphire) => Array.from(new Set(items.map((d) => d[key]))).sort();

  return (
    <PageLayout>
      <div className="labGrownPage">
        <h1 className={styles.pageTitle}>Blue Sapphires</h1>
        {!isLoading && <p className={styles.itemCount}>Showing {filtered.length} items</p>}
        {isLoading && <p className={styles.loadingBlink}>Loading...</p>}

        <div className={styles.stickyFilterContainer} style={{ justifyContent: 'center', display: 'flex', flexWrap: 'wrap', gap: '1rem', margin: '1rem 0' }}>
          {[
  ['Cut', 'Cut'],
  ['ColorShade', 'Color Shade'],
  ['Clarity', 'Clarity'],
  ['Origin', 'Origin'],
  ['Treatment', 'Treatment']
].map(([key, label]) => (

  <label key={key as string} className={styles.filterLabel}>
    {label}: 
    <select
      value={filters[key as keyof typeof filters]}
      onChange={e =>
        setFilters(prev => ({ ...prev, [key]: e.target.value }))
      }
    >
      <option value="">All {label}</option>
      {unique(key as keyof BlueSapphire).map(val => (
        <option key={val} value={val}>{val}</option>
      ))}
    </select>
  </label>
))}

        </div>

        <div className={styles.sortingContainer}>
          <label htmlFor="sortOption">Sort by: </label>
          <select id="sortOption" value={sortOption} onChange={e => setSortOption(e.target.value as typeof sortOption)}>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="carat-asc">Carat: Low to High</option>
            <option value="carat-desc">Carat: High to Low</option>
          </select>
        </div>

        <div className={styles.catalogGrid}>
          {filtered.map((d) => (
            <div className={`${styles.catalogCard}`} key={d.StoneId}>
              <div className="imageContainer"><img
  src={`/assets/blue-sapphire/${(d.Cut ?? 'default').replace(/\s+/g, '-').toLowerCase()}.png`}
  alt={d.Cut}
  className="shapeImage"
/>
</div>
              <div className="cardContent">
                <p>{d.Carat}ct ({d.Cut})</p>
                <div style={{ fontSize: '0.65rem', lineHeight: '1.3', textAlign: 'center' }}>
                  <p><InfoPopup text={d.ColorShade ?? ''} label="Color Shade" valueMap={colorMap} />
                  , <InfoPopup text={d.Clarity ?? ''} label="Clarity" valueMap={clarityMap} />
                  , <InfoPopup text={d.Origin ?? ''} label="Origin" valueMap={originMap} />
                  , <InfoPopup text={d.Treatment ?? ''} label="Treatment" valueMap={treatmentMap} /></p>
                </div>
                {d.MRP && d.OfferPrice && (
                  <p>
                    <span style={{ textDecoration: 'line-through', color: '#888', marginRight: '0.5rem' }}>₹{Math.round(d.MRP)}</span>
                    <span style={{ color: '#c00', fontWeight: 'bold' }}>₹{Math.round(d.OfferPrice)}</span>
                  </p>
                )}
              </div>
              <div className="cardFooter">
                {d.StoneId && (
                  <>
                    <div className="codeSection">
                      <span className="codeLabel">Code:</span>
                      <span className="codeValue">{d.StoneId}</span>
                    </div>
                    <a
                      href={`https://wa.me/919023130944?text=I'm interested in Blue Sapphire code: ${d.StoneId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.enquiryBtn}`}
                    >
                      Enquire
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
