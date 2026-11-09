// O checkout usa exatamente a mesma normalização da função de cotação.
export {
  findQuote,
  classifyService,
  type CorreiosServiceKey,
  type ServiceStatus,
  type UnavailableReason,
} from "../../supabase/functions/_shared/melhorEnvioQuotes";

import type { ServiceStatus, CorreiosServiceKey } from "../../supabase/functions/_shared/melhorEnvioQuotes";

/** Texto exibido para um serviço Correios sem cotação válida (mantém as mensagens atuais). */
export function unavailableLabel(services: ServiceStatus[] | null | undefined, key: CorreiosServiceKey): string {
  const reason = (services ?? []).find((s) => s.service_key === key)?.reason;
  if (reason === "dimensions" || reason === "weight") return "Peso ou dimensões excedem o limite";
  if (reason === "insurance") return "Valor do pedido excede o limite";
  return "Não disponível para este CEP";
}
