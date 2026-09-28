/**
 * Minha Rede (Plano MARCA) — helpers de APRESENTAÇÃO.
 * Nenhuma métrica é calculada aqui: todos os números vêm das RPCs
 * get_my_brand_network_*. Aqui só há período, formatação e links.
 */
import { getTemplateActivationLink, getWhatsAppShareMessage } from '@/hooks/useBrandTemplates';

export type NetworkBucket = 'day' | 'week' | 'month';
export type PeriodPreset = '7d' | '30d' | '90d' | 'custom';

export const NETWORK_PAGE_SIZE = 50;
export const MAX_CUSTOM_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

export interface NetworkSummary {
  validClicks: number;
  validActivations: number;
  conversionPercent: number;
  totalValidActivations: number;
  operationalTotal: number;
}
export interface NetworkTemplate extends NetworkSummary {
  templateId: string;
  name: string;
  status: string;
  productsCount: number;
  linkAvailable: boolean;
  templateSlug: string | null;
}
export interface NetworkSeriesPoint {
  bucketStart: string;
  clicks: number;
  activations: number;
  conversionPercent: number;
}
export interface NetworkDashboard {
  period: { from: string; to: string; bucket: NetworkBucket };
  summary: NetworkSummary;
  templates: NetworkTemplate[];
  series: NetworkSeriesPoint[];
}
export interface NetworkActivation {
  storeKey: string;
  storeName: string | null;
  templateId: string;
  templateName: string | null;
  activatedAt: string;
  minimumReady: boolean;
  progressPercent: number;
  activeProductsCount: number;
  currentPlan: string | null;
  publicPath: string | null;
}
export interface NetworkActivationsPage {
  page: number;
  pageSize: number;
  totalCount: number;
  items: NetworkActivation[];
}

export interface PeriodRange { from: string; to: string; bucket: NetworkBucket }

/** Bucket automático conforme a duração do período (em dias). */
export function bucketForDays(days: number): NetworkBucket {
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

/** Presets: to = agora (sem 23:59:59 artificial), from = agora − N dias. */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, now = new Date()): PeriodRange {
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const to = new Date(now.getTime());
  const from = new Date(now.getTime() - days * DAY_MS);
  const bucket: NetworkBucket = preset === '90d' ? 'week' : 'day';
  return { from: from.toISOString(), to: to.toISOString(), bucket };
}

/**
 * Personalizado: datas locais inclusivas → intervalo [início do dia inicial,
 * início do dia seguinte ao final). Retorna null se inválido ou > 366 dias.
 */
export function customRange(startDate: string, endDate: string): PeriodRange | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  const [ys, ms, ds] = startDate.split('-').map(Number);
  const [ye, me, de] = endDate.split('-').map(Number);
  const from = new Date(ys, ms - 1, ds);
  const to = new Date(ye, me - 1, de + 1);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) return null;
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  if (days > MAX_CUSTOM_RANGE_DAYS) return null;
  return { from: from.toISOString(), to: to.toISOString(), bucket: bucketForDays(days) };
}

const intFmt = new Intl.NumberFormat('pt-BR');
const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatCount = (n: number | null | undefined) => intFmt.format(Number(n ?? 0));
/** Formata o conversionPercent do backend (sem recalcular): 12.48 → "12,48%". */
export const formatPercent = (n: number | null | undefined) => `${pctFmt.format(Number(n ?? 0))}%`;
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export function formatBucketLabel(iso: string, bucket: NetworkBucket): string {
  const d = new Date(iso);
  if (bucket === 'month') return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

export function planLabel(plan: string | null | undefined): string {
  switch ((plan ?? '').toLowerCase()) {
    case 'free':
    case 'gratis':
      return 'Grátis';
    case 'pro': return 'PRO';
    case 'premium': return 'PREMIUM';
    case 'marca': return 'MARCA';
    default: return '—';
  }
}

export function templateStatusLabel(status: string): string {
  if (status === 'active') return 'Ativo';
  if (status === 'draft') return 'Em preparação';
  if (status === 'inactive') return 'Inativo';
  return status;
}

/** Link canônico — mesma rota usada pelo Painel Master. */
export const networkTemplateLink = (slug: string | null) => getTemplateActivationLink(slug);
/** Mensagem canônica já usada pelo Painel Master, codificada. */
export const networkWhatsAppUrl = (name: string, slug: string | null) =>
  `https://wa.me/?text=${getWhatsAppShareMessage(name, slug)}`;

/** Mensagem amigável a partir do erro da RPC — nunca expõe SQLSTATE. */
export type NetworkErrorKind = 'denied' | 'period' | 'generic';
export function classifyNetworkError(err: unknown): NetworkErrorKind {
  const code = (err as { code?: string } | null)?.code;
  if (code === '42501') return 'denied';
  if (code === '22023') return 'period';
  return 'generic';
}

export type NetworkAccess = 'loading' | 'unavailable' | 'secondary' | 'locked' | 'full';
/** Decide apenas a UX. A autorização real é das RPCs. */
export function resolveNetworkAccess(input: {
  flagLoading: boolean;
  flagEnabled: boolean;
  planLoading: boolean;
  plan: string;
  planSource: string | null;
  ownedStoreRole: string | null;
}): NetworkAccess {
  if (input.flagLoading) return 'loading';
  if (!input.flagEnabled) return 'unavailable';
  if (input.planLoading) return 'loading';
  if (input.ownedStoreRole === 'secondary' || input.planSource === 'brand_inherited') return 'secondary';
  if (input.plan !== 'marca') return 'locked';
  return 'full';
}
