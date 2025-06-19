import { Suspense } from 'react';
import GoldCatalog from './GoldCatalog';

export default function GoldCatalogPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GoldCatalog />
    </Suspense>
  );
}
