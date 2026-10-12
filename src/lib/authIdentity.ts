/**
 * Identity-scoped request guard.
 *
 * Only the response belonging to the CURRENT authenticated identity (and the
 * latest request for it) may update state. Superseded responses — e.g. a slow
 * profile/roles lookup started for a previous account — are silently dropped.
 * Never "last response wins".
 */
export interface UserScopedLoader<T> {
  /** Start a lookup for userId. Result is applied only if still current. */
  load: (userId: string, fetcher: (signal: AbortSignal) => Promise<T>) => Promise<void>;
  /** Invalidate any pending lookup (identity changed or signed out). */
  invalidate: (nextUserId: string | null) => void;
  currentUserId: () => string | null;
}

export function createUserScopedLoader<T>(
  apply: (userId: string, result: T) => void,
  onError?: (userId: string, error: unknown) => void,
): UserScopedLoader<T> {
  let generation = 0;
  let currentUser: string | null = null;
  let controller: AbortController | null = null;

  const invalidate = (nextUserId: string | null) => {
    generation += 1;
    currentUser = nextUserId;
    controller?.abort();
    controller = null;
  };

  const load = async (userId: string, fetcher: (signal: AbortSignal) => Promise<T>) => {
    invalidate(userId);
    const myGeneration = generation;
    const myController = new AbortController();
    controller = myController;
    const isCurrent = () => myGeneration === generation && currentUser === userId;
    try {
      const result = await fetcher(myController.signal);
      if (!isCurrent()) return;
      apply(userId, result);
    } catch (err) {
      if (!isCurrent()) return;
      onError?.(userId, err);
    }
  };

  return { load, invalidate, currentUserId: () => currentUser };
}

export type ProfileResolution = 'found' | 'not_found' | 'error';

/**
 * Classifies a profile lookup. `error` (network, token, backend) must NEVER be
 * treated as "user has no store".
 */
export function classifyProfileLookup(
  data: { store_slug?: string | null; is_template_profile?: boolean | null } | null,
  error: unknown,
): { resolution: ProfileResolution; isMerchant: boolean } {
  if (error) return { resolution: 'error', isMerchant: false };
  if (!data) return { resolution: 'not_found', isMerchant: false };
  const isMerchant = !!data.store_slug || data.is_template_profile === true;
  return { resolution: isMerchant ? 'found' : 'not_found', isMerchant };
}
