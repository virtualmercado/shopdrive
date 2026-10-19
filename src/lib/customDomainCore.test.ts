import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  applyRevalidation, detectDnsProvider, getStorePublicBaseUrl, nextV2State, normalizeCustomDomain,
  verifyDomain, type IngressConfig, type Resolver, type DnsAnswer, type VerificationResult,
} from "../../supabase/functions/_shared/customDomainCore";
import { isCustomDomainConnected } from "./customDomainStatus";

const ok = (answers: string[]): DnsAnswer => ({ status: "ok", answers });
const fake = (map: Record<string, DnsAnswer>): Resolver => async (name, type) => map[`${type} ${name}`] ?? { status: "nxdomain", answers: [] };
const TOKEN = "abc123";
const cfg = (ready = true): IngressConfig => ({
  ingressReady: ready, rootType: "A", rootValue: "203.0.113.10", wwwType: "CNAME", wwwValue: "ingress.example.net",
  txtHostPrefix: "_shopdrive-verification", txtValuePrefix: "shopdrive=",
});
const future = new Date(Date.now() + 3600_000).toISOString();
const base = { domain: "loja.com.br", token: TOKEN, expiresAt: future, ownershipVerifiedAt: null };
const healthy = {
  "NS loja.com.br": ok(["romina.ns.cloudflare.com"]),
  "TXT _shopdrive-verification.loja.com.br": ok([`shopdrive=${TOKEN}`]),
  "A loja.com.br": ok(["203.0.113.10"]),
  "CNAME www.loja.com.br": ok(["ingress.example.net"]),
};

describe("normalization", () => {
  it.each([
    ["exemplo.com.br", "exemplo.com.br"], ["https://EXEMPLO.com.br/", "exemplo.com.br"], ["http://exemplo.com.br", "exemplo.com.br"],
    ["www.exemplo.com.br", "exemplo.com.br"], ["exemplo.com.br.", "exemplo.com.br"],
  ])("%s → %s", (i, o) => expect(normalizeCustomDomain(i)).toEqual({ ok: true, domain: o }));
  it.each(["exemplo.com.br/loja", "exemplo.com.br?x=1", "exemplo.com.br#a", "exemplo.com.br:8080", "192.168.0.1", "localhost", "exemplo", "-a.com"])(
    "rejects %s", (i) => expect(normalizeCustomDomain(i)).toEqual({ ok: false, reason: "invalid" }));
  it.each(["shopdrive.com.br", "loja.shopdrive.com.br", "x.lovable.app", "abc.supabase.co"])(
    "reserves %s", (i) => expect(normalizeCustomDomain(i)).toEqual({ ok: false, reason: "reserved" }));
});

describe("DNS provider detection by nameservers", () => {
  it("Cloudflare", () => expect(detectDnsProvider(["etienne.ns.cloudflare.com."])?.slug).toBe("cloudflare"));
  it("Hostinger", () => expect(detectDnsProvider(["ns1.dns-parking.com"])?.slug).toBe("hostinger"));
  it("Registro.br", () => expect(detectDnsProvider(["a.dns.br", "b.dns.br"])?.slug).toBe("registro-br"));
  it("unknown falls back to manual", () => expect(detectDnsProvider(["ns1.desconhecido.net"])).toBeNull());
});

describe("ownership TXT", () => {
  const run = (txt: DnsAnswer | undefined, extra: Partial<typeof base> = {}) =>
    verifyDomain({ ...base, ...extra, config: cfg(), resolve: fake({ ...healthy, ...(txt ? { "TXT _shopdrive-verification.loja.com.br": txt } : { "TXT _shopdrive-verification.loja.com.br": undefined as never }) }) });
  it("correct token verifies", async () => expect((await run(ok([`shopdrive=${TOKEN}`]))).ownership).toBe("verified"));
  it("wrong token", async () => expect((await run(ok(["shopdrive=other"]))).ownership).toBe("mismatch"));
  it("missing TXT", async () => expect((await run(undefined)).ownership).toBe("missing"));
  it("timeout is not a merchant error", async () => expect((await run({ status: "timeout", answers: [] })).ownership).toBe("resolver_unavailable"));
  it("expired token", async () => expect((await run(ok([`shopdrive=${TOKEN}`]), { expiresAt: new Date(Date.now() - 1000).toISOString() })).ownership).toBe("expired"));
});

