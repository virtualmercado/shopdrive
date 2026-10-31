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

interface DomainLike {
  flow_version?: number;
  domain?: string | null;
  display_hostname?: string | null;
  released?: boolean;
  active?: boolean;
  state?: string | null;
  ownership_verified_at?: string | null;
  dns_verified_at?: string | null;
  routing_status?: string;
  ssl_status?: string;
}

/** Hostname shown to the merchant: the exact authorized host (keeps www) when the server provides one. */
export const customDomainDisplayHostname = (d: DomainLike | null | undefined) =>
  d?.display_hostname || d?.domain || "";

/** Contextual main action: never offer "connect" to a store that already has a domain. */
export const customDomainCtaLabel = (d: DomainLike | null | undefined) => {
  if (d && !d.released) return isCustomDomainConnected(d) ? "Gerenciar domínio" : "Continuar configuração";
  return "Conectar domínio próprio";
};

export interface DomainChecklistItem { key: string; label: string; done: boolean; attention: boolean }

/** Real provisioning checklist; every flag comes from server-reported state, never assumed. */
export const customDomainChecklist = (d: DomainLike | null | undefined): DomainChecklistItem[] => {
  const owned = !!d?.ownership_verified_at;
  const dns = !!d?.dns_verified_at;
  const routing = d?.routing_status === "active";
  const ssl = d?.ssl_status === "active";
  return [
    { key: "ownership", label: "Propriedade confirmada", done: owned, attention: !!d && !owned },
    { key: "dns", label: "DNS configurado", done: dns, attention: owned && !dns },
    { key: "routing", label: "Roteamento ativo", done: routing, attention: dns && !routing && d?.routing_status === "error" },
    { key: "ssl", label: "SSL ativo", done: ssl, attention: routing && !ssl && d?.ssl_status === "error" },
    { key: "publication", label: "Loja publicada", done: isCustomDomainConnected(d), attention: false },
  ];
};

/** Shared presentation only: authorization and all provisioning states remain server-owned. */
export const customDomainPresentation = <T extends DomainLike>(record: T | null | undefined) => {
  const domain = record && !record.released ? record : null;
  const hostname = customDomainDisplayHostname(domain);
  return {
    domain,
    hostname,
    address: hostname ? `https://${hostname}` : "",
    connected: isCustomDomainConnected(domain),
    ctaLabel: customDomainCtaLabel(domain),
    stateLabel: customDomainStateLabel(domain?.state),
    checklist: customDomainChecklist(domain),
  };
};
