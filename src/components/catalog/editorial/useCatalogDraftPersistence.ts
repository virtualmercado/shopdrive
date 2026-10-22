import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createDraftSaveQueue, type DraftSaveStatus } from "@/lib/catalog-v2/editorial/draftSaveQueue";
import { registerCatalogSaveGuard } from "@/lib/catalog-v2/editorial/navigationSave";
import { DRAFT_SAVE_DEBOUNCE_MS, DRAFT_SCHEMA_VERSION, parseDraftConfig, type CatalogDraftConfig, type CatalogDraftRecord } from "@/lib/catalog-v2/editorial/draftConfig";

export function useCatalogDraftPersistence(storeId: string | undefined, config: CatalogDraftConfig, hydrate: (config: CatalogDraftConfig, record: CatalogDraftRecord) => void) {
  const [ready, setReady] = useState(false);
  const [record, setRecord] = useState<CatalogDraftRecord | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<DraftSaveStatus>("saved");
  const [reloadKey, setReloadKey] = useState(0);
  const queue = useRef<ReturnType<typeof createDraftSaveQueue<CatalogDraftConfig>> | null>(null);
  const mounted = useRef(false);
  const hydrateRef = useRef(hydrate);
  hydrateRef.current = hydrate;
  const configRef = useRef(config);
  configRef.current = config;
  const recoveryKey = storeId ? `shopdrive_catalog_pending:${storeId}` : null;
  const setRecovery = useCallback((value: CatalogDraftConfig | null) => {
    if (!recoveryKey) return;
    try { if (value) sessionStorage.setItem(recoveryKey, JSON.stringify(value)); else sessionStorage.removeItem(recoveryKey); } catch { /* beforeunload still warns */ }
  }, [recoveryKey]);

  useEffect(() => {
    mounted.current = true;
    setReady(false); setLoadError(false); queue.current = null;
    if (!storeId) return;
    let active = true;
    void supabase.rpc("get_my_catalog_draft").then(({ data, error }) => {
      if (!active) return;
      try {
        if (error || !data) throw error ?? new Error("missing draft response");
        const result = data as unknown as CatalogDraftRecord;
        const initial = result.config === null ? parseDraftConfig({}, DRAFT_SCHEMA_VERSION) : parseDraftConfig(result.config, result.schema_version);
        queue.current = createDraftSaveQueue({ initial, revision: result.draft_revision,
          save: async (value, revision) => {
            const { data: saved, error: saveError } = await supabase.rpc("save_my_catalog_draft", { _expected_revision: revision, _schema_version: DRAFT_SCHEMA_VERSION, _config: JSON.parse(JSON.stringify(value)) });
            if (saveError || !saved) throw saveError ?? new Error("missing save response");
            const next = saved as unknown as CatalogDraftRecord;
            if (active) setRecord(next);
            return next;
          },
          onStatus: (next) => { if (active) setStatus(next); },
          onSaved: (value) => { if (JSON.stringify(value) === JSON.stringify(queue.current?.getCurrent())) setRecovery(null); },
        });
        let restored = initial;
        // Recovery is only an unsaved emergency buffer, never authoritative saved state.
        const recovery = recoveryKey ? sessionStorage.getItem(recoveryKey) : null;
        if (recovery) {
          restored = parseDraftConfig(JSON.parse(recovery), DRAFT_SCHEMA_VERSION);
          queue.current.update(restored);
        }
        hydrateRef.current(restored, result);
        setRecord(result); setReady(true);
      } catch { setLoadError(true); }
    });
    return () => {
      active = false; mounted.current = false;
      const pending = queue.current;
      if (pending?.dirty()) { setRecovery(pending.getCurrent()); void pending.flush(); }
      queue.current = null;
    };
  }, [storeId, reloadKey, recoveryKey, setRecovery]);

  useEffect(() => {
    if (!ready || !queue.current) return;
    queue.current.update(config);
    if (queue.current.dirty()) setRecovery(config);
    const timer = window.setTimeout(() => { void queue.current?.flush(); }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [config, ready, setRecovery]);

  const flush = useCallback(async () => {
    const current = queue.current;
    if (!ready || !current) return false;
    current.update(configRef.current);
    const ok = await current.flush();
    if (ok) setRecovery(null);
    return ok;
  }, [ready, setRecovery]);

  useEffect(() => {
    if (!ready) return;
    const unregister = registerCatalogSaveGuard(flush);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!queue.current?.dirty()) return;
      setRecovery(queue.current.getCurrent());
      void flush(); event.preventDefault(); event.returnValue = "";
    };
    const onLink = (event: MouseEvent) => {
      if (!queue.current?.dirty() || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) return;
      if (new URL(target.href).href === window.location.href) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void flush().then((ok) => { if (ok) target.click(); });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => { unregister(); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onLink, true); };
  }, [ready, flush, setRecovery]);

  const checkCurrent = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_catalog_draft");
    if (error || !data) throw error ?? new Error("missing draft response");
    const current = data as unknown as CatalogDraftRecord;
    if (mounted.current) setRecord(current);
    return current;
  }, []);

  return { ready, record, status, loadError, flush, checkCurrent, retryLoad: () => setReloadKey((n) => n + 1), getRevision: () => queue.current?.getRevision() ?? 0, setRecord };
}