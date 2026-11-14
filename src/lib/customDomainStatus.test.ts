import { describe, expect, it } from "vitest";
import {
  customDomainCtaLabel, customDomainDisplayHostname, customDomainChecklist, isCustomDomainConnected, customDomainPresentation, customDomainCardView,
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

describe("customDomainCardView (merchant card states map only server states)", () => {
  const ov = (domain: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({ available: true, domain, ...extra });
  it("Free/Pro (plan reason) shows the upgrade state", () => {
    const v = customDomainCardView({ available: false, unavailable_reason: "plan", domain: null });
    expect(v).toMatchObject({ kind: "upgrade", step: null, title: "Use o endereço da sua própria marca" });
  });
  it("individual block never shows setup", () =>
    expect(customDomainCardView({ available: false, unavailable_reason: "blocked", domain: null }).kind).toBe("blocked"));
  it("unavailable wins even when a domain record exists", () =>
    expect(customDomainCardView({ available: false, unavailable_reason: "feature", domain: activeDomain }).kind).toBe("unavailable"));
  it("load error is reported before anything else", () =>
    expect(customDomainCardView(ov(activeDomain), new Error("x")).kind).toBe("load_error"));
  it("eligible store without domain starts at step 1", () =>
    expect(customDomainCardView(ov(null))).toMatchObject({ kind: "empty", step: 1, title: "Conecte seu domínio próprio" }));
  it("DNS pending is step 2 setup", () =>
    expect(customDomainCardView(ov({ ...activeDomain, active: false, state: "dns_pending" }))).toMatchObject({ kind: "setup", step: 2 }));
  it("DNS verified is step 3 and never connected", () =>
    expect(customDomainCardView(ov({ ...activeDomain, active: false, state: "dns_verified" }))).toMatchObject({ kind: "processing", step: 3, title: "DNS verificado", automatic: false }));
  it("SSL provisioning waits for the certificate automatically", () =>
    expect(customDomainCardView(ov({ ...activeDomain, active: false, state: "ssl_provisioning" }))).toMatchObject({ kind: "processing", step: 3, title: "Aguardando certificado de segurança", automatic: true }));
  it("routing provisioning reads as configuring the domain", () =>
    expect(customDomainCardView(ov({ ...activeDomain, active: false, state: "routing_provisioning" })).title).toBe("Configurando domínio"));
  it("server errors map to the human attention state", () => {
    const v = customDomainCardView(ov({ ...activeDomain, active: false, state: "dns_error" }));
    expect(v).toMatchObject({ kind: "attention", step: 2, title: "Não conseguimos confirmar a configuração do domínio." });
    expect(customDomainCardView(ov({ ...activeDomain, active: false, state: "ssl_error" })).step).toBe(3);
  });
  it("active domain is connected at step 4", () =>
    expect(customDomainCardView(ov(activeDomain))).toMatchObject({ kind: "connected", step: 4 }));
  it("only the server flag marks a connected domain as managed by ShopDrive", () => {
    expect(customDomainCardView(ov({ ...activeDomain, managed_by_platform: true })).kind).toBe("managed");
    expect(customDomainCardView(ov({ ...activeDomain, managed_by_platform: "true" })).kind).toBe("connected");
  });
});
