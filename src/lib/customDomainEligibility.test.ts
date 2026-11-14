import { describe, expect, it } from "vitest";
import {
  areDnsRecordsVerified, nextV2State, verifyDomain, type IngressConfig, type Resolver,
} from "../../supabase/functions/_shared/customDomainCore";
import { summarizeCustomHostnameObservation } from "../../supabase/functions/_shared/customDomainProvisioning";

const cnameOnly: IngressConfig = { ingressReady: true, rootType: "A", rootValue: null, wwwType: "CNAME",
  wwwValue: "domains.shopdrive.com.br", txtHostPrefix: "_shopdrive-verification", txtValuePrefix: "shopdrive=" };

function resolver(www: string[]): { resolve: Resolver; calls: string[] } {
  const calls: string[] = [];
  const resolve: Resolver = async (name, type) => {
    calls.push(`${type} ${name}`);
    if (type === "NS") return { status: "ok", answers: ["a.ns.example.net"] };
    if (type === "TXT") return { status: "ok", answers: ["shopdrive=tok"] };
    if (type === "CNAME" && name === "www.minhaloja.com.br") return www.length ? { status: "ok", answers: www } : { status: "nxdomain", answers: [] };
    return { status: "nxdomain", answers: [] };
  };
  return { resolve, calls };
}
const run = (config: IngressConfig, www: string[]) => {
  const r = resolver(www);
  return verifyDomain({ domain: "minhaloja.com.br", token: "tok", expiresAt: "2030-01-01T00:00:00Z", ownershipVerifiedAt: null,
    config, resolve: r.resolve }).then((result) => ({ result, calls: r.calls }));
};

describe("CNAME-only global ingress (no apex target published)", () => {
  it("checks only www and marks the exact www scope", async () => {
    const { result, calls } = await run(cnameOnly, ["domains.shopdrive.com.br"]);
    expect(result.root).toBe("not_required");
    expect(result.www).toBe("ok");
    expect(result.wwwOnlyHostname).toBe("www.minhaloja.com.br");
    expect(calls).not.toContain("A minhaloja.com.br");
    expect(areDnsRecordsVerified(result)).toBe(true);
  });
  it("DNS verification alone never activates", async () => {
    const { result } = await run(cnameOnly, ["domains.shopdrive.com.br"]);
    expect(nextV2State({ current: "ownership_verified", result, routingStatus: "not_started", sslStatus: "pending" })).toBe("dns_verified");
    expect(nextV2State({ current: "dns_verified", result, routingStatus: "active", sslStatus: "pending" })).toBe("ssl_provisioning");
    expect(nextV2State({ current: "ssl_provisioning", result, routingStatus: "active", sslStatus: "active" })).toBe("active");
  });
  it("wrong CNAME target is a DNS error", async () => {
    const { result } = await run(cnameOnly, ["outro.exemplo.com"]);
    expect(result.www).toBe("wrong");
    expect(nextV2State({ current: "ownership_verified", result, routingStatus: "not_started", sslStatus: "pending" })).toBe("dns_error");
  });
  it("missing CNAME stays pending", async () => {
    const { result } = await run(cnameOnly, []);
    expect(nextV2State({ current: "ownership_verified", result, routingStatus: "not_started", sslStatus: "pending" })).toBe("dns_pending");
  });
  it("root not_required without the www scope cannot verify", async () => {
    const { result } = await run(cnameOnly, ["domains.shopdrive.com.br"]);
    delete result.wwwOnlyHostname;
    expect(areDnsRecordsVerified(result)).toBe(false);
  });
  it("www scope must be an exact www hostname", async () => {
    const { result } = await run(cnameOnly, ["domains.shopdrive.com.br"]);
    expect(areDnsRecordsVerified({ ...result, wwwOnlyHostname: "minhaloja.com.br" })).toBe(false);
    expect(areDnsRecordsVerified({ ...result, wwwOnlyHostname: "WWW.minhaloja.com.br" })).toBe(false);
  });
  it("a published apex target keeps requiring both records", async () => {
    const { result } = await run({ ...cnameOnly, rootValue: "203.0.113.10" }, ["domains.shopdrive.com.br"]);
    expect(result.wwwOnlyHostname).toBeUndefined();
    expect(result.root).toBe("missing");
    expect(areDnsRecordsVerified(result)).toBe(false);
  });
  it("ingress not ready checks nothing", async () => {
    const { result } = await run({ ...cnameOnly, ingressReady: false }, ["domains.shopdrive.com.br"]);
    expect(result.www).toBe("not_configured");
    expect(areDnsRecordsVerified(result)).toBe(false);
  });
});

describe("sanitized Cloudflare observation", () => {
  const raw = {
    id: "0123456789abcdef0123456789abcdef", hostname: "www.minhaloja.com.br", status: "pending",
    ownership_verification: { type: "txt", name: "_cf-custom-hostname.www.minhaloja.com.br", value: "secret-ownership-value-1234" },
    verification_errors: ["custom hostname does not CNAME to this zone."],
    ssl: { status: "pending_validation", method: "http", type: "dv", txt_value: "dcv-secret-token",
      validation_records: [{ txt_value: "dcv-secret-token", http_body: "http-body-secret" }],
      validation_errors: [{ message: "token ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd failed" }] },
  };
  const obs = summarizeCustomHostnameObservation(raw, new Date("2026-11-14T00:00:00Z"));
  const text = JSON.stringify(obs);
  it("keeps statuses", () => {
    expect(obs.hostname_status).toBe("pending");
    expect(obs.ssl_status).toBe("pending_validation");
    expect(obs.ssl_method).toBe("http");
  });
  it("never keeps ids, DCV values or raw payload fields", () => {
    for (const secret of ["0123456789abcdef0123456789abcdef", "secret-ownership-value-1234", "dcv-secret-token", "http-body-secret"]) {
      expect(text).not.toContain(secret);
    }
  });
  it("redacts token-like runs in error messages", () => {
    expect(text).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd");
    expect(obs.ssl_validation_errors).toEqual(["token [redacted] failed"]);
  });
  it("rejects non-status words", () => {
    expect(summarizeCustomHostnameObservation({ status: "<script>" }).hostname_status).toBeNull();
  });
});
