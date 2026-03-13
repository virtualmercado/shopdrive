// Benefit banners data — images in /public/benefits/ can be replaced without code changes
export interface BenefitBanner {
  id: number;
  name: string;
  subtitle: string;
  image: string;
  /** Internal priority for mobile auto-selection (lower = higher priority) */
  mobilePriority: number;
}

export const BENEFIT_BANNERS: BenefitBanner[] = [
  { id: 1, name: "Compre pelo WhatsApp", subtitle: "Direto do seu celular", image: "/benefits/beneficio-01.png", mobilePriority: 1 },
  { id: 2, name: "Parcele suas compras", subtitle: "Sem apertar no seu orçamento", image: "/benefits/beneficio-02.png", mobilePriority: 2 },
  { id: 3, name: "Pagamento via PIX", subtitle: "De forma rápida e segura", image: "/benefits/beneficio-03.png", mobilePriority: 3 },
  { id: 4, name: "Compra segura", subtitle: "Seus dados protegidos", image: "/benefits/beneficio-04.png", mobilePriority: 4 },
  { id: 5, name: "Entrega rápida", subtitle: "Entregamos em todo o país", image: "/benefits/beneficio-05.png", mobilePriority: 5 },
  { id: 6, name: "Produtos originais", subtitle: "Autenticidade Garantida", image: "/benefits/beneficio-06.png", mobilePriority: 6 },
  { id: 7, name: "Descontos especiais", subtitle: "Preços abaixo da tabela", image: "/benefits/beneficio-07.png", mobilePriority: 7 },
  { id: 8, name: "Suporte pós vendas", subtitle: "Suporte dedicado e garantido", image: "/benefits/beneficio-08.png", mobilePriority: 8 },
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
