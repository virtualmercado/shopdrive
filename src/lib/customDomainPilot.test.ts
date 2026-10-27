import { describe, expect, it } from "vitest";
import {
  normalizeExactDomainHostname, getPilotVerificationHostname, verifyDomain, nextV2State,
  areDnsRecordsVerified, type Resolver, type IngressConfig,
} from "../../supabase/functions/_shared/customDomainCore";

const host = "www.redearoma.com.br";
const store = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const scope = { isAdmin: true, storeId: store, domainMerchantId: store, canonicalDomain: "redearoma.com.br",
  access: { store_id: store, enabled: true, pilot_hostname: host } };
const config: IngressConfig = { ingressReady: false, rootType: "A", rootValue: null,
  wwwType: "CNAME", wwwValue: "pilot-ingress.example.net", txtHostPrefix: "_shopdrive-verification", txtValuePrefix: "shopdrive=" };
const calls: string[] = [];
const resolver: Resolver = async (name, type) => {
  calls.push(`${type} ${name}`);
  if (type === "NS") return { status: "ok", answers: ["romina.ns.cloudflare.com"] };
  if (type === "TXT") return { status: "ok", answers: ["shopdrive=test-proof"] };
  if (type === "CNAME" && name === host) return { status: "ok", answers: ["pilot-ingress.example.net"] };
  return { status: "nxdomain", answers: [] };
};
const run = (extra: Partial<Parameters<typeof verifyDomain>[0]> = {}) => verifyDomain({
  domain: "redearoma.com.br", token: "test-proof", expiresAt: "2030-01-01T00:00:00Z",
  ownershipVerifiedAt: null, config, resolve: resolver, pilotHostname: host, ...extra,
});

describe("exact administrative pilot scope", () => {
  it("preserves www independently of canonical normalization", () => expect(normalizeExactDomainHostname(host)).toBe(host));
  it("normalizes only case and final dot", () => expect(normalizeExactDomainHostname("WWW.REDEAROMA.COM.BR.")).toBe(host));
  it.each(["https://www.redearoma.com.br", " www.redearoma.com.br", `${host}/`, `${host}:443`, `${host}?store_id=x`, `${host}#x`, "*.redearoma.com.br", "shopdrive.com.br"])("rejects %s", input => expect(normalizeExactDomainHostname(input)).toBeNull());
  it("allows the protected exact pair", () => expect(getPilotVerificationHostname(scope)).toBe(host));
  it("denies ordinary merchant", () => expect(getPilotVerificationHostname({ ...scope, isAdmin: false })).toBeNull());
  it("denies disabled access", () => expect(getPilotVerificationHostname({ ...scope, access: { ...scope.access, enabled: false } })).toBeNull());
  it("denies missing access", () => expect(getPilotVerificationHostname({ ...scope, access: null })).toBeNull());
  it("denies other access merchant", () => expect(getPilotVerificationHostname({ ...scope, access: { ...scope.access, store_id: other } })).toBeNull());
  it("denies other domain merchant", () => expect(getPilotVerificationHostname({ ...scope, domainMerchantId: other })).toBeNull());
  it("denies unrelated canonical domain", () => expect(getPilotVerificationHostname({ ...scope, canonicalDomain: "outra.com.br" })).toBeNull());
  it("revocation removes exact DNS scope", () => expect(getPilotVerificationHostname({ ...scope, access: { ...scope.access, pilot_hostname: null } })).toBeNull());
});

describe("exact pilot DNS versus normal root+www", () => {
  it("queries only authorized CNAME, retains real ShopDrive TXT and never requires apex A", async () => {
    calls.length = 0;
    const result = await run();
    expect(calls).toEqual(["NS redearoma.com.br", "TXT _shopdrive-verification.redearoma.com.br", "CNAME www.redearoma.com.br"]);
    expect(result.root).toBe("not_required"); expect(result.www).toBe("ok"); expect(result.ownership).toBe("verified");
    expect(areDnsRecordsVerified(result)).toBe(true);
    expect(config.ingressReady).toBe(false);
  });
  it("normal verification retains both records", async () => {
    calls.length = 0;
    const result = await run({ pilotHostname: null, config: { ...config, ingressReady: true, rootValue: "203.0.113.10" } });
    expect(calls).toContain("A redearoma.com.br"); expect(calls).toContain("CNAME www.redearoma.com.br");
    expect(result.root).toBe("missing"); expect(areDnsRecordsVerified(result)).toBe(false);
  });
  it("normal verification remains blocked with global readiness false", async () => {
    calls.length = 0; const result = await run({ pilotHostname: null });
    expect(result.root).toBe("not_configured"); expect(result.www).toBe("not_configured");
    expect(calls).not.toContain("CNAME www.redearoma.com.br");
  });
  it("scope mismatch never queries another pilot host", async () => {
    calls.length = 0; const result = await run({ pilotHostname: "www.outra.com.br" });
    expect(areDnsRecordsVerified(result)).toBe(false); expect(calls).not.toContain("CNAME www.outra.com.br");
  });
  it("missing configured target never proves DNS", async () => expect(areDnsRecordsVerified(await run({ config: { ...config, wwwValue: null } }))).toBe(false));
  it("pilot requires CNAME rather than silently accepting A", async () => expect(areDnsRecordsVerified(await run({ config: { ...config, wwwType: "A" } }))).toBe(false));
  it("wrong exact host target fails even if root exists", async () => {
    const result = await run({ resolve: async (name, type) => type === "CNAME" ? { status: "ok", answers: ["wrong.example.net"] } : resolver(name, type) });
    expect(result.www).toBe("wrong"); expect(areDnsRecordsVerified(result)).toBe(false);
  });
  it.each(["missing", "mismatch", "expired"])("ownership %s cannot activate pilot", async status => {
    const result = await run({ ...(status === "expired" ? { expiresAt: "2000-01-01T00:00:00Z" } : {}),
      resolve: async (name, type) => type === "TXT" ? { status: "ok", answers: status === "missing" ? [] : ["acme-only-proof"] } : resolver(name, type) });
    expect(nextV2State({ current: "pending_ownership", result, routingStatus: "active", sslStatus: "active" })).not.toBe("active");
  });
  it("DNS alone cannot activate", async () => expect(nextV2State({ current: "pending_ownership", result: await run(), routingStatus: "not_started", sslStatus: "pending" })).toBe("dns_verified"));
  it("real routing and SSL remain required", async () => {
    const result = await run();
    expect(nextV2State({ current: "pending_ownership", result, routingStatus: "active", sslStatus: "pending" })).toBe("ssl_provisioning");
    expect(nextV2State({ current: "pending_ownership", result, routingStatus: "active", sslStatus: "active" })).toBe("active");
  });
  it("not_required without protected pilot scope cannot activate", async () => {
    const result = await run(); delete result.pilotHostname;
    expect(nextV2State({ current: "dns_pending", result, routingStatus: "active", sslStatus: "active" })).toBe("dns_pending");
  });
});