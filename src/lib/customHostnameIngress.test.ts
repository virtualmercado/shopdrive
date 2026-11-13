import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RESERVED_DOMAIN_SUFFIXES, normalizeCustomDomain } from "../../supabase/functions/_shared/customDomainCore";
import {
  ensureCustomHostname, evaluateCloudflareWrite, isExplicitRemoval, removeCustomHostname, writePolicyFromConfig,
  provisioningAuditLine, type CfCall, type WritePolicy,
} from "../../supabase/functions/_shared/customHostnameWrites";
import { handleDiagnostic, type DiagnosticDeps } from "../../supabase/functions/cloudflare-read-diagnostic/diagnostic";

const ZONE = "0123456789abcdef0123456789abcdef";
const PROTECTED_ID = "fd3cd405-657e-4da7-a2ce-6424dc865670";
const ON: WritePolicy = { writesEnabled: true, deletesEnabled: true, protectedIds: [PROTECTED_ID] };
const OFF = writePolicyFromConfig({ cloudflare_writes_enabled: false, cloudflare_deletes_enabled: false, protected_external_hostname_ids: [PROTECTED_ID] });

/** In-memory Cloudflare zone that, like the real API, rejects duplicate hostnames. */
function fakeZone(opts: { postTimeoutOnce?: boolean } = {}) {
  const objects = new Map<string, { id: string; hostname: string; status: string; ssl: { status: string } }>();
  const calls: string[] = [];
  let n = 0;
  let timeout = !!opts.postTimeoutOnce;
  const cf: CfCall = async (method, path, body) => {
    calls.push(method);
    await Promise.resolve();
    if (method === "GET" && path.includes("?hostname=")) {
      const h = decodeURIComponent(path.split("?hostname=")[1]);
      return { status: 200, body: { success: true, result: [...objects.values()].filter((o) => o.hostname === h) } };
    }
    if (method === "POST") {
      const h = (body as { hostname: string }).hostname;
      if ([...objects.values()].some((o) => o.hostname === h)) return { status: 409, body: { success: false, errors: [{ code: 1406, message: "Duplicate custom hostname found." }] } };
      const o = { id: `00000000-0000-4000-8000-00000000000${++n}`, hostname: h, status: "pending", ssl: { status: "initializing" } };
      objects.set(o.id, o);
      if (timeout) { timeout = false; throw new Error("timeout"); }
      return { status: 201, body: { success: true, result: o } };
    }
    const id = path.split("/").pop()!;
    if (method === "GET") return objects.has(id) ? { status: 200, body: { success: true, result: objects.get(id) } } : { status: 404, body: null };
    if (method === "DELETE") { objects.delete(id); return { status: 200, body: { success: true } }; }
    return { status: 400, body: null };
  };
  return { cf, objects, calls };
}

const ensure = (cf: CfCall, policy = ON, knownId: string | null = null, claimed = false) =>
  ensureCustomHostname({ policy, zoneId: ZONE, hostname: "www.loja-exemplo.com.br", knownId, cf, isIdClaimedElsewhere: async () => claimed });

afterEach(() => vi.unstubAllGlobals());

describe("A — ShopDrive internal hostnames are never captured", () => {
  it("worker protected list mirrors the backend reserved suffixes", () => {
    const src = readFileSync("cloudflare/workers/shopdrive-custom-domain-router.js", "utf8");
    const list = src.match(/PROTECTED_HOST_SUFFIXES = \[([\s\S]*?)\]/)![1].match(/"([^"]+)"/g)!.map((s) => s.slice(1, -1));
    expect(list).toEqual([...RESERVED_DOMAIN_SUFFIXES]);
  });
  it("internal hostnames are rejected as merchant domains and as create targets", () => {
    for (const h of ["shopdrive.com.br", "www.shopdrive.com.br", "domains.shopdrive.com.br", "api.supabase.co"]) {
      expect(normalizeCustomDomain(h).ok).toBe(false);
      expect(evaluateCloudflareWrite(ON, "create", { hostname: h })).toEqual({ allowed: false, reason: "reserved_hostname" });
    }
  });
});

