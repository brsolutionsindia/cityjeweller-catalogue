import { Suspense } from 'react';
import CatalogView from '../CatalogView';

export default function MiscPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CatalogView category="misc" />
    </Suspense>
  );
}