const stateFor = async (map: Record<string, DnsAnswer>, routingStatus = "not_started", sslStatus = "pending", ready = true) => {
  const r = await verifyDomain({ ...base, config: cfg(ready), resolve: fake(map) });
  return nextV2State({ current: "pending_ownership", result: r, routingStatus, sslStatus });
};

describe("DNS target and state machine", () => {
  it("correct root/www without routing never becomes active", async () => expect(await stateFor(healthy)).toBe("dns_verified"));
  it("wrong root", async () => expect(await stateFor({ ...healthy, "A loja.com.br": ok(["1.2.3.4"]) })).toBe("dns_error"));
  it("dead CNAME", async () => expect(await stateFor({ ...healthy, "CNAME www.loja.com.br": ok(["cname.vm-dns.com"]) })).toBe("dns_error"));
  it("NXDOMAIN / partial propagation", async () => expect(await stateFor({ ...healthy, "CNAME www.loja.com.br": undefined as never })).toBe("dns_pending"));
  it("resolver timeout keeps progress", async () => expect(await stateFor({ ...healthy, "A loja.com.br": { status: "timeout", answers: [] } })).toBe("ownership_verified"));
  it("no ingress configured never passes dns", async () => expect(await stateFor(healthy, "active", "active", false)).toBe("dns_pending"));
  it("SSL pending", async () => expect(await stateFor(healthy, "active", "pending")).toBe("ssl_provisioning"));
  it("SSL error", async () => expect(await stateFor(healthy, "active", "error")).toBe("ssl_error"));
  it("routing error", async () => expect(await stateFor(healthy, "error")).toBe("routing_error"));
  it("only routing+SSL active reaches active", async () => expect(await stateFor(healthy, "active", "active")).toBe("active"));
  it("wrong ownership blocks even with perfect DNS", async () =>
    expect(await stateFor({ ...healthy, "TXT _shopdrive-verification.loja.com.br": ok(["shopdrive=x"]) }, "active", "active")).toBe("ownership_error"));
  it("disconnected stays disconnected", () =>
    expect(nextV2State({ current: "inactive", result: {} as VerificationResult, routingStatus: "active", sslStatus: "active" })).toBe("inactive"));
});

describe("revalidation", () => {
  it("first failure does not flag", () => expect(applyRevalidation(0, false, 3)).toEqual({ failures: 1, needsReverification: false }));
  it("threshold flags reverification", () => expect(applyRevalidation(2, false, 3)).toEqual({ failures: 3, needsReverification: true }));
  it("success resets", () => expect(applyRevalidation(2, true, 3).failures).toBe(0));
  it("resolver outage does not count", () => expect(applyRevalidation(1, null, 3).failures).toBe(1));
});

describe("public URL and legacy", () => {
  it("custom domain only when active", () => {
    expect(getStorePublicBaseUrl({ slug: "loja", customDomain: "loja.com.br", customDomainActive: true })).toBe("https://loja.com.br");
    expect(getStorePublicBaseUrl({ slug: "loja", customDomain: "loja.com.br", customDomainActive: false })).toBe("https://shopdrive.com.br/loja");
  });
  it("legacy is_active row is not connected", () => expect(isCustomDomainConnected({ active: false, state: "needs_reverification" })).toBe(false));
});

describe("domain flow source hygiene", () => {
  const files = ["src/hooks/useMerchantDomain.tsx", "src/components/domain", "src/components/admin/StoreDomainTab.tsx",
    "supabase/functions/verify-custom-domain-dns", "supabase/functions/_shared/customDomainCore.ts"];
  const collect = (p: string): string[] => statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => collect(join(p, f))) : [p];
  const sources = files.flatMap(collect).map((f) => readFileSync(f, "utf8"));
  it("never uses Math.random", () => sources.forEach((s) => expect(s).not.toMatch(/Math\.random/)));
  it("never recommends cname.vm-dns.com", () => sources.forEach((s) => expect(s).not.toContain("vm-dns.com")));
  it("shows the email preservation notice", () => expect(sources.join("")).toContain("Não remova registros MX, SPF, DKIM, DMARC"));
});