describe("D/E — idempotent creation", () => {
  it("D: two concurrent runs never produce two Custom Hostnames", async () => {
    const z = fakeZone();
    const [a, b] = await Promise.all([ensure(z.cf), ensure(z.cf)]);
    expect(z.objects.size).toBe(1);
    const ids = [a, b].map((o) => ("id" in o ? o.id : null));
    expect(new Set(ids).size).toBe(1);
  });
  it("D: a known id is reconciled without any Cloudflare call", async () => {
    const z = fakeZone();
    expect(await ensure(z.cf, ON, "00000000-0000-4000-8000-000000000009")).toEqual({ kind: "reconcile", id: "00000000-0000-4000-8000-000000000009" });
    expect(z.calls).toEqual([]);
  });
  it("E: retry after a POST timeout looks up first and adopts, without a second POST", async () => {
    const z = fakeZone({ postTimeoutOnce: true });
    expect((await ensure(z.cf)).kind).toBe("unavailable");
    const second = await ensure(z.cf);
    expect(second.kind).toBe("adopted");
    expect(z.calls.filter((c) => c === "POST")).toHaveLength(1);
    expect(z.objects.size).toBe(1);
  });
  it("E: lookup failure never falls back to a blind POST", async () => {
    const calls: string[] = [];
    const cf: CfCall = async (m) => { calls.push(m); throw new Error("timeout"); };
    expect(await ensure(cf)).toEqual({ kind: "unavailable", stage: "lookup" });
    expect(calls).toEqual(["GET"]);
  });
  it("an object owned by another domain or protected is never adopted", async () => {
    const z = fakeZone();
    await ensure(z.cf);
    expect(await ensure(z.cf, ON, null, true)).toEqual({ kind: "conflict", reason: "claimed_elsewhere" });
    const id = [...z.objects.keys()][0];
    expect(await ensure(z.cf, { ...ON, protectedIds: [id] })).toEqual({ kind: "conflict", reason: "protected_hostname" });
  });
  it("activation is not implied by POST success: created object stays pending", async () => {
    const z = fakeZone();
    const o = await ensure(z.cf);
    expect(o.kind === "created" && o.result.status).toBe("pending");
  });
});

describe("F — kill switch", () => {
  it("defaults to no writes when config is missing or flags are false", () => {
    expect(writePolicyFromConfig(null)).toEqual({ writesEnabled: false, deletesEnabled: false, protectedIds: [] });
    expect(writePolicyFromConfig({ cloudflare_writes_enabled: "true" }).writesEnabled).toBe(false);
  });
  it("blocks create and delete before any Cloudflare call", async () => {
    const z = fakeZone();
    expect(await ensure(z.cf, OFF)).toEqual({ kind: "blocked", reason: "writes_disabled" });
    expect(await removeCustomHostname({ policy: OFF, zoneId: ZONE, externalId: "00000000-0000-4000-8000-000000000001", expectedHostname: "www.loja-exemplo.com.br", cf: z.cf }))
      .toEqual({ kind: "blocked", reason: "writes_disabled" });
    expect(z.calls).toEqual([]);
  });
  it("deletes need their own stricter flag", () => {
    expect(evaluateCloudflareWrite({ ...ON, deletesEnabled: false }, "delete", { externalId: "00000000-0000-4000-8000-000000000001" }))
      .toEqual({ allowed: false, reason: "deletes_disabled" });
    expect(evaluateCloudflareWrite({ ...ON, deletesEnabled: false }, "create", { hostname: "www.loja-exemplo.com.br" })).toEqual({ allowed: true });
  });
  it("the protected existing Custom Hostname can never be deleted", async () => {
    const z = fakeZone();
    expect(await removeCustomHostname({ policy: ON, zoneId: ZONE, externalId: PROTECTED_ID, expectedHostname: "www.redearoma.com.br", cf: z.cf }))
      .toEqual({ kind: "blocked", reason: "protected_hostname" });
    expect(z.calls).toEqual([]);
  });
});

describe("G — GET diagnostics keep working", () => {
  it("infrastructure audit only issues GETs and never returns the tokens", async () => {
    const methods: string[] = [];
    const fetchImpl = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      return new Response(JSON.stringify({ success: true, result: [] }), { status: 200 });
    });
    const env: Record<string, string> = { CLOUDFLARE_API_TOKEN: "read-token-value", CLOUDFLARE_ZONE_ID: ZONE, CLOUDFLARE_CUSTOM_HOSTNAMES_TOKEN: "prov-token-value" };
    const deps = { getUserId: async () => "u1", isAdmin: async () => true, env: (n: string) => env[n], fetchImpl } as unknown as DiagnosticDeps;
    const r = await handleDiagnostic(new Request("https://x.test/?scope=infrastructure"), { ...deps, getUserId: async () => "u1" });
    // no Authorization header → 401 before any call
    expect(r.status).toBe(401);
    const ok = await handleDiagnostic(new Request("https://x.test/?scope=infrastructure", { headers: { Authorization: "Bearer jwt" } }), deps);
    expect(ok.status).toBe(200);
    expect(methods.length).toBeGreaterThan(0);
    expect(new Set(methods)).toEqual(new Set(["GET"]));
    const out = JSON.stringify(ok.body);
    expect(out).not.toContain("read-token-value");
    expect(out).not.toContain("prov-token-value");
  });
  it("non-admins cannot run the infrastructure audit", async () => {
    const fetchImpl = vi.fn();
    const deps = { getUserId: async () => "u1", isAdmin: async () => false, env: () => ZONE, fetchImpl } as unknown as DiagnosticDeps;
    expect((await handleDiagnostic(new Request("https://x.test/?scope=infrastructure", { headers: { Authorization: "Bearer jwt" } }), deps)).status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("H — no DELETE after transient errors", () => {
  const row = { routing_status: "removing", v2_state: "inactive", disconnected_at: "2026-11-11T00:00:00Z", external_hostname_id: "00000000-0000-4000-8000-000000000001" };
  it("only an explicit internal disconnect qualifies for removal", () => {
    expect(isExplicitRemoval(row)).toBe(true);
    expect(isExplicitRemoval({ ...row, routing_status: "provisioning" })).toBe(false);
    expect(isExplicitRemoval({ ...row, v2_state: "ssl_provisioning" })).toBe(false);
    expect(isExplicitRemoval({ ...row, disconnected_at: null })).toBe(false);
  });
  it.each([[500, "retry"], [0, "retry"]])("GET %s before delete → %s, no DELETE", async (status, kind) => {
    const calls: string[] = [];
    const cf: CfCall = async (m) => { calls.push(m); if (status === 0) throw new Error("timeout"); return { status, body: null }; };
    const r = await removeCustomHostname({ policy: ON, zoneId: ZONE, externalId: row.external_hostname_id, expectedHostname: "www.loja-exemplo.com.br", cf });
    expect(r.kind).toBe(kind);
    expect(calls).not.toContain("DELETE");
  });
  it("a different hostname behind the id is never deleted", async () => {
    const calls: string[] = [];
    const cf: CfCall = async (m) => { calls.push(m); return { status: 200, body: { result: { id: row.external_hostname_id, hostname: "www.outra-loja.com.br" } } }; };
    expect((await removeCustomHostname({ policy: ON, zoneId: ZONE, externalId: row.external_hostname_id, expectedHostname: "www.loja-exemplo.com.br", cf })).kind).toBe("mismatch");
    expect(calls).toEqual(["GET"]);
  });
  it("an already absent object is treated as removed without DELETE", async () => {
    const z = fakeZone();
    expect(await removeCustomHostname({ policy: ON, zoneId: ZONE, externalId: row.external_hostname_id, expectedHostname: "www.loja-exemplo.com.br", cf: z.cf }))
      .toEqual({ kind: "removed", via: "already_absent" });
    expect(z.calls).toEqual(["GET"]);
  });
});

describe("audit trail", () => {
  it("records transition fields with long token-like values redacted", () => {
    const line = JSON.parse(provisioningAuditLine({ event: "create_created", store_id: "s1", hostname: "www.loja-exemplo.com.br",
      external_hostname_id: "id1", cloudflare_status: "pending", ssl_status: "initializing", error: `cf_400:bad ${"x".repeat(40)}` }));
    expect(line).toMatchObject({ scope: "custom_hostname", store_id: "s1", hostname: "www.loja-exemplo.com.br", cloudflare_status: "pending" });
    expect(line.error).toContain("[redacted]");
  });
});
