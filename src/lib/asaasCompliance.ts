export type AsaasSealVariant = "positive" | "negative-black" | "negative-white";
export type AsaasSealSurface = "light" | "dark" | "auto";

export const ASAAS_SEAL_ALLOWED_HOST = "baas.asaas.com";
export const ASAAS_SEAL_REQUIRED_ID = "QB1VEH9J";
export const ASAAS_OFFICIAL_URL = "https://asaas.com";
export const ASAAS_SEAL_ALT = "Serviços financeiros Asaas";

/**
 * Official personalized seal URLs issued directly by Asaas for ShopDrive.
 * Loaded directly from baas.asaas.com so institutional updates propagate automatically.
 */
export const ASAAS_SEAL_URLS: Readonly<Record<AsaasSealVariant, string>> = Object.freeze({
  positive:
    "https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=QB1VEH9J",
  "negative-black":
    "https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Preto.svg?id=QB1VEH9J",
  "negative-white":
    "https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Branco.svg?id=QB1VEH9J",
});

export const ASAAS_SUPPORT = Object.freeze({
  title: "Suporte para serviços financeiros",
  description:
    "Para questões relacionadas aos serviços financeiros processados pelo Asaas, você também pode utilizar os canais oficiais da instituição.",
  phoneDisplay: "0800 009 0037",
  phoneHref: "tel:08000090037",
  email: "contato@asaas.com.br",
  emailHref: "mailto:contato@asaas.com.br",
  shopdriveScope:
    "Suporte ShopDrive: atendimento sobre o uso da plataforma e da integração tecnológica.",
  asaasScope:
    "Suporte Asaas: atendimento sobre os serviços financeiros processados pela instituição.",
});

export const ASAAS_REGULATORY_COPY = Object.freeze({
  cardTitle: "Asaas — Boletos e serviços financeiros",
  cardDescription:
    "Emita e acompanhe cobranças diretamente pela ShopDrive utilizando os serviços financeiros do Asaas.",
  cardProviderNotice: "Serviços financeiros prestados pelo Asaas.",
  cardActionLabel: "Ativar boletos Asaas",
  pageTitle: "Ativar serviços financeiros Asaas",
  pageSubtitle:
    "Conecte sua loja aos serviços financeiros do Asaas para emitir e acompanhar cobranças diretamente pela ShopDrive.",
  transparencyPrimary:
    "Os serviços financeiros e de pagamento desta funcionalidade são prestados pelo Asaas. A ShopDrive atua como plataforma tecnológica integrada.",
  transparencySecondary:
    "A conta financeira criada durante esta ativação será de titularidade do lojista e operada por meio da infraestrutura financeira do Asaas.",
  ownershipNotice:
    "A conta Asaas será criada em nome do próprio lojista responsável por esta loja.",
  homologationActionLabel: "Solicitar ativação",
  homologationUnavailableMessage: "Disponível após conclusão da homologação BaaS.",
  journeyStageNotice: "Etapa disponível após homologação",
  termsReferenceTitle: "Aviso regulatório (cláusula-base para Termos de Uso)",
  termsReferencePoints: [
    "Os serviços financeiros e de pagamentos disponibilizados nesta funcionalidade são prestados pelo Asaas.",
    "O Asaas é instituição de pagamento autorizada responsável pela operação financeira e regulatória.",
    "A ShopDrive atua exclusivamente como plataforma e integradora tecnológica.",
    "A ShopDrive não é instituição financeira nem instituição de pagamento.",
    "A responsabilidade regulatória pelos serviços financeiros é exclusivamente do Asaas.",
  ] as readonly string[],
});

export const ASAAS_JOURNEY_STEPS = [
  { step: 1, title: "Dados da empresa/pessoa", description: "Validação cadastral do titular da loja" },
  { step: 2, title: "Criação da conta Asaas", description: "Abertura de conta em nome do lojista no Asaas" },
  { step: 3, title: "Verificação de identidade/documentos", description: "Envio e validação documental exigida pelo Asaas" },
  { step: 4, title: "Análise", description: "Avaliação cadastral e regulatória conduzida pelo Asaas" },
  { step: 5, title: "Conta ativa", description: "Emissão e acompanhamento de cobranças liberados" },
] as const;

export function resolveAsaasSealVariant(
  surface: AsaasSealSurface = "light",
  isDarkTheme = false,
  explicitVariant?: AsaasSealVariant,
): AsaasSealVariant {
  if (explicitVariant && explicitVariant in ASAAS_SEAL_URLS) {
    return explicitVariant;
  }
  if (surface === "dark") return "negative-white";
  if (surface === "auto" && isDarkTheme) return "negative-white";
  return "positive";
}

export function getAsaasSealUrl(variant: AsaasSealVariant): string {
  const candidate = ASAAS_SEAL_URLS[variant];
  const parsed = new URL(candidate);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== ASAAS_SEAL_ALLOWED_HOST ||
    parsed.searchParams.get("id") !== ASAAS_SEAL_REQUIRED_ID
  ) {
    throw new Error("Invalid Asaas seal URL configuration");
  }
  return candidate;
}

export interface AsaasHomologationAccess {
  enabled: boolean;
  mode: "homologation_only";
  storeId: string | null;
}

export function parseAsaasHomologationAccess(
  data: unknown,
  expectedStoreId: string | null,
): AsaasHomologationAccess {
  if (!data || typeof data !== "object") {
    return { enabled: false, mode: "homologation_only", storeId: null };
  }
  const row = data as Record<string, unknown>;
  const storeId = typeof row.storeId === "string" ? row.storeId : null;
  const matchesStore = !expectedStoreId || storeId === expectedStoreId;
  return {
    enabled: row.enabled === true && matchesStore,
    mode: "homologation_only",
    storeId: matchesStore ? storeId : null,
  };
}