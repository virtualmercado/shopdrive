import { describe, expect, it } from 'vitest';
import {
  bucketForDays, classifyNetworkError, customRange, formatCount, formatPercent, planLabel,
  presetRange, resolveNetworkAccess, networkWhatsAppUrl, networkTemplateLink,
} from './brandNetwork';
import { getRangeLabel } from './adminPagination';

(globalThis as any).window ??= { location: { origin: 'https://shopdrive.com.br' } };

const base = { flagLoading: false, flagEnabled: true, planLoading: false, plan: 'marca', planSource: 'direct', ownedStoreRole: 'primary' };

describe('Minha Rede — apresentação', () => {
  it('KPIs exibem exatamente o payload (sem recálculo)', () => {
    expect(formatCount(569)).toBe('569');
    expect(formatCount(12)).toBe('12');
    expect(formatPercent(2.11)).toBe('2,11%');
    expect(formatPercent(12.48)).toBe('12,48%');
    expect(`${formatCount(1)} de ${formatCount(71)} lojas da rede`).toBe('1 de 71 lojas da rede');
  });

  it('buckets automáticos', () => {
    expect(presetRange('7d').bucket).toBe('day');
    expect(presetRange('30d').bucket).toBe('day');
    expect(presetRange('90d').bucket).toBe('week');
    expect(bucketForDays(31)).toBe('day');
    expect(bucketForDays(32)).toBe('week');
    expect(bucketForDays(181)).toBe('month');
  });

  it('preset usa agora como limite superior', () => {
    const now = new Date('2026-09-28T17:09:00Z');
    const r = presetRange('30d', now);
    expect(r.to).toBe(now.toISOString());
    expect(new Date(r.to).getTime() - new Date(r.from).getTime()).toBe(30 * 86_400_000);
  });

  it('personalizado: [início, dia seguinte) e máximo 366 dias', () => {
    const r = customRange('2026-01-01', '2026-01-31')!;
    expect(r.bucket).toBe('day');
    expect((new Date(r.to).getTime() - new Date(r.from).getTime()) / 86_400_000).toBe(31);
    expect(customRange('2026-01-31', '2026-01-01')).toBeNull();
    expect(customRange('2025-01-01', '2026-06-01')).toBeNull();
  });

  it('planos e erros', () => {
    expect(planLabel('free')).toBe('Grátis');
    expect(planLabel('marca')).toBe('MARCA');
    expect(classifyNetworkError({ code: '42501' })).toBe('denied');
    expect(classifyNetworkError({ code: '22023' })).toBe('period');
    expect(classifyNetworkError(new Error('x'))).toBe('generic');
  });

  it('link canônico e WhatsApp codificado', () => {
    const link = networkTemplateLink('aroma');
    expect(link).toBe(`${window.location.origin}/criar-conta?template=aroma`);
    const url = networkWhatsAppUrl('Marca & Cia', 'aroma');
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toContain(link);
    expect(url).not.toContain(' ');
  });

  it('paginação 71 itens', () => {
    expect(getRangeLabel(1, 71, 50)).toEqual({ start: 1, end: 50 });
    expect(getRangeLabel(2, 71, 50)).toEqual({ start: 51, end: 71 });
  });

  it('acesso: flag, secondary, planos inferiores e primary', () => {
    expect(resolveNetworkAccess({ ...base, flagEnabled: false })).toBe('unavailable');
    expect(resolveNetworkAccess({ ...base, planSource: 'brand_inherited', ownedStoreRole: 'secondary' })).toBe('secondary');
    for (const plan of ['free', 'pro', 'premium']) {
      expect(resolveNetworkAccess({ ...base, plan, planSource: 'direct', ownedStoreRole: null })).toBe('locked');
    }
    expect(resolveNetworkAccess(base)).toBe('full');
  });
});
