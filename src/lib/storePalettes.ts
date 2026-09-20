/**
 * Catálogo OFICIAL de paletas da ShopDrive.
 * Fonte única para o menu Personalizar e para a recomendação de identidade do onboarding.
 * O espelho usado pelo backend fica em supabase/functions/_shared/storePalettes.ts.
 */

export type PaletteIconType =
  | "leaf"
  | "waves"
  | "mountain"
  | "moon"
  | "circle"
  | "heart"
  | "flame"
  | "tree"
  | "sparkles";

export interface ColorPalette {
  id: string;
  name: string;
  iconType: PaletteIconType;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    headerBg: string;
    headerText: string;
    buttonBg: string;
    buttonText: string;
    footerBg: string;
    footerText: string;
    topBarBg: string;
    topBarText: string;
  };
}

export const PREDEFINED_PALETTES: ColorPalette[] = [
  {
    id: "verde-natural",
    name: "Verde Natural",
    iconType: "leaf",
    description: "Natureza, sustentabilidade, bem-estar",
    colors: {
      primary: "#2E7D32",
      secondary: "#81C784",
      headerBg: "#E8F5E9",
      headerText: "#1B5E20",
      buttonBg: "#2E7D32",
      buttonText: "#FFFFFF",
      footerBg: "#1B5E20",
      footerText: "#FFFFFF",
      topBarBg: "#1B5E20",
      topBarText: "#FFFFFF",
    },
  },
  {
    id: "azul-profissional",
    name: "Azul Profissional",
    iconType: "waves",
    description: "Confiança, tecnologia, serviços",
    colors: {
      primary: "#1565C0",
      secondary: "#64B5F6",
      headerBg: "#E3F2FD",
      headerText: "#0D47A1",
      buttonBg: "#1565C0",
      buttonText: "#FFFFFF",
      footerBg: "#0D47A1",
      footerText: "#FFFFFF",
      topBarBg: "#0D47A1",
      topBarText: "#FFFFFF",
    },
  },
  {
    id: "terrosa-amazonica",
    name: "Terrosa Amazônica",
    iconType: "mountain",
    description: "Tons quentes, orgânicos, artesanais",
    colors: {
      primary: "#8D6E63",
      secondary: "#D7CCC8",
      headerBg: "#EFEBE9",
      headerText: "#5D4037",
      buttonBg: "#6D4C41",
      buttonText: "#FFFFFF",
      footerBg: "#4E342E",
      footerText: "#FFFFFF",
      topBarBg: "#5D4037",
      topBarText: "#FFFFFF",
    },
  },
  {
    id: "elegante-escura",
    name: "Elegante Escura",
    iconType: "moon",
    description: "Fundo escuro, alto contraste, premium",
    colors: {
      primary: "#212121",
      secondary: "#FFD700",
      headerBg: "#1A1A1A",
      headerText: "#FFFFFF",
      buttonBg: "#FFD700",
      buttonText: "#000000",
      footerBg: "#0D0D0D",
      footerText: "#CCCCCC",
      topBarBg: "#FFD700",
      topBarText: "#000000",
    },
  },
  {
    id: "neutra-clean",
    name: "Neutra Clean",
    iconType: "circle",
    description: "Minimalista, branco, cinza-claro",
    colors: {
      primary: "#424242",
      secondary: "#9E9E9E",
      headerBg: "#FAFAFA",
      headerText: "#212121",
      buttonBg: "#424242",
      buttonText: "#FFFFFF",
      footerBg: "#EEEEEE",
      footerText: "#424242",
      topBarBg: "#424242",
      topBarText: "#FFFFFF",
    },
  },
  {
    id: "suave-feminina",
    name: "Suave Feminina",
    iconType: "heart",
    description: "Tons rosados, lilás, bege suave",
    colors: {
      primary: "#AD1457",
      secondary: "#F8BBD0",
      headerBg: "#FCE4EC",
      headerText: "#880E4F",
      buttonBg: "#AD1457",
      buttonText: "#FFFFFF",
      footerBg: "#F3E5F5",
      footerText: "#4A148C",
      topBarBg: "#AD1457",
      topBarText: "#FFFFFF",
    },
  },
  {
    id: "vibrante-moderna",
    name: "Vibrante Moderna",
    iconType: "flame",
    description: "Cores vivas para CTA e destaque",
    colors: {
      primary: "#FF5722",
      secondary: "#FFAB91",
      headerBg: "#FBE9E7",
      headerText: "#BF360C",
      buttonBg: "#FF5722",
      buttonText: "#FFFFFF",
      footerBg: "#BF360C",
      footerText: "#FFFFFF",
      topBarBg: "#FF5722",
      topBarText: "#FFFFFF",
    },
  },
  {
    id: "sofisticada-natural",
    name: "Sofisticada Natural",
    iconType: "tree",
    description: "Verde fechado, marrom, off-white, dourado",
    colors: {
      primary: "#33691E",
      secondary: "#C5A572",
      headerBg: "#F5F5DC",
      headerText: "#33691E",
      buttonBg: "#33691E",
      buttonText: "#FFFFFF",
      footerBg: "#2E5A1C",
      footerText: "#F5F5DC",
      topBarBg: "#C5A572",
      topBarText: "#1A1A1A",
    },
  },
  {
    id: "roxo-criativo",
    name: "Roxo Criativo",
    iconType: "sparkles",
    description: "Criatividade, originalidade, identidade digital",
    colors: {
      primary: "#7B1FA2",
      secondary: "#E1BEE7",
      headerBg: "#F3E5F5",
      headerText: "#4A148C",
      buttonBg: "#E91E63",
      buttonText: "#FFFFFF",
      footerBg: "#4A148C",
      footerText: "#FFFFFF",
      topBarBg: "#E91E63",
      topBarText: "#FFFFFF",
    },
  },
  {
    id: "azul-neon",
    name: "Azul Neon",
    iconType: "waves",
    description: "Moderno, digital, alto impacto visual",
    colors: {
      primary: "#00B0FF",
      secondary: "#E0F7FA",
      headerBg: "#1A1A2E",
      headerText: "#00B0FF",
      buttonBg: "#00E676",
      buttonText: "#000000",
      footerBg: "#0D0D1A",
      footerText: "#00B0FF",
      topBarBg: "#00E676",
      topBarText: "#000000",
    },
  },
  {
    id: "laranja-urbano",
    name: "Laranja Urbano",
    iconType: "flame",
    description: "Energia, atitude, estilo urbano",
    colors: {
      primary: "#FF6D00",
      secondary: "#FFE0B2",
      headerBg: "#FFF8E1",
      headerText: "#E65100",
      buttonBg: "#FF6D00",
      buttonText: "#FFFFFF",
      footerBg: "#BF360C",
      footerText: "#FFFFFF",
      topBarBg: "#E65100",
      topBarText: "#FFFFFF",
    },
  },
  {
    id: "pop-colorida",
    name: "Pop Colorida",
    iconType: "heart",
    description: "Divertida, ousada, cheia de personalidade",
    colors: {
      primary: "#F50057",
      secondary: "#FFEB3B",
      headerBg: "#FAFAFA",
      headerText: "#212121",
      buttonBg: "#F50057",
      buttonText: "#FFFFFF",
      footerBg: "#00BCD4",
      footerText: "#FFFFFF",
      topBarBg: "#F50057",
      topBarText: "#FFFFFF",
    },
  },
];

export const PALETTE_IDS = PREDEFINED_PALETTES.map((p) => p.id);

export function getPaletteById(id: string | null | undefined): ColorPalette | null {
  if (!id) return null;
  return PREDEFINED_PALETTES.find((p) => p.id === id) ?? null;
}

export const OFFICIAL_LAYOUTS = [
  { id: "layout_01", name: "Clássico", description: "Estrutura equilibrada, objetiva e generalista." },
  { id: "layout_02", name: "Conversão", description: "Venda rápida: ofertas, promoções e CTA em destaque." },
  { id: "layout_03", name: "Marca & Conteúdo", description: "Storytelling, posicionamento e autoridade da marca." },
] as const;

export function getLayoutById(id: string | null | undefined) {
  return OFFICIAL_LAYOUTS.find((l) => l.id === id) ?? null;
}
