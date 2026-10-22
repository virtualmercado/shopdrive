import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { createDraftSaveQueue, type DraftSaveStatus } from "@/lib/catalog-v2/editorial/draftSaveQueue";
import { registerCatalogSaveGuard } from "@/lib/catalog-v2/editorial/navigationSave";
import { DRAFT_SAVE_DEBOUNCE_MS, DRAFT_SCHEMA_VERSION, draftConfigKey, parseDraftConfig, type CatalogDraftConfig, type CatalogDraftRecord } from "@/lib/catalog-v2/editorial/draftConfig";

export function useCatalogDraftPersistence(storeId: string | undefined, config: CatalogDraftConfig, hydrate: (config: CatalogDraftConfig, record: CatalogDraftRecord) => void) {
  const navigation = useContext(UNSAFE_NavigationContext);
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
    void Promise.resolve(supabase.rpc("get_my_catalog_draft")).then(({ data, error }) => {
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
          onSaved: () => { if (active && ownerRef.current === storeId) setRecovery(queue.current?.dirty() ? queue.current.getCurrent() : null); },
        });
        let restored = initial;
        // Recovery is only an unsaved emergency buffer, never authoritative saved state.
        if (buffer) {
          restored = parseDraftConfig(buffer.config, DRAFT_SCHEMA_VERSION);
          queue.current.update(restored);
        }
        hydrateRef.current(restored, result);
        if (queue.current.dirty()) setStatus("pending");
        setRecord(result); setReadyOwner(storeId); setReady(true);
      } catch { setLoadError(true); }
    }).catch(() => { if (active && ownerRef.current === storeId) setLoadError(true); });
    return () => {
      active = false; mounted.current = false;
      const pending = queue.current;
      if (pending && ownerRef.current === storeId && !discardRecovery.current) pending.update(configRef.current);
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
      queue.current?.update(configRef.current);
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

  useEffect(() => {
    if (!ready || !navigation) return;
    const navigator = navigation.navigator;
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;
    let active = true;
    let knownIndex = window.history.state?.idx as number | undefined;
    let restoring = false;
    let resume = false;
    let targetIndex: number | undefined;
    let targetDelta = 0;
    let busy = false;
    const dirty = () => { queue.current?.update(configRef.current); return !!queue.current?.dirty(); };
    const protect = (method: typeof originalPush): typeof originalPush => (...args) => {
      if (!dirty()) { method.apply(navigator, args); knownIndex = window.history.state?.idx; return; }
      if (busy) return;
      busy = true;
      void flush().then((ok) => { if (active && ok) { method.apply(navigator, args); knownIndex = window.history.state?.idx; } }).finally(() => { busy = false; });
    };
    const push = protect(originalPush);
    const replace = protect(originalReplace);
    navigator.push = push; navigator.replace = replace;
    const onPop = (event: PopStateEvent) => {
      const next = event.state?.idx as number | undefined;
      if (restoring) {
        event.stopImmediatePropagation(); restoring = false;
        void flush().then((ok) => {
          if (active && ok) { resume = true; window.history.go(targetDelta); }
          else { busy = false; targetIndex = undefined; }
        });
        return;
      }
      if (resume) { resume = false; busy = false; knownIndex = next; targetIndex = undefined; return; }
      if (busy) { event.stopImmediatePropagation(); if (next !== knownIndex && typeof next === "number" && typeof knownIndex === "number") window.history.go(knownIndex - next); return; }
      if (!dirty() || typeof next !== "number" || typeof knownIndex !== "number" || next === knownIndex) { knownIndex = next; return; }
      event.stopImmediatePropagation();
      setRecovery(queue.current?.getCurrent() ?? configRef.current);
      busy = true; restoring = true; targetIndex = next; targetDelta = targetIndex - knownIndex;
      window.history.go(-targetDelta);
    };
    window.addEventListener("popstate", onPop, true);
    return () => {
      active = false;
      if (navigator.push === push) navigator.push = originalPush;
      if (navigator.replace === replace) navigator.replace = originalReplace;
      window.removeEventListener("popstate", onPop, true);
    };
  }, [ready, navigation, flush, setRecovery]);

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