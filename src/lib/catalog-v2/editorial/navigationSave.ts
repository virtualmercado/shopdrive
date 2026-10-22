// Only the mounted Editorial editor registers a guard. Other screens are unchanged.
let guard: (() => Promise<boolean>) | null = null;
let historyGuard: ((event: PopStateEvent) => void) | null = null;
// This module is eagerly imported with CatalogPDF before BrowserRouter mounts.
// Register before its history listener: a failed save must not unmount the editor.
if (typeof window !== "undefined") window.addEventListener("popstate", (event) => historyGuard?.(event), true);
export function registerCatalogHistoryGuard(callback: (event: PopStateEvent) => void) {
  historyGuard = callback;
  return () => { if (historyGuard === callback) historyGuard = null; };
}
export function registerCatalogSaveGuard(callback: () => Promise<boolean>) {
  guard = callback;
  return () => { if (guard === callback) guard = null; };
}
export const flushCatalogBeforeLeave = () => guard ? guard() : Promise.resolve(true);