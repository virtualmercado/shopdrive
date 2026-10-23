import { describe, expect, it, vi } from "vitest";
import { runGuardedSave, sanitizeSaveError } from "./guardedSave";
import { nextRetryAction } from "@/components/DashboardErrorBoundary";

const setup = (run: () => Promise<void>) => {
  const inFlight = { current: false };
  const loading: boolean[] = [];
  const onSuccess = vi.fn();
  const onError = vi.fn();
  return { inFlight, loading, onSuccess, onError, opts: { inFlight, setLoading: (v: boolean) => loading.push(v), run, onSuccess, onError } };
};

describe("runGuardedSave", () => {
  it("success shows success only after the write and clears loading", async () => {
    const s = setup(async () => {});
    expect(await runGuardedSave(s.opts)).toBe("success");
    expect(s.loading).toEqual([true, false]);
    expect(s.onSuccess).toHaveBeenCalledTimes(1);
    expect(s.onError).not.toHaveBeenCalled();
  });

  it("error clears loading, reports error and allows a new attempt", async () => {
    const s = setup(async () => { throw new Error("network"); });
    expect(await runGuardedSave(s.opts)).toBe("error");
    expect(s.loading).toEqual([true, false]);
    expect(s.onSuccess).not.toHaveBeenCalled();
    expect(s.inFlight.current).toBe(false);
    expect(await runGuardedSave(s.opts)).toBe("error");
  });

  it("double click runs the write only once while in flight", async () => {
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const s = setup(run);
    const first = runGuardedSave(s.opts);
    expect(await runGuardedSave(s.opts)).toBe("skipped");
    release();
    expect(await first).toBe("success");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("exception thrown after the write in onSuccess does not re-run the write", async () => {
    const run = vi.fn(async () => {});
    const s = setup(run);
    const opts = { ...s.opts, onSuccess: () => { throw new Error("render"); } };
    await expect(runGuardedSave(opts)).rejects.toThrow("render");
    expect(run).toHaveBeenCalledTimes(1);
    expect(s.loading).toEqual([true, false]);
  });

  it("sanitized error keeps only name/code", () => {
    expect(sanitizeSaveError({ name: "PostgrestError", code: "42501", message: "secret", details: "x" }))
      .toEqual({ name: "PostgrestError", code: "42501" });
  });
});

describe("DashboardErrorBoundary retry", () => {
  it("first retry re-renders, next one reloads (no infinite loop)", () => {
    expect(nextRetryAction(0)).toBe("rerender");
    expect(nextRetryAction(1)).toBe("reload");
  });
});
