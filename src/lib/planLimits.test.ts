import { describe, it, expect, vi } from 'vitest';
import { getPlanFromPlanId, PLAN_LIMITS, PlanLimits } from './planLimits';

describe('getPlanFromPlanId', () => {
  it('resolves canonical codes', () => {
    expect(getPlanFromPlanId('free')).toBe('free');
    expect(getPlanFromPlanId('gratis')).toBe('free');
    expect(getPlanFromPlanId('pro')).toBe('pro');
    expect(getPlanFromPlanId('premium')).toBe('premium');
    expect(getPlanFromPlanId('PREMIUM ')).toBe('premium');
  });
  it('marca never falls back to free', () => {
    expect(getPlanFromPlanId('marca')).toBe('marca');
    expect(getPlanFromPlanId('MARCA')).toBe('marca');
  });
  it('null/empty keeps legacy "unknown"', () => {
    expect(getPlanFromPlanId(null)).toBe('unknown');
    expect(getPlanFromPlanId(undefined)).toBe('unknown');
    expect(getPlanFromPlanId('')).toBe('unknown');
  });
  it('invalid value falls back to free and logs UNKNOWN_PLAN_CODE', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getPlanFromPlanId('premium_old')).toBe('free');
    expect(spy).toHaveBeenCalledWith('UNKNOWN_PLAN_CODE', expect.objectContaining({ value: 'premium_old' }));
    spy.mockClear();
    getPlanFromPlanId('gratis');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('PLAN_LIMITS', () => {
  it('free/pro/premium unchanged', () => {
    expect(PLAN_LIMITS.free.maxProducts).toBe(20);
    expect(PLAN_LIMITS.free.maxCustomers).toBe(40);
    expect(PLAN_LIMITS.pro.maxProducts).toBe(150);
    expect(PLAN_LIMITS.pro.maxCustomers).toBe(300);
    expect(PLAN_LIMITS.pro.canUseCustomDomain).toBe(false);
    expect(PLAN_LIMITS.premium.maxProducts).toBeNull();
    expect(PLAN_LIMITS.premium.canUseWhatsAppSupport).toBe(true);
    for (const p of ['free', 'pro', 'premium'] as const) {
      expect(PLAN_LIMITS[p].brandNetworkAccess).toBe(false);
      expect(PLAN_LIMITS[p].ownedStoreLimit).toBe(1);
    }
  });
  it('marca >= premium on every capability', () => {
    const premium = PLAN_LIMITS.premium;
    const marca = PLAN_LIMITS.marca;
    (Object.keys(premium) as (keyof PlanLimits)[]).forEach((k) => {
      const p = premium[k];
      const m = marca[k];
      if (typeof p === 'boolean') expect(m === true || m === p).toBe(true);
      else if (p === null) expect(m).toBeNull();
      else if (typeof p === 'number') expect(m === null || (m as number) >= p).toBe(true);
    });
  });
  it('marca exclusive capabilities', () => {
    expect(PLAN_LIMITS.marca.brandNetworkAccess).toBe(true);
    expect(PLAN_LIMITS.marca.brandReports).toBe(true);
    expect(PLAN_LIMITS.marca.brandTemplatesLimit).toBe(2);
    expect(PLAN_LIMITS.marca.ownedStoreLimit).toBe(2);
  });
});
