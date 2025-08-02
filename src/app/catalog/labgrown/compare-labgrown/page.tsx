import { Suspense } from 'react';
import CompareLabGrown from './CompareLabGrown';

export default function Page() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '2rem' }}>Loading comparison...</div>}>
      <CompareLabGrown />
    </Suspense>
  );
}
