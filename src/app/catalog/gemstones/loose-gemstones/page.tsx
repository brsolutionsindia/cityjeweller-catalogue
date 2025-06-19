// /src/app/catalog/gemstones/loose-gemstones/page.tsx
'use client';

import { Suspense } from 'react';
import LooseGemstoneCatalog from './LooseGemstoneCatalog';

export default function LooseGemstonePage() {
  return (
    <Suspense fallback={<div>Loading Loose Gemstones...</div>}>
      <LooseGemstoneCatalog />
    </Suspense>
  );
}
