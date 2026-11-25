import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantStore } from "@/hooks/useMerchantStore";
import { parseAsaasHomologationAccess } from "@/lib/asaasCompliance";

/**
 * Server-authoritative visibility check for the Asaas BaaS Phase 2.5
 * compliance/homologation UI. Fails closed (disabled) on loading, missing
 * session, or RPC errors. Never triggers Asaas API calls.
 */
export function useAsaasHomologationAccess() {
  const { storeId, actorId, loading: storeLoading } = useMerchantStore();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (storeLoading) return;
    if (!storeId || !actorId) {
      setEnabled(false);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setEnabled(false);

    const checkAccess = async () => {
      try {
        const { data, error } = await supabase.rpc("get_my_asaas_homologation_ui_access", {
          p_store_id: storeId,
        });
        if (!active) return;
        if (error) {
          setEnabled(false);
          return;
        }
        const parsed = parseAsaasHomologationAccess(data, storeId);
        setEnabled(parsed.enabled);
      } catch {
        if (active) setEnabled(false);
      } finally {
        if (active) setLoading(false);
      }
    };

    void checkAccess();

    return () => {
      active = false;
    };
  }, [storeId, actorId, storeLoading]);

  return { enabled, loading: loading || storeLoading, storeId };
}