// Benefit banners data — images in /public/benefits/ can be replaced without code changes
export interface BenefitBanner {
  id: number;
  name: string;
  image: string;
  /** Internal priority for mobile auto-selection (lower = higher priority) */
  mobilePriority: number;
}

export const BENEFIT_BANNERS: BenefitBanner[] = [
  { id: 1, name: "Frete Grátis", image: "/benefits/beneficio-01.png", mobilePriority: 1 },
  { id: 2, name: "Parcelamos em 12x", image: "/benefits/beneficio-02.png", mobilePriority: 2 },
  { id: 3, name: "Troca Garantida", image: "/benefits/beneficio-03.png", mobilePriority: 3 },
  { id: 4, name: "Compra Segura", image: "/benefits/beneficio-04.png", mobilePriority: 4 },
  { id: 5, name: "Entrega Rápida", image: "/benefits/beneficio-05.png", mobilePriority: 5 },
  { id: 6, name: "Atendimento 24h", image: "/benefits/beneficio-06.png", mobilePriority: 6 },
  { id: 7, name: "Produtos Originais", image: "/benefits/beneficio-07.png", mobilePriority: 7 },
  { id: 8, name: "Desconto Especial", image: "/benefits/beneficio-08.png", mobilePriority: 8 },
];

export const MAX_BENEFIT_BANNERS = 4;
export const MOBILE_BENEFIT_BANNERS = 2;

/**
 * Given the full list of selected banner IDs, returns the 2 with highest mobile priority.
 */
export function getMobileBanners(selectedIds: number[]): BenefitBanner[] {
  const selected = BENEFIT_BANNERS.filter((b) => selectedIds.includes(b.id));
  return selected
    .sort((a, b) => a.mobilePriority - b.mobilePriority)
    .slice(0, MOBILE_BENEFIT_BANNERS);
}
