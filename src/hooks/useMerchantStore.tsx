import { useAuthContext } from "@/contexts/AuthContext";
import { useMerchantStoreContext } from "@/contexts/MerchantStoreContext";
import { supabase } from "@/integrations/supabase/client";

export function useMerchantStore() {
  const scope = useMerchantStoreContext();
  const auth = useAuthContext();
  return scope ?? { storeId: auth.user?.id ?? null, store: null, stores: [], client: supabase,
    actorId: auth.user?.id ?? null, delegated: false, loading: auth.loading, error: false, switching: false,
    switchStore: async () => false, retry: () => {} };
}