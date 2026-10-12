import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createUserScopedLoader, classifyProfileLookup } from '@/lib/authIdentity';

/**
 * loading    — resolving the current identity
 * complete   — current user has a store (found)
 * incomplete — a successful lookup proved the user has no store (not_found)
 * error      — technical failure; NEVER means "no store"
 * missing    — no authenticated user
 */
type ProfileStatus = 'loading' | 'complete' | 'incomplete' | 'error' | 'missing';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profileStatus: ProfileStatus;
  isMerchant: boolean;
  isTemplateProfile: boolean;
  storeSlug: string | null;
  /** Re-fetch the profile for the current user (e.g. after onboarding completes) */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type ProfileRow = { store_slug: string | null; is_template_profile: boolean | null; store_name: string | null };

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading');
  const [isMerchant, setIsMerchant] = useState(false);
  const [isTemplateProfile, setIsTemplateProfile] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  /** Identity whose profile is resolved/being resolved. */
  const identityRef = useRef<string | null | undefined>(undefined);

  const loaderRef = useRef(
    createUserScopedLoader<{ data: ProfileRow | null; error: unknown }>(
      (_uid, { data, error }) => {
        const { resolution, isMerchant: merchant } = classifyProfileLookup(data, error);
        if (resolution === 'error') {
          console.error('[Auth] profile lookup failed — not treating as "no store"');
          setProfileStatus('error');
          return;
        }
        setIsTemplateProfile(data?.is_template_profile === true);
        setIsMerchant(merchant);
        setStoreSlug(data?.store_slug ?? null);
        setProfileStatus(resolution === 'found' ? 'complete' : 'incomplete');
      },
      () => setProfileStatus('error'),
    ),
  );

  const clearTenantState = useCallback(() => {
    setIsMerchant(false);
    setIsTemplateProfile(false);
    setStoreSlug(null);
  }, []);

  const resolveIdentity = useCallback((currentUser: User | null, force = false) => {
    const nextId = currentUser?.id ?? null;
    const prevId = identityRef.current;
    const changed = prevId !== nextId;

    if (!changed && !force) return;

    // Identity changed: drop any pending lookup and all state of the previous account.
    if (changed) {
      clearTenantState();
      if (prevId) {
        // Private caches belong to the previous identity (public storefront uses another client).
        queryClient.removeQueries();
      }
    }
    identityRef.current = nextId;

    if (!currentUser) {
      loaderRef.current.invalidate(null);
      setProfileStatus('missing');
      return;
    }

    setProfileStatus('loading');
    void loaderRef.current.load(currentUser.id, async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('store_slug, is_template_profile, store_name')
        .eq('id', currentUser.id)
        .maybeSingle();
      return { data: data as ProfileRow | null, error };
    });
  }, [clearTenantState, queryClient]);

  const refreshProfile = useCallback(async () => {
    const { data: { session: current } } = await supabase.auth.getSession();
    resolveIdentity(current?.user ?? null, true);
  }, [resolveIdentity]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setAuthReady(true);
      if (event === 'SIGNED_OUT') {
        resolveIdentity(null);
      } else {
        // INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED:
        // only re-resolves when the identity actually changed.
        resolveIdentity(newSession?.user ?? null);
      }
    });

    // Fallback in case INITIAL_SESSION did not fire.
    supabase.auth.getSession().then(({ data: { session: restored } }) => {
      if (identityRef.current !== undefined) return;
      setSession(restored);
      setUser(restored?.user ?? null);
      setAuthReady(true);
      resolveIdentity(restored?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [resolveIdentity]);

  // While the resolved identity differs from the current user, we are loading.
  const identityPending = (user?.id ?? null) !== (identityRef.current ?? null);
  const loading = !authReady || (!!user && (profileStatus === 'loading' || identityPending));

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      profileStatus: identityPending && user ? 'loading' : profileStatus,
      isMerchant: identityPending ? false : isMerchant,
      isTemplateProfile: identityPending ? false : isTemplateProfile,
      storeSlug: identityPending ? null : storeSlug,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
