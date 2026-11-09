// Normalização única das cotações Melhor Envio/Correios usada pela função
// calculate-melhor-envio e pelo checkout. Módulo puro (sem Deno/Vite).
//
// IDs confirmados na resposta real da API vigente (company Correios):
//   1 = PAC, 2 = SEDEX, 17 = Mini Envios.

export type CorreiosServiceKey = "sedex" | "pac" | "mini_envios";

export type UnavailableReason =
  | "route"        // transportadora não atende o trecho (CEP)
  | "dimensions"   // dimensões fora do limite do serviço
  | "weight"       // peso fora do limite do serviço
  | "insurance"    // valor segurado acima do limite do serviço
  | "not_returned" // serviço solicitado e não retornado pelo provedor
  | "other";

export const CORREIOS_SERVICE_IDS: Record<CorreiosServiceKey, number> = {
  pac: 1,
  sedex: 2,
  mini_envios: 17,
};

export const REQUESTED_SERVICES = "1,2,17";

export const SERVICE_KEYS: CorreiosServiceKey[] = ["sedex", "pac", "mini_envios"];

export interface NormalizedQuote {
  id: number;
  service_key: CorreiosServiceKey;
  name: string;
  company: string;
  price: number;
  custom_price: number;
  discount: number;
  delivery_time: number;
  delivery_range: { min: number; max: number };
  currency: string;
  error: null;
}

export interface ServiceStatus {
  service_key: CorreiosServiceKey;
  available: boolean;
  reason: UnavailableReason | null;
  /** Mensagem do provedor, preservada de forma controlada (sem dados sensíveis). */
  provider_message: string | null;
}

const normalizeText = (v: unknown) =>
  typeof v === "string" ? v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() : "";

/** Identifica o serviço pelo ID estável; o nome é usado só para confirmar/fallback. */
export function classifyService(raw: { id?: unknown; name?: unknown; company?: unknown } | null | undefined): CorreiosServiceKey | null {
  if (!raw) return null;
  const id = typeof raw.id === "number" ? raw.id : Number(raw.id);
  const name = normalizeText(raw.name);
  const companyRaw = typeof raw.company === "object" && raw.company !== null
    ? (raw.company as { name?: unknown }).name
    : raw.company;
  const company = normalizeText(companyRaw);
  if (company && !company.includes("CORREIOS")) return null;

  const byId = (Object.keys(CORREIOS_SERVICE_IDS) as CorreiosServiceKey[])
    .find((k) => CORREIOS_SERVICE_IDS[k] === id);
  if (byId) return byId;

  if (name === "SEDEX") return "sedex";
  if (name === "PAC") return "pac";
  if (name.startsWith("MINI ENVIO")) return "mini_envios";
  return null;
}

export function classifyUnavailability(message: unknown): UnavailableReason {
  const m = normalizeText(message);
  if (!m) return "other";
  if (m.includes("TRECHO") || m.includes("CEP")) return "route";
  if (m.includes("SEGURADO") || m.includes("DECLARADO")) return "insurance";
  if (m.includes("PESO")) return "weight";
  if (m.includes("DIMENS") || m.includes("MEDIDA") || m.includes("TAMANHO")) return "dimensions";
  return "other";
}

const toMoney = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : NaN;
};

const toInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Interpreta cada serviço individualmente: um erro em um serviço nunca
 * afeta os demais. Só é "disponível" quem tiver preço real > 0 e prazo.
 */
export function normalizeMelhorEnvioResponse(data: unknown): { quotes: NormalizedQuote[]; services: ServiceStatus[] } {
  const list = Array.isArray(data) ? data : [];
  const quotes: NormalizedQuote[] = [];
  const statuses = new Map<CorreiosServiceKey, ServiceStatus>();

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const q = raw as Record<string, unknown>;
    const key = classifyService(q as { id?: unknown; name?: unknown; company?: unknown });
    if (!key || statuses.get(key)?.available) continue;

    const providerError = typeof q.error === "string" && q.error.trim() ? q.error.trim().slice(0, 200) : null;
    const price = toMoney(q.price);
    const customPrice = toMoney(q.custom_price);
    const finalPrice = Number.isFinite(customPrice) && customPrice > 0 ? customPrice : price;
    const deliveryTime = toInt(q.delivery_time);

    if (providerError || !Number.isFinite(finalPrice) || finalPrice <= 0 || deliveryTime === null) {
      statuses.set(key, {
        service_key: key,
        available: false,
        reason: providerError ? classifyUnavailability(providerError) : "other",
        provider_message: providerError,
      });
      continue;
    }

    const range = (q.delivery_range ?? {}) as { min?: unknown; max?: unknown };
    const min = toInt(range.min) ?? deliveryTime;
    const max = toInt(range.max) ?? deliveryTime;
    const discount = toMoney(q.discount);
    const company = typeof q.company === "object" && q.company !== null
      ? String((q.company as { name?: unknown }).name ?? "Correios")
      : String(q.company ?? "Correios");

    quotes.push({
      id: CORREIOS_SERVICE_IDS[key],
      service_key: key,
      name: typeof q.name === "string" ? q.name : key,
      company,
      price: Number.isFinite(price) && price > 0 ? price : finalPrice,
      custom_price: finalPrice,
      discount: Number.isFinite(discount) ? discount : 0,
      delivery_time: deliveryTime,
      delivery_range: { min, max },
      currency: typeof q.currency === "string" ? q.currency : "R$",
      error: null,
    });
    statuses.set(key, { service_key: key, available: true, reason: null, provider_message: null });
  }

  for (const key of SERVICE_KEYS) {
    if (!statuses.has(key)) {
      statuses.set(key, { service_key: key, available: false, reason: "not_returned", provider_message: null });
    }
  }

  return { quotes, services: SERVICE_KEYS.map((k) => statuses.get(k)!) };
}

/** Seleção de cotação no checkout, usando a mesma classificação do backend. */
export function findQuote<T extends { service_key?: string; id?: unknown; name?: unknown; company?: unknown }>(
  quotes: T[] | null | undefined,
  key: CorreiosServiceKey,
): T | undefined {
  return (quotes ?? []).find((q) => (q.service_key ?? classifyService(q)) === key);
}

export interface ShippingProductInput {
  id?: unknown;
  width?: unknown;
  height?: unknown;
  length?: unknown;
  weight?: unknown;
  insurance_value?: unknown;
  quantity?: unknown;
}

const positive = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Payload por produto conforme contrato Melhor Envio: dimensões em cm, peso em kg,
 * insurance_value POR UNIDADE (o provedor multiplica pela quantidade).
 * Fallbacks preservados do comportamento existente (11 x 2 x 16 cm, 0,3 kg).
 */
export function buildShippingProducts(products: ShippingProductInput[]) {
  return products.map((p, i) => ({
    id: typeof p.id === "string" && p.id ? p.id : `product-${i}`,
    width: positive(p.width, 11),
    height: positive(p.height, 2),
    length: positive(p.length, 16),
    weight: positive(p.weight, 0.3),
    insurance_value: Math.round(positive(p.insurance_value, 0) * 100) / 100,
    quantity: Math.max(1, Math.floor(positive(p.quantity, 1))),
  }));
}

export const maskCep = (cep: string) => {
  const d = cep.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-***` : "invalid";
};
