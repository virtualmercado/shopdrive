import { describe, expect, it, vi } from "vitest";
import { handleDiagnostic, runDiagnostic, type DiagnosticDeps } from "../../supabase/functions/cloudflare-read-diagnostic/diagnostic";

const TOKEN = "tok-test-value";
const ZONE = "0123456789abcdef0123456789abcdef";
const deps = (o: Partial<DiagnosticDeps> = {}, body: unknown = { success: true, errors: [], result: [], result_info: { total_count: 0 } }, status = 200) => {
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
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
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe("GET");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe("error");
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
  it("invalid session is blocked before role check and secrets", async () => {
    const isAdmin = vi.fn(async () => true);
    const env = vi.fn(() => TOKEN);
    const { d, fetchImpl } = deps({ getUserId: async () => null, isAdmin, env });
    expect((await runDiagnostic("invalid", d)).status).toBe(401);
    expect(isAdmin).not.toHaveBeenCalled();
    expect(env).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each(["POST", "PATCH", "PUT", "DELETE", "HEAD"])("blocks incoming %s without external calls", async (method) => {
    const { d, fetchImpl } = deps();
    expect((await handleDiagnostic(new Request("https://example.test", { method }), d)).status).toBe(405);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("rejects arbitrary input instead of selecting another resource", async () => {
    const { d, fetchImpl } = deps();
    expect((await handleDiagnostic(new Request("https://example.test?zone=other"), d)).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each(["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"])("empty %s stops the call", async (name) => {
    const { d, fetchImpl } = deps({ env: (n) => n === name ? "   " : n === "CLOUDFLARE_API_TOKEN" ? TOKEN : ZONE });
    expect((await runDiagnostic("jwt", d)).body).toEqual({ ok: false, missing_secrets: [name] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("never relays arbitrary provider messages or unknown statuses", async () => {
    const { d } = deps({}, { success: true, result: [{ status: TOKEN, ssl: { status: ZONE } }], result_info: { total_count: 1 } });
    const r = await runDiagnostic("jwt", d);
    expect(r.body).toMatchObject({ total_count: 1, hostname_status: { unknown: 1 }, ssl_status: { unknown: 1 } });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    expect(JSON.stringify(r)).not.toContain(ZONE);
  });
  it("keeps total and aggregate scope explicit", async () => {
    const { d } = deps({}, { success: true, result: [{ status: "active", ssl: { status: "active" } }], result_info: { total_count: 51 } });
    expect((await runDiagnostic("jwt", d)).body).toMatchObject({ total_count: 51, aggregated_count: 1, aggregates_complete: false });
  });
  it("network failure never retries or falls back", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("untrusted sensitive network error"); });
    const { d } = deps({ fetchImpl });
    expect((await runDiagnostic("jwt", d)).body).toMatchObject({ reachable: false, classification: "network_error" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("malformed result does not claim successful structure", async () => {
    const { d } = deps({}, { success: true, result: {} });
    expect((await runDiagnostic("jwt", d)).body).toMatchObject({ ok: false, structure_valid: false, total_count: null });
  });
});