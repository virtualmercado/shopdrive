import { describe, expect, it } from "vitest";
import {
  buildCustomHostnameCreatePayload,
  classifyDeleteStatus,
  classifyHostnameConflict,
  computeBackoffMinutes,
  decideCreateAction,
  externalHostnameForDomain,
  isSyncableDomain,
  mapCloudflareStatuses,
  normalizeIngressHostname,
  sanitizeCloudflareError,
} from "../../supabase/functions/_shared/customDomainProvisioning";
import { nextV2State, type VerificationResult } from "../../supabase/functions/_shared/customDomainCore";

const dnsOk: VerificationResult = {
  checkedAt: new Date().toISOString(),
  ownership: "already_verified",
  nameservers: [],
  provider: null,
  root: "not_required",
  www: "ok",
  observed: { txt: 0, root: [], www: ["domains.shopdrive.com.br"] },
  notes: [],
  pilotHostname: "www.loja.com.br",
};

describe("ingress hostname normalization", () => {
  it.each([
    ["WWW.Loja.com.br", "www.loja.com.br"],
    ["www.loja.com.br.", "www.loja.com.br"],
    ["www.loja.com.br:443", "www.loja.com.br"],
    ["  www.loja.com.br ", "www.loja.com.br"],
  ])("%s → %s", (i, o) => expect(normalizeIngressHostname(i)).toBe(o));
  it.each(["", "  ", "loja", "-bad.com", "loja .com", "a".repeat(254)])(
    "rejects %j", (i) => expect(normalizeIngressHostname(i)).toBeNull());
});

describe("external hostname is always www.<canonical>", () => {
  it("prefixes www", () => expect(externalHostnameForDomain("loja.com.br")).toBe("www.loja.com.br"));
  it("rejects invalid canonical", () => expect(externalHostnameForDomain("bad host")).toBeNull());
});

describe("create payload", () => {
  it("uses http DCV, DV and TLS 1.2 minimum", () => {
    expect(buildCustomHostnameCreatePayload("www.loja.com.br")).toEqual({
      hostname: "www.loja.com.br",
      ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
    });
  });
});

describe("idempotent create", () => {
  it("creates only without external id", () => expect(decideCreateAction(null)).toBe("create"));
  it("reconciles when external id exists", () => expect(decideCreateAction("cf-123")).toBe("reconcile"));
});

describe("external hostname conflict", () => {
  const existing = [{ id: "cf-1", hostname: "www.loja.com.br" }];
  it("reconciles the known binding", () =>
    expect(classifyHostnameConflict(existing, "www.loja.com.br", "cf-1")).toEqual({ kind: "reconcile", id: "cf-1" }));
  it("stops on an unknown external object", () =>
    expect(classifyHostnameConflict(existing, "www.loja.com.br", null)).toEqual({ kind: "conflict_unknown" }));
  it("stops when the id differs", () =>
    expect(classifyHostnameConflict(existing, "www.loja.com.br", "cf-other")).toEqual({ kind: "conflict_unknown" }));
  it("not_found when nothing matches", () =>
    expect(classifyHostnameConflict([], "www.loja.com.br", null)).toEqual({ kind: "not_found" }));
});

describe("delete classification", () => {
  it("200 is removed", () => expect(classifyDeleteStatus(200)).toBe("removed"));
  it("404 is treated as already removed", () => expect(classifyDeleteStatus(404)).toBe("removed"));
  it("429/5xx retry later", () => {
    expect(classifyDeleteStatus(429)).toBe("retry");
    expect(classifyDeleteStatus(503)).toBe("retry");
  });
  it("other 4xx fails", () => expect(classifyDeleteStatus(400)).toBe("failed"));
});

describe("status mapping and state machine", () => {
  const state = (h: string, s: string) => {
    const m = mapCloudflareStatuses(h, s);
    return nextV2State({ current: "dns_verified", result: dnsOk, routingStatus: m.routingStatus, sslStatus: m.sslStatus });
  };
  it("hostname active + ssl active → active", () => expect(state("active", "active")).toBe("active"));
  it("hostname active + ssl pending → NOT active", () => expect(state("active", "pending")).toBe("ssl_provisioning"));
  it("hostname pending → routing_provisioning", () => expect(state("pending", "pending")).toBe("routing_provisioning"));
  it("deleted externally → routing_error", () => expect(state("deleted", "pending")).toBe("routing_error"));
});

describe("backoff", () => {
  it("grows exponentially from 5 minutes", () => {
    expect(computeBackoffMinutes(1)).toBe(5);
    expect(computeBackoffMinutes(2)).toBe(10);
    expect(computeBackoffMinutes(3)).toBe(20);
  });
  it("caps at 6 hours", () => expect(computeBackoffMinutes(20)).toBe(360));
});

describe("error sanitization", () => {
  it("keeps status and short message", () =>
    expect(sanitizeCloudflareError(400, { errors: [{ message: "hostname invalid" }] })).toBe("cf_400:hostname invalid"));
  it("redacts token-like runs", () =>
    expect(sanitizeCloudflareError(401, { errors: [{ message: "bad token AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcd" }] }))
      .toBe("cf_401:bad token [redacted]"));
  it("handles missing body", () => expect(sanitizeCloudflareError(500, null)).toBe("cf_500:cloudflare_error"));
  it("truncates long messages", () =>
    expect(sanitizeCloudflareError(400, { errors: [{ message: "x".repeat(500) }] }).length).toBeLessThanOrEqual(186));
});

describe("sync eligibility", () => {
  it("touches only provisioning/removing states", () => {
    expect(isSyncableDomain({ v2_state: "routing_provisioning", routing_status: "provisioning", released_at: null })).toBe(true);
    expect(isSyncableDomain({ v2_state: "ssl_provisioning", routing_status: "active", released_at: null })).toBe(true);
    expect(isSyncableDomain({ v2_state: "inactive", routing_status: "removing", released_at: null })).toBe(true);
  });
  it("never polls active or released domains", () => {
    expect(isSyncableDomain({ v2_state: "active", routing_status: "active", released_at: null })).toBe(false);
    expect(isSyncableDomain({ v2_state: "routing_provisioning", routing_status: "provisioning", released_at: "2026-01-01" })).toBe(false);
  });
});
