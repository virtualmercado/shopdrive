import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type ProfileStatus = 'loading' | 'complete' | 'incomplete' | 'missing';

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading');
  const [isMerchant, setIsMerchant] = useState(false);
  const [isTemplateProfile, setIsTemplateProfile] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const profileFetchRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      console.log('[Auth] no user, setting profile status to missing');
      setProfileStatus('missing');
      setIsMerchant(false);
      setIsTemplateProfile(false);
      setStoreSlug(null);
      profileFetchRef.current = null;
      return;
    }

    // Avoid duplicate fetches for same user
    if (profileFetchRef.current === currentUser.id) return;
    profileFetchRef.current = currentUser.id;

    console.log('[Auth] profile lookup started for', currentUser.id);
    setProfileStatus('loading');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('store_slug, is_template_profile, store_name')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('[Auth] Error querying profile:', error.message);
        setProfileStatus('missing');
        setIsMerchant(false);
        setIsTemplateProfile(false);
        setStoreSlug(null);
      } else if (!data) {
        console.log('[Auth] profile missing');
        setProfileStatus('missing');
        setIsMerchant(false);
        setIsTemplateProfile(false);
        setStoreSlug(null);
      } else {
        const isTemplate = data.is_template_profile === true;
        const hasStore = !!data.store_slug || isTemplate;
        setIsTemplateProfile(isTemplate);
        setIsMerchant(hasStore);
        setStoreSlug(data.store_slug);

        if (hasStore) {
          console.log('[Auth] profile found — merchant confirmed');
          setProfileStatus('complete');
        } else {
          console.log('[Auth] profile incomplete — no store');
          setProfileStatus('incomplete');
        }
      }
    } catch (err) {
      console.error('[Auth] Unexpected error:', err);
      setProfileStatus('missing');
      setIsMerchant(false);
      setIsTemplateProfile(false);
      setStoreSlug(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    // Force re-fetch by clearing the cache
    profileFetchRef.current = null;
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    console.log('[Auth] auth started');

    // 1. Restore session from storage first
    supabase.auth.getSession().then(({ data: { session: restored } }) => {
      console.log('[Auth] session loaded', restored ? 'with user' : 'no session');
      setSession(restored);
      setUser(restored?.user ?? null);
      setAuthReady(true);

      // Fetch profile for restored session
      fetchProfile(restored?.user ?? null);
    });

    // 2. Listen for subsequent auth changes (sign in / sign out / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log(`[Auth] onAuthStateChange: ${event}`);
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setAuthReady(true);

        // On sign in or token refresh with a different user, re-fetch profile
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Reset profile cache so it re-fetches for new user
          if (newSession?.user?.id !== profileFetchRef.current) {
            profileFetchRef.current = null;
          }
          fetchProfile(newSession?.user ?? null);
        } else if (event === 'SIGNED_OUT') {
          profileFetchRef.current = null;
          fetchProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Global loading = auth not ready OR profile still loading (when user exists)
  const loading = !authReady || (!!user && profileStatus === 'loading');

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      profileStatus,
      isMerchant,
      isTemplateProfile,
      storeSlug,
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
