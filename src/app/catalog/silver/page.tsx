'use client';

import { Suspense } from 'react';
import SilverCatalog from './SilverCatalog';

export default function SilverCatalogPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SilverCatalog />
    </Suspense>
  );
}
