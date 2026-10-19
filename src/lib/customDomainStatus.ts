// Merchant-facing labels for Custom Domains V2 states (no fake progress/time).
export const CUSTOM_DOMAIN_STATE_LABEL: Record<string, string> = {
  pending_ownership: "Propriedade ainda não verificada",
  ownership_error: "Código de verificação incorreto ou expirado",
  ownership_verified: "Propriedade confirmada",
  dns_pending: "Aguardando propagação do DNS",
  dns_error: "Registros DNS incorretos",
  dns_verified: "DNS verificado — aguardando configuração de segurança",
  routing_provisioning: "Configurando roteamento",
  routing_error: "Erro ao configurar roteamento",
  ssl_provisioning: "Configurando certificado SSL",
  ssl_error: "Erro ao emitir certificado SSL",
  active: "Domínio conectado",
  needs_reverification: "Reconfiguração necessária",
  inactive: "Domínio desconectado",
  released: "Cadastro expirado",
};

export const customDomainStateLabel = (state: string | null | undefined) =>
  (state && CUSTOM_DOMAIN_STATE_LABEL[state]) || "Status desconhecido";

/** Only a state reported as active by the server counts as connected. */
export const isCustomDomainConnected = (d: { active?: boolean; state?: string | null } | null | undefined) =>
  !!d && d.active === true && d.state === "active";
