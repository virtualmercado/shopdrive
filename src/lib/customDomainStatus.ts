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
  /** Server-reported flag for domains administered by ShopDrive (merchant actions are refused server-side). */
  managed_by_platform?: boolean;
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
    managed: domain?.managed_by_platform === true,
    ctaLabel: customDomainCtaLabel(domain),
    stateLabel: customDomainStateLabel(domain?.state),
    checklist: customDomainChecklist(domain),
  };
};

/** Copy for the server-reported reason the feature is unavailable to this store. */
export const customDomainUnavailableCopy = (reason?: string | null) => {
  if (reason === "plan") return {
    title: "Use o endereço da sua própria marca",
    body: "Conecte www.sualoja.com.br à sua loja ShopDrive nos planos Premium e MARCA.",
  };
  if (reason === "blocked") return {
    title: "Domínio próprio indisponível para esta loja",
    body: "Fale com o suporte ShopDrive para mais informações. Sua loja continua funcionando normalmente no endereço ShopDrive.",
  };
  return {
    title: "Domínio próprio temporariamente indisponível",
    body: "Estamos preparando a conexão segura de domínios. Sua loja continua funcionando normalmente no endereço ShopDrive.",
  };
};

// ---------- Merchant card view (presentation only; every state comes from the server) ----------

export const CUSTOM_DOMAIN_PROGRESS_STEPS = ["Domínio", "DNS", "Verificação", "Conectado"] as const;
export type CustomDomainStep = 1 | 2 | 3 | 4;

export type CustomDomainCardKind =
  | "load_error" | "upgrade" | "blocked" | "unavailable"
  | "empty" | "setup" | "processing" | "attention" | "connected" | "managed";

export interface CustomDomainCardView {
  kind: CustomDomainCardKind;
  /** Current step of the 4-step guide; null when the guide does not apply. */
  step: CustomDomainStep | null;
  title: string;
  description: string;
  /** Server is finishing the setup automatically; the merchant must not change DNS again. */
  automatic?: boolean;
}

const PROCESSING: Record<string, { title: string; description: string; automatic: boolean }> = {
  dns_verified: {
    title: "DNS verificado",
    description: "Seu DNS está correto. Você não precisa alterar o DNS novamente — falta apenas concluir a ativação.",
    automatic: false,
  },
  routing_provisioning: {
    title: "Configurando domínio",
    description: "Estamos concluindo a configuração. Você não precisa alterar o DNS novamente.",
    automatic: true,
  },
  ssl_provisioning: {
    title: "Aguardando certificado de segurança",
    description: "Estamos concluindo a configuração. Você não precisa alterar o DNS novamente.",
    automatic: true,
  },
  active: {
    title: "Configurando domínio",
    description: "Estamos concluindo a configuração. Você não precisa alterar o DNS novamente.",
    automatic: true,
  },
};

const ATTENTION: Record<string, { step: CustomDomainStep; title: string; description: string }> = {
  ownership_error: { step: 2, title: "Não conseguimos confirmar a configuração do domínio.", description: "O registro TXT de verificação não confere ou o código expirou. Confira o valor e verifique novamente." },
  dns_error: { step: 2, title: "Não conseguimos confirmar a configuração do domínio.", description: "O CNAME do www ainda não aponta para domains.shopdrive.com.br. Confira o DNS e verifique novamente." },
  routing_error: { step: 3, title: "Não conseguimos confirmar a configuração do domínio.", description: "A ativação do domínio não foi concluída. Verifique novamente em alguns minutos." },
  ssl_error: { step: 3, title: "Não conseguimos confirmar a configuração do domínio.", description: "O certificado de segurança ainda não foi emitido. Verifique novamente em alguns minutos." },
  needs_reverification: { step: 2, title: "Não conseguimos confirmar a configuração do domínio.", description: "Precisamos confirmar novamente a configuração do seu domínio." },
  inactive: { step: 2, title: "Domínio desconectado", description: "Este domínio não está mais ligado à sua loja. Configure-o novamente para voltar a usá-lo." },
};

interface OverviewLike {
  available?: boolean;
  unavailable_reason?: string | null;
  domain?: DomainLike | null;
}

/** Maps only existing server states to one merchant card view; never creates a new state. */
export const customDomainCardView = (
  overview: OverviewLike | null | undefined,
  loadError?: unknown,
): CustomDomainCardView => {
  if (loadError) return { kind: "load_error", step: null, title: "Não foi possível carregar o domínio próprio agora.", description: "Tente novamente mais tarde." };
  if (!overview?.available) {
    const copy = customDomainUnavailableCopy(overview?.unavailable_reason);
    const kind = overview?.unavailable_reason === "plan" ? "upgrade" : overview?.unavailable_reason === "blocked" ? "blocked" : "unavailable";
    return { kind, step: null, title: copy.title, description: copy.body };
  }
  const p = customDomainPresentation(overview.domain);
  if (!p.domain) return {
    kind: "empty", step: 1, title: "Conecte seu domínio próprio",
    description: "Use o endereço da sua marca sem alterar seus produtos, pedidos ou configurações atuais.",
  };
  if (p.connected) return p.managed
    ? { kind: "managed", step: 4, title: "Domínio conectado", description: "Este domínio possui configuração administrada pela ShopDrive." }
    : { kind: "connected", step: 4, title: "Domínio conectado", description: "Seu domínio está ativo e direcionando corretamente para esta loja." };
  const state = p.domain.state ?? "";
  if (PROCESSING[state]) return { kind: "processing", step: 3, ...PROCESSING[state] };
  if (ATTENTION[state]) return { kind: "attention", ...ATTENTION[state] };
  return {
    kind: "setup", step: 2, title: "Configure o DNS do seu domínio",
    description: "Crie os registros abaixo no painel onde o DNS do seu domínio é administrado. Utilize o endereço com www.",
  };
};
