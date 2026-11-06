import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createMerchantScopedClient } from "@/lib/merchantScopedClient";
import { isStoreUuid, parseManagedStore, type ManagedStore } from "@/lib/merchantStoreRules";
import { flushCatalogBeforeLeave } from "@/lib/catalog-v2/editorial/navigationSave";

interface StoreContext {
  storeId: string | null; store: ManagedStore | null; stores: ManagedStore[]; client: typeof supabase;
  actorId: string | null; delegated: boolean; loading: boolean; error: boolean; switching: boolean;
  switchStore: (id: string) => Promise<boolean>; retry: () => void;
}
const MerchantStoreContext = createContext<StoreContext | null>(null);

export function MerchantStoreProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuthContext();
  const actorId = user?.id ?? null;
  const actorRef = useRef(actorId); actorRef.current = actorId;
  const [store, setStore] = useState<ManagedStore | null>(null);
  const [stores, setStores] = useState<ManagedStore[]>([]);
  const [resolvedActor, setResolvedActor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    let current = true;
    setLoading(true); setError(false); setStore(null); setStores([]); setResolvedActor(null);
    if (!actorId) { setLoading(false); return; }
    const key = `shopdrive_selected_store:${actorId}`;
    let requested: string | null = null;
    try { requested = sessionStorage.getItem(key); } catch { /* Server remains authority. */ }
    if (requested && !isStoreUuid(requested)) { setError(true); setLoading(false); return; }
    void Promise.all([
      supabase.rpc("get_my_store_context" as never, { p_store_id: requested ?? actorId } as never),
      supabase.rpc("get_my_managed_marca_stores" as never),
    ]).then(([context, list]) => {
      if (!current || actorRef.current !== actorId) return;
      const listData: unknown = list.data;
      if (context.error || list.error || !Array.isArray(listData)) throw new Error("store_access_denied");
      const next = parseManagedStore(context.data);
      if (next.storeId !== (requested ?? actorId)) throw new Error("store_context_invalid");
      setStore(next); setStores(listData.map(parseManagedStore)); setResolvedActor(actorId);
    }).catch(() => { if (current) setError(true); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [actorId, authLoading, revision]);

  const switchStore = useCallback(async (id: string) => {
    if (busy.current || !actorId || !isStoreUuid(id)) return false;
    busy.current = true; setSwitching(true);
    try {
      if (!await flushCatalogBeforeLeave() || actorRef.current !== actorId) return false;
      const { data, error: denied } = await supabase.rpc("get_my_store_context" as never, { p_store_id: id } as never);
      if (denied) return false;
      const next = parseManagedStore(data);
      if (next.storeId !== id || actorRef.current !== actorId) return false;
      await queryClient.cancelQueries(); queryClient.clear();
      try { sessionStorage.setItem(`shopdrive_selected_store:${actorId}`, id); } catch { /* Selection need not persist. */ }
      setStore(next); setResolvedActor(actorId); navigate("/lojista", { replace: true });
      return true;
    } catch { return false; }
    finally { busy.current = false; setSwitching(false); }
  }, [actorId, navigate, queryClient]);
  const readyStore = resolvedActor === actorId ? store : null;
  const client = useMemo(() => actorId && readyStore ? createMerchantScopedClient(actorId, readyStore.storeId) : supabase, [actorId, readyStore?.storeId]);
  return <MerchantStoreContext.Provider value={{ storeId: readyStore?.storeId ?? null, store: readyStore, stores: readyStore ? stores : [], client,
    actorId, delegated: !!readyStore && readyStore.storeId !== actorId, loading: loading || authLoading || (!!actorId && !readyStore && !error),
    error, switching, switchStore, retry: () => setRevision((r) => r + 1) }}>{children}</MerchantStoreContext.Provider>;
}

export const useMerchantStoreContext = () => useContext(MerchantStoreContext);