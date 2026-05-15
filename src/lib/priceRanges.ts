// Faixas de preço fixas usadas no filtro lateral da loja pública.
// Mantém propositalmente o intervalo R$ 50,00–R$ 69,99 fora das faixas,
// conforme regra estratégica definida pelo administrador.

export type PriceRangeId =
  | "0-24.99"
  | "25-49.99"
  | "70-99.99"
  | "100-199.99"
  | "above-199.99";

export interface PriceRange {
  id: PriceRangeId;
  label: string;
  min: number;
  max: number | null; // null = sem limite superior
  inclusiveMax: boolean;
}

export const PRICE_RANGES: PriceRange[] = [
  { id: "0-24.99", label: "de R$ 0,00 até R$ 24,99", min: 0, max: 24.99, inclusiveMax: true },
  { id: "25-49.99", label: "de R$ 25,00 até R$ 49,99", min: 25, max: 49.99, inclusiveMax: true },
  { id: "70-99.99", label: "de R$ 70,00 até R$ 99,99", min: 70, max: 99.99, inclusiveMax: true },
  { id: "100-199.99", label: "de R$ 100,00 até R$ 199,99", min: 100, max: 199.99, inclusiveMax: true },
  { id: "above-199.99", label: "Acima de R$ 199,99", min: 199.99, max: null, inclusiveMax: false },
];

export const isValidPriceRangeId = (value: string | null | undefined): value is PriceRangeId =>
  !!value && PRICE_RANGES.some(r => r.id === value);

// Preço efetivo exibido no card (considera promocional quando válido)
export const getEffectivePrice = (product: { price: number; promotional_price?: number | null }): number => {
  const promo = product.promotional_price;
  if (promo != null && promo > 0 && promo < product.price) return promo;
  return product.price;
};

const matches = (price: number, range: PriceRange): boolean => {
  if (price < range.min) return false;
  if (range.max == null) {
    return range.inclusiveMax ? price >= range.min : price > range.min;
  }
  return range.inclusiveMax ? price <= range.max : price < range.max;
};

export const filterByPriceRange = <T extends { price: number; promotional_price?: number | null }>(
  products: T[],
  rangeId: PriceRangeId | null,
): T[] => {
  if (!rangeId) return products;
  const range = PRICE_RANGES.find(r => r.id === rangeId);
  if (!range) return products;
  return products.filter(p => matches(getEffectivePrice(p), range));
};

export const calculatePriceRangeCounts = <T extends { price: number; promotional_price?: number | null }>(
  products: T[],
): Record<PriceRangeId, number> => {
  const counts = {
    "0-24.99": 0,
    "25-49.99": 0,
    "70-99.99": 0,
    "100-199.99": 0,
    "above-199.99": 0,
  } as Record<PriceRangeId, number>;
  for (const p of products) {
    const price = getEffectivePrice(p);
    for (const r of PRICE_RANGES) {
      if (matches(price, r)) counts[r.id]++;
    }
  }
  return counts;
};
