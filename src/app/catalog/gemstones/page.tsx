// /src/app/catalog/gemstones/page.tsx
'use client';

import { Suspense } from 'react';
import GemstoneStringCatalog from './GemstoneStringCatalog';

export default function GemstonePage() {
  return (
    <Suspense fallback={<div>Loading gemstones...</div>}>
      <GemstoneStringCatalog />
    </Suspense>
  );
}
