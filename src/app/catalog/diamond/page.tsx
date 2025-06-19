import { Suspense } from 'react';
import DiamondCatalog from './DiamondCatalog';

export default function DiamondCatalogPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DiamondCatalog />
    </Suspense>
  );
}
