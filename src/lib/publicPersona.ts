/**
 * Public storefront persona classification.
 * A Supabase session is NOT the same as an authenticated store customer:
 * admin/operational roles are never consumers; merchant sessions are
 * consumers only with an explicit customer indication. Lookup failure is
 * fail-closed (visitor). This decides UI persona only; RLS stays the authority.
 */
export const OPERATIONAL_ROLES = ['admin', 'financeiro', 'suporte', 'tecnico'] as const;

export interface PersonaFacts {
  roles: string[];
  isMerchant: boolean;
  hasCustomerProfile: boolean;
  customerMetadata: boolean;
  lookupFailed: boolean;
}

export type PublicPersona = 'consumer' | 'visitor';

export function classifyPublicPersona(f: PersonaFacts): PublicPersona {
  if (f.lookupFailed) return 'visitor';
  if (f.roles.some((r) => (OPERATIONAL_ROLES as readonly string[]).includes(r))) return 'visitor';
  if (f.isMerchant) return f.customerMetadata || f.hasCustomerProfile ? 'consumer' : 'visitor';
  return 'consumer';
}
