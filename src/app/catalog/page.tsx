import { Suspense } from 'react';
import CatalogPage from './CatalogPage';

export default function CatalogWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CatalogPage category="catalog" /> {/* ✅ Replace "gold" with desired category */}
    </Suspense>
  );
}
