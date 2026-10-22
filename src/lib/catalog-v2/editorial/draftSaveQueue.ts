import { draftConfigKey } from "./draftConfig";

export type DraftSaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";
export interface SaveResult { draft_revision: number }

/** Serializes saves; never acknowledges a newer local edit with an older response. */
export function createDraftSaveQueue<T>(options: {
  initial: T; revision: number;
  save: (config: T, revision: number) => Promise<SaveResult>;
  onStatus: (status: DraftSaveStatus) => void;
  onSaved?: (config: T, result: SaveResult) => void;
  needsInitialSave?: boolean;
}) {
  let current = options.initial;
  let currentKey = draftConfigKey(current);
  let savedKey = options.needsInitialSave ? "" : currentKey;
  let revision = options.revision;
  let running: Promise<boolean> | null = null;
  let conflict = false;
  const dirty = () => currentKey !== savedKey;
  const flush = (): Promise<boolean> => {
    if (conflict) return Promise.resolve(false);
    if (running) return running.then((ok) => ok && dirty() ? flush() : ok);
    if (!dirty()) return Promise.resolve(true);
    running = (async () => {
      try {
        while (dirty()) {
          const captured = current;
          const key = currentKey;
          options.onStatus("saving");
          const result = await options.save(captured, revision);
          revision = result.draft_revision;
          savedKey = key;
          options.onSaved?.(captured, result);
        }
        options.onStatus("saved");
        return true;
      } catch (error) {
        conflict = /conflict|40001/i.test(String((error as { message?: string; code?: string })?.message ?? error)) || (error as { code?: string })?.code === "40001";
        options.onStatus(conflict ? "conflict" : "error");
        return false;
      } finally { running = null; }
    })();
    return running;
  };
  return {
    update(config: T) { current = config; currentKey = draftConfigKey(config); if (dirty()) options.onStatus(conflict ? "conflict" : "pending"); },
    flush, dirty, getRevision: () => revision, getCurrent: () => current,
  };
}