import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantStore } from "@/hooks/useMerchantStore";
import {
  ASAAS_HOMOLOGATION_STORE_ID,
  parseAsaasMerchantStatus,
  unavailableAsaasMerchantStatus,
  type AsaasMerchantStatus,
} from "@/lib/asaasAccountStatus";

interface StatusSnapshot {
  identity: string;
  result: AsaasMerchantStatus;
}

/** One owner-scoped local read per context/retry; never polls or calls Asaas. */
export function useAsaasMerchantAccountStatus(enabled: boolean) {
  const { storeId, actorId, loading: storeLoading } = useMerchantStore();
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const isHomologation = enabled && storeId === ASAAS_HOMOLOGATION_STORE_ID;
  const ownerContext = isHomologation && !storeLoading && actorId === storeId;
  const identity = ownerContext && actorId && storeId ? `${actorId}:${storeId}` : null;

  useEffect(() => {
    let current = true;
    if (!identity || !storeId) {
      setSnapshot(null);
      setLoading(false);
      return () => { current = false; };
    }
    const requestedIdentity = identity;
    const requestedStoreId = storeId;
    setSnapshot(null);
    setLoading(true);
    void supabase.functions.invoke("asaas-manage-subaccount", {
      body: {
        action: "get_my_account_status",
        storeId: requestedStoreId,
        environment: "sandbox",
      },
    }).then(({ data, error }) => {
      if (!current) return;
      setSnapshot({
        identity: requestedIdentity,
        result: error
          ? unavailableAsaasMerchantStatus(requestedStoreId)
          : parseAsaasMerchantStatus(data, requestedStoreId),
      });
    }).catch(() => {
      if (current) {
        setSnapshot({ identity: requestedIdentity, result: unavailableAsaasMerchantStatus(requestedStoreId) });
      }
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [identity, storeId, revision]);

  const retry = useCallback(() => setRevision((value) => value + 1), []);
  const result = identity && snapshot?.identity === identity ? snapshot.result : null;
  return {
    isHomologation,
    loading: ownerContext && (storeLoading || loading),
    result,
    retry,
  };
}
