import { describe, expect, it, vi } from "vitest";
import { runDiagnostic, type DiagnosticDeps } from "../../supabase/functions/_shared/cloudflareReadDiagnostic";

const TOKEN = "tok-test-value";
const ZONE = "0123456789abcdef0123456789abcdef";
const deps = (o: Partial<DiagnosticDeps> = {}, body: unknown = { success: true, errors: [], result: [], result_info: { total_count: 0 } }, status = 200) => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  return { fetchImpl, d: { getUserId: async () => "u1", isAdmin: async () => true, env: (n: string) => ({ CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ZONE_ID: ZONE } as Record<string, string>)[n], fetchImpl, ...o } as DiagnosticDeps };
};

describe("cloudflare read diagnostic", () => {
  it("anonymous is blocked without calling Cloudflare", async () => {
    const { d, fetchImpl } = deps();
    expect((await runDiagnostic(null, d)).status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("non-admin is blocked without calling Cloudflare", async () => {
    const { d, fetchImpl } = deps({ isAdmin: async () => false });
    expect((await runDiagnostic("jwt", d)).status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("admin gets an empty list as success, GET only, no secrets in output", async () => {
    const { d, fetchImpl } = deps();
    const r = await runDiagnostic("jwt", d);
    expect(r.body).toMatchObject({ ok: true, total_count: 0, http_status: 200 });
    expect(fetchImpl.mock.calls[0][1].method).toBe("GET");
    const out = JSON.stringify(r);
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain(ZONE);
  });
  it("reports only the missing secret name", async () => {
    const { d, fetchImpl } = deps({ env: (n) => (n === "CLOUDFLARE_API_TOKEN" ? TOKEN : "") });
    expect((await runDiagnostic("jwt", d)).body).toEqual({ ok: false, missing_secrets: ["CLOUDFLARE_ZONE_ID"] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("403 is classified as insufficient permission with sanitized message", async () => {
    const { d } = deps({}, { success: false, errors: [{ code: 10000, message: `Authentication error ${ZONE}` }] }, 403);
    const r = await runDiagnostic("jwt", d);
    expect(r.body).toMatchObject({ ok: false, classification: "permission_insufficient", error_code: 10000 });
    expect(JSON.stringify(r)).not.toContain(ZONE);
  });
});