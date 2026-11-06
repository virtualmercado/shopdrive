import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isStoreUuid } from "./merchantStoreRules";

/** An immutable tenant client. JWT, roles and authentication remain the real actor's. */
export function createMerchantScopedClient(actorId: string, storeId: string): typeof supabase {
  if (!isStoreUuid(actorId) || !isStoreUuid(storeId)) throw new Error("store_context_invalid");
  const scoped = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { "x-shopdrive-store-id": storeId } },
    accessToken: async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== actorId) throw new Error("store_identity_changed");
      return data.session.access_token;
    },
  });
  // Authentication must never be a tenant identity or another session.
  return new Proxy(scoped, { get(target, property) {
    if (property === "auth") return supabase.auth;
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  } });
}