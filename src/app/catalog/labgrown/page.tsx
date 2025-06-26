'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../firebaseConfig';
import PageLayout from '../../components/PageLayout';
import styles from '../../page.module.css';
import shapeIcon from '../../../../assets/shapeIcons';

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

const extractUrl = (val: string): string => {
  const match = val?.match(/HYPERLINK\("(.+?)"/);
  return match?.[1] || '';
};

const isIGICertified = (val: string): boolean => val?.includes('IGI');

const obfuscateStoneId = (id: string): string => {
  return id.split('').map(char => {
    if (/[A-Z]/.test(char)) {
      return String.fromCharCode(((char.charCodeAt(0) - 65 + 3) % 26) + 65);
    } else if (/[a-z]/.test(char)) {
      return String.fromCharCode(((char.charCodeAt(0) - 97 + 3) % 26) + 97);
    } else if (/[0-9]/.test(char)) {
      return String.fromCharCode(((parseInt(char) + 3) % 10) + 48);
    }
    return char;
  }).join('');
};

export default function CvdCatalogPage() {
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [filtered, setFiltered] = useState<Diamond[]>([]);
  const [availableShapes, setAvailableShapes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
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

  useEffect(() => {
    const dataRef = ref(db, 'Global SKU/CVD');
    onValue(dataRef, (snapshot) => {
      const val = snapshot.val() as Record<string, Partial<Diamond>>;
      if (!val) return;
      const shapes = new Set<string>();
      Object.values(val).forEach(d => {
        if (d.Shape && d.Status === 'AVAILABLE' && isIGICertified(d.Certified ?? '')) {
          shapes.add(d.Shape);
        }
      });
      setAvailableShapes(Array.from(shapes).sort());
    }, { onlyOnce: true });
  }, []);

useEffect(() => {
  setIsLoading(true);
  const shapeToQuery = filters.Shape || 'ROUND'; // 🔥 keep original casing
  const dataRef = ref(db, 'Global SKU/CVD');

  onValue(dataRef, (snapshot) => {
    const val = snapshot.val() as Record<string, Partial<Diamond>>;
    if (!val) return;

    const parsed: Diamond[] = Object.values(val)
      .filter((d): d is Partial<Diamond> =>
        d.Status === 'AVAILABLE' &&
        isIGICertified(d.Certified ?? '') &&
        d.Shape === shapeToQuery // ✅ exact match
      )
      .map((d): Diamond => ({
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
      }));

    setDiamonds(parsed);
    setIsLoading(false);
  });
}, [filters.Shape]);


  useEffect(() => {
    const result = diamonds
      .filter(d =>
        (filters.SizeRange ? d.SizeRange === filters.SizeRange : true) &&
        (filters.Clarity ? d.Clarity === filters.Clarity : true) &&
        (filters.Color ? d.Color === filters.Color : true) &&
        (filters.Cut ? d.Cut === filters.Cut : true) &&
        (filters.Polish ? d.Polish === filters.Polish : true) &&
        (filters.Symm ? d.Symm === filters.Symm : true) &&
        (filters.Fluorescence ? d.Fluorescence === filters.Fluorescence : true)
      )
      .sort((a, b) => {
        const sizeA = parseFloat(a.Size) || 0;
        const sizeB = parseFloat(b.Size) || 0;
        return sortOrder === 'asc' ? sizeA - sizeB : sizeB - sizeA;
      });
    setFiltered(result);
  }, [filters, diamonds, sortOrder]);

  const unique = (key: keyof Diamond) => Array.from(new Set(diamonds.map(d => d[key]))).sort();

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
    SizeRange: '', // 🔥 Reset Size filter on shape change
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
          >
            <option value="asc">Smallest to Largest</option>
            <option value="desc">Largest to Smallest</option>
          </select>
        </div>

        <div className={styles.catalogGrid}>
  {filtered.map(d => (
    <div className={`${styles.catalogCard} ${styles.labGrownPage}`} key={d.StoneId}>
      <div className="imageContainer">
        <img
          src={shapeIcon[d.Shape] || '/default.png'}
          alt={d.Shape}
          className="shapeImage"
        />
      </div>

      <div className="cardContent">
        <p>{d.Shape}</p>
        <p>{d.Size}ct (CVD*)</p>
        <p>{d.Measurement}</p>
        <p>D{d.Depth}; T{d.Table}</p>
        <p>{d.Clarity}, {d.Color}</p>
        <p>C:{d.Cut}, P:{d.Polish}, S:{d.Symm}</p>
        <p>F:{d.Fluorescence}</p>
      </div>

      <div className="cardFooter">
        <div className="codeSection">
          <span className="codeLabel">Code:</span>
          <span className="codeValue">{obfuscateStoneId(d.StoneId)}</span>
        </div>
        <a
          href={`https://wa.me/919023130944?text=I'm interested in diamond code: ${obfuscateStoneId(d.StoneId)}`}
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
