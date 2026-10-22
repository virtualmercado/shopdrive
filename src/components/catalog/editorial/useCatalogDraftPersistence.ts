import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createDraftSaveQueue, type DraftSaveStatus } from "@/lib/catalog-v2/editorial/draftSaveQueue";
import { registerCatalogSaveGuard } from "@/lib/catalog-v2/editorial/navigationSave";
import { DRAFT_SAVE_DEBOUNCE_MS, DRAFT_SCHEMA_VERSION, draftConfigKey, parseDraftConfig, type CatalogDraftConfig, type CatalogDraftRecord } from "@/lib/catalog-v2/editorial/draftConfig";

export function useCatalogDraftPersistence(storeId: string | undefined, config: CatalogDraftConfig, hydrate: (config: CatalogDraftConfig, record: CatalogDraftRecord) => void) {
  const [ready, setReady] = useState(false);
  const [record, setRecord] = useState<CatalogDraftRecord | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<DraftSaveStatus>("saved");
  const [reloadKey, setReloadKey] = useState(0);
  const queue = useRef<ReturnType<typeof createDraftSaveQueue<CatalogDraftConfig>> | null>(null);
  const mounted = useRef(false);
  const ownerRef = useRef(storeId);
  ownerRef.current = storeId;
  const [readyOwner, setReadyOwner] = useState<string | undefined>();
  const hydrateRef = useRef(hydrate);
  hydrateRef.current = hydrate;
  const configRef = useRef(config);
  configRef.current = config;
  const discardRecovery = useRef(false);
  const recoveryKey = storeId ? `shopdrive_catalog_pending:${storeId}` : null;
  const setRecovery = useCallback((value: CatalogDraftConfig | null) => {
    if (!recoveryKey) return;
    try { if (value) sessionStorage.setItem(recoveryKey, JSON.stringify({ config: value, revision: queue.current?.getRevision() ?? 0 })); else sessionStorage.removeItem(recoveryKey); } catch { /* beforeunload still warns */ }
  }, [recoveryKey]);

  useEffect(() => {
    mounted.current = true;
    setReady(false); setReadyOwner(undefined); setRecord(null); setStatus("saved"); setLoadError(false); queue.current = null;
    if (!storeId) return;
    let active = true;
    let maySave = true;
    void supabase.rpc("get_my_catalog_draft").then(({ data, error }) => {
      if (!active || ownerRef.current !== storeId) return;
      try {
        if (error || !data) throw error ?? new Error("missing draft response");
        const result = data as unknown as CatalogDraftRecord;
        const initial = result.config === null ? parseDraftConfig({}, DRAFT_SCHEMA_VERSION) : parseDraftConfig(result.config, result.schema_version);
        let recovery: string | null = null;
        try { recovery = recoveryKey ? sessionStorage.getItem(recoveryKey) : null; } catch { /* cloud draft is still available */ }
        let buffer = recovery ? JSON.parse(recovery) as { config: unknown; revision: number } : null;
        if (buffer && draftConfigKey(buffer.config) === draftConfigKey(initial)) { buffer = null; setRecovery(null); }
        queue.current = createDraftSaveQueue({ initial, revision: buffer?.revision ?? result.draft_revision, needsInitialSave: result.config === null,
          save: async (value, revision) => {
            if (!maySave || ownerRef.current !== storeId) throw new Error("catalog identity changed");
            const { data: saved, error: saveError } = await supabase.rpc("save_my_catalog_draft", { _expected_revision: revision, _schema_version: DRAFT_SCHEMA_VERSION, _config: JSON.parse(JSON.stringify(value)) });
            if (saveError || !saved) throw saveError ?? new Error("missing save response");
            if (!maySave || ownerRef.current !== storeId) throw new Error("catalog identity changed");
            const next = saved as unknown as CatalogDraftRecord;
            if (active && ownerRef.current === storeId) setRecord(next);
            return next;
          },
          onStatus: (next) => { if (active && ownerRef.current === storeId) setStatus(next); },
          onSaved: (value) => { if (active && ownerRef.current === storeId && draftConfigKey(value) === draftConfigKey(queue.current?.getCurrent())) setRecovery(null); },
        });
        let restored = initial;
        // Recovery is only an unsaved emergency buffer, never authoritative saved state.
        if (buffer) {
          restored = parseDraftConfig(buffer.config, DRAFT_SCHEMA_VERSION);
          queue.current.update(restored);
        }
        hydrateRef.current(restored, result);
        setRecord(result); setReadyOwner(storeId); setReady(true);
      } catch { setLoadError(true); }
    });
    return () => {
      active = false; mounted.current = false;
      const pending = queue.current;
      if (pending?.dirty() && !discardRecovery.current) {
        // Covers browser history/programmatic exits without saving under a changed identity.
        setRecovery(pending.getCurrent());
        if (ownerRef.current === storeId) void pending.flush().finally(() => { maySave = false; });
        else maySave = false;
      }
      else maySave = false;
      discardRecovery.current = false;
      queue.current = null;
    };
  }, [storeId, reloadKey, recoveryKey, setRecovery]);

  useEffect(() => {
    if (!ready || readyOwner !== storeId || !queue.current) return;
    queue.current.update(config);
    if (queue.current.dirty()) setRecovery(config);
    const timer = window.setTimeout(() => { void queue.current?.flush(); }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [config, ready, readyOwner, storeId, setRecovery]);

  const flush = useCallback(async () => {
    const current = queue.current;
    if (!ready || readyOwner !== storeId || ownerRef.current !== storeId || !current) return false;
    current.update(configRef.current);
    const ok = await current.flush();
    if (ok) setRecovery(null);
    return ok;
  }, [ready, readyOwner, storeId, setRecovery]);

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
      if (target.dataset.catalogSaveHandled === "true") return;
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
    if (mounted.current && ownerRef.current === storeId) setRecord(current);
    return current;
  }, [storeId]);

  const reloadSaved = () => { discardRecovery.current = true; setRecovery(null); setReloadKey((n) => n + 1); };
  return { ready: ready && readyOwner === storeId, record, status, loadError, flush, checkCurrent, retryLoad: () => setReloadKey((n) => n + 1), reloadSaved, getRevision: () => queue.current?.getRevision() ?? 0, setRecord };
}