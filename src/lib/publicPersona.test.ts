import { describe, it, expect } from 'vitest';
import { classifyPublicPersona } from './publicPersona';
const base = { roles: ['user'], isMerchant: false, hasCustomerProfile: false, customerMetadata: false, lookupFailed: false };
describe('classifyPublicPersona', () => {
  it('admin is never a consumer, even with customer profile', () => {
    expect(classifyPublicPersona({ ...base, roles: ['admin'], hasCustomerProfile: true, customerMetadata: true })).toBe('visitor');
  });
  it('operational roles are visitors', () => {
    expect(classifyPublicPersona({ ...base, roles: ['suporte'] })).toBe('visitor');
  });
  it('merchant without customer indication is a visitor', () => {
    expect(classifyPublicPersona({ ...base, isMerchant: true })).toBe('visitor');
  });
  it('merchant who is also a customer stays consumer', () => {
    expect(classifyPublicPersona({ ...base, isMerchant: true, hasCustomerProfile: true })).toBe('consumer');
  });
  it('plain customer without store_customers link is consumer', () => {
    expect(classifyPublicPersona(base)).toBe('consumer');
  });
  it('lookup failure is fail-closed', () => {
    expect(classifyPublicPersona({ ...base, lookupFailed: true })).toBe('visitor');
  });
});
