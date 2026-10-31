import { neutralizeFormula } from "@/lib/safeOutput";
/** Helpers puros da lista de Assinantes do Master (contatos, rótulos e CSV). */

export const NOT_INFORMED = "Não informado";

export interface SubscriberRow {
  id: string;
  store_name: string | null;
  full_name: string | null;
  store_slug: string | null;
  account_status: string | null;
  created_at: string;
  cpf_cnpj: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
  account_email: string | null;
  profile_email: string | null;
  phone: string | null;
  whatsapp: string | null;
  plan_code: string;
  subscription_status: string;
  filter_status: string;
  product_count: number;
  setup_status: "ready" | "incomplete" | null;
  progress_percent: number | null;
}

export const onlyDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/**
 * Normaliza telefone brasileiro para 55DDDNÚMERO somente quando é seguro:
 * 10/11 dígitos (DDD + número) ou 12/13 começando com 55. Caso contrário null (não inventa DDI).
 */
export const normalizePhoneBR = (v: string | null | undefined): string | null => {
  const d = onlyDigits(v).replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
};

/** Número de contato principal: WhatsApp cadastrado, senão telefone. */
export const primaryContactPhone = (r: Pick<SubscriberRow, "whatsapp" | "phone">) => r.whatsapp || r.phone || null;

export const PLAN_LABELS: Record<string, string> = {
  gratis: "GRÁTIS", free: "GRÁTIS", pro: "PRO", premium: "PREMIUM", marca: "MARCA",
};
export const planLabel = (code: string | null | undefined) => PLAN_LABELS[code ?? "gratis"] ?? (code || "GRÁTIS").toUpperCase();

export const STATUS_LABELS: Record<string, string> = {
  active: "Ativo", inactive: "Inativo", pending: "Pagamento pendente", suspenso: "Suspenso",
  bloqueado: "Bloqueado", exclusao_solicitada: "Exclusão solicitada", excluida: "Excluído",
};
export const statusLabel = (s: string) => STATUS_LABELS[s] ?? s;

export const setupLabel = (r: Pick<SubscriberRow, "setup_status" | "progress_percent">) => {
  if (!r.setup_status) return NOT_INFORMED;
  const pct = r.progress_percent != null ? ` (${r.progress_percent}%)` : "";
  return (r.setup_status === "ready" ? "Pronta" : "Incompleta") + pct;
};

export const publicStoreUrl = (slug: string | null) => (slug ? `https://shopdrive.com.br/${slug}` : "");

export const formatAddress = (r: SubscriberRow) => {
  const parts = [
    [r.address, r.address_number].filter(Boolean).join(", "),
    r.address_complement,
    r.address_neighborhood,
    [r.address_city, r.address_state].filter(Boolean).join("/"),
    r.address_zip_code,
  ].filter((p) => p && String(p).trim());
  return parts.length ? parts.join(" - ") : null;
};

const csvCell = (v: unknown) => {
  const s = neutralizeFormula(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_HEADERS = [
  "Loja", "Responsável", "E-mail da conta", "E-mail comercial", "Telefone", "WhatsApp",
  "Telefone/WhatsApp normalizado", "Plano", "Status", "Produtos", "Data de cadastro",
  "Configuração", "Slug", "Link público",
];

/** CSV UTF-8 com BOM e separador ";" (compatível com Excel pt-BR). */
export const buildSubscribersCsv = (rows: SubscriberRow[], fmtDate: (iso: string) => string) => {
  const lines = [CSV_HEADERS.join(";")];
  for (const r of rows) {
    const commercial = r.profile_email && r.profile_email !== r.account_email ? r.profile_email : "";
    lines.push([
      r.store_name, r.full_name, r.account_email, commercial, r.phone, r.whatsapp,
      normalizePhoneBR(primaryContactPhone(r)) ?? "",
      planLabel(r.plan_code), statusLabel(r.filter_status), r.product_count,
      fmtDate(r.created_at), setupLabel(r), r.store_slug, publicStoreUrl(r.store_slug),
    ].map(csvCell).join(";"));
  }
  return "\uFEFF" + lines.join("\r\n");
};
