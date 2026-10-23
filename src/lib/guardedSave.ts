/**
 * Single-flight guard for merchant "save" actions.
 * - Only one save runs at a time (double click is ignored while in flight).
 * - Loading is always cleared in `finally`, even on exceptions.
 * - Never retries automatically (avoids duplicated writes).
 */
export type GuardedSaveResult = "success" | "error" | "skipped";

export interface GuardedSaveOptions {
  inFlight: { current: boolean };
  setLoading: (value: boolean) => void;
  run: () => Promise<void>;
  onSuccess: () => void;
  onError: (error: unknown) => void;
}

export async function runGuardedSave(opts: GuardedSaveOptions): Promise<GuardedSaveResult> {
  if (opts.inFlight.current) return "skipped";
  opts.inFlight.current = true;
  opts.setLoading(true);
  try {
    await opts.run();
  } catch (error) {
    opts.inFlight.current = false;
    opts.setLoading(false);
    opts.onError(error);
    return "error";
  }
  opts.inFlight.current = false;
  opts.setLoading(false);
  opts.onSuccess();
  return "success";
}

export const SAVE_ERROR_MESSAGE = "Não foi possível salvar as alterações. Tente novamente.";
export const SAVE_SUCCESS_MESSAGE = "Configurações salvas com sucesso.";

/** Strips anything that could carry user content; keeps only technical code. */
export function sanitizeSaveError(error: unknown): { name?: string; code?: string } {
  if (!error || typeof error !== "object") return {};
  const e = error as { name?: unknown; code?: unknown };
  return {
    name: typeof e.name === "string" ? e.name : undefined,
    code: typeof e.code === "string" ? e.code : undefined,
  };
}
