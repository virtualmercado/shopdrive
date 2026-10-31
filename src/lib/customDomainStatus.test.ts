import { describe, expect, it } from "vitest";
import {
  customDomainCtaLabel, customDomainDisplayHostname, customDomainChecklist, isCustomDomainConnected, customDomainPresentation,
} from "./customDomainStatus";

const activeDomain = {
  domain: "redearoma.com.br",
  display_hostname: "www.redearoma.com.br",
  released: false,
  active: true,
  state: "active",
  ownership_verified_at: "2026-10-27T22:06:42Z",
  dns_verified_at: "2026-10-27T22:06:42Z",
  routing_status: "active",
  ssl_status: "active",
};

describe("customDomainDisplayHostname", () => {
  it("prefers the exact authorized host with www", () =>
    expect(customDomainDisplayHostname(activeDomain)).toBe("www.redearoma.com.br"));
  it("falls back to the canonical domain", () =>
    expect(customDomainDisplayHostname({ ...activeDomain, display_hostname: null })).toBe("redearoma.com.br"));
  it("returns empty without domain", () => expect(customDomainDisplayHostname(null)).toBe(""));
});

describe("customDomainCtaLabel", () => {
  it("never offers connect to a store with an active domain", () =>
    expect(customDomainCtaLabel(activeDomain)).toBe("Gerenciar domínio"));
  it("offers continue while configuration is pending", () =>
    expect(customDomainCtaLabel({ ...activeDomain, active: false, state: "dns_pending" })).toBe("Continuar configuração"));
  it("offers connect only without a domain", () => expect(customDomainCtaLabel(null)).toBe("Conectar domínio próprio"));
  it("treats a released domain as no domain", () =>
    expect(customDomainCtaLabel({ ...activeDomain, released: true })).toBe("Conectar domínio próprio"));
});

describe("customDomainChecklist", () => {
  it("marks every step done for a fully active domain", () => {
    const items = customDomainChecklist(activeDomain);
    expect(items.map((i) => i.done)).toEqual([true, true, true, true, true]);
    expect(items.some((i) => i.attention)).toBe(false);
  });
  it("never marks DNS done without server confirmation", () => {
    const items = customDomainChecklist({ ...activeDomain, dns_verified_at: null, routing_status: "not_started", ssl_status: "pending" });
    expect(items.map((i) => i.done)).toEqual([true, false, false, false, true]);
  });
  it("flags ownership as attention when pending", () => {
    const items = customDomainChecklist({ ...activeDomain, ownership_verified_at: null, dns_verified_at: null });
    expect(items[0]).toMatchObject({ done: false, attention: true });
  });
  it("flags routing only on real error", () => {
    const items = customDomainChecklist({ ...activeDomain, routing_status: "error", ssl_status: "pending" });
    expect(items[2]).toMatchObject({ done: false, attention: true });
    expect(items[3]).toMatchObject({ done: false, attention: false });
  });
});

describe("isCustomDomainConnected", () => {
  it("requires both active flag and active state", () => {
    expect(isCustomDomainConnected(activeDomain)).toBe(true);
    expect(isCustomDomainConnected({ ...activeDomain, active: false })).toBe(false);
    expect(isCustomDomainConnected({ ...activeDomain, state: "ssl_provisioning" })).toBe(false);
  });
});

describe("shared domain presentation", () => {
  it("uses exactly the backend www host for visit/copy, never the canonical root", () => {
    expect(customDomainPresentation(activeDomain).address).toBe("https://www.redearoma.com.br");
  });
  it("treats released records as absent across every consumer", () => {
    expect(customDomainPresentation({ ...activeDomain, released: true })).toMatchObject({
      domain: null, connected: false, hostname: "", address: "",
    });
  });
  it("does not infer connection from completed provisioning timestamps", () => {
    const view = customDomainPresentation({ ...activeDomain, state: "ssl_provisioning", active: false });
    expect(view.connected).toBe(false);
    expect(view.checklist.find((item) => item.key === "publication")?.done).toBe(false);
  });
});
