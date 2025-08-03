import { Suspense } from 'react';
import CompareNaturalDiamond from './CompareNaturalDiamond';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CompareNaturalDiamond />
    </Suspense>
  );
}
