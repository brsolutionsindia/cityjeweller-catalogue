// src/app/catalog/utils.ts

export const computeAdjustedPrice = (
  rawPrice: string | number | undefined,
  multiplier: number = 1
): number | 'N/A' => {
  const parsed = typeof rawPrice === 'string' || typeof rawPrice === 'number'
    ? parseFloat(String(rawPrice))
    : NaN;

  const basePrice = !isNaN(parsed) ? parsed / 1.03 : null;

  return basePrice ? Math.round(basePrice * multiplier) : 'N/A';
};
