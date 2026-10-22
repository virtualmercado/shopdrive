// Only the mounted Editorial editor registers a guard. Other screens are unchanged.
let guard: (() => Promise<boolean>) | null = null;
export function registerCatalogSaveGuard(callback: () => Promise<boolean>) {
  guard = callback;
  return () => { if (guard === callback) guard = null; };
}
export const flushCatalogBeforeLeave = () => guard ? guard() : Promise.resolve(true);