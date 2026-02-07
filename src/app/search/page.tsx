'use client';

import { Suspense } from 'react';
import SearchClient from './SearchClient';

function PageFallback() {
  return (
    <div style={{ padding: '1.25rem' }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Searching…
      </div>
      <div style={{ opacity: 0.7 }}>Fetching products from our catalogue.</div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <SearchClient />
    </Suspense>
  );
}
