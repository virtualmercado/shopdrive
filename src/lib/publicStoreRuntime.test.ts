import { describe, expect, it, vi } from "vitest";
import { adaptStoreInternalLink, buildStorePath, effectiveStoreSlug, initialStoreRuntime, isPlatformHost, isTrustedLovablePreviewHost, resolveStoreRuntime, storeAuthRedirect, storeContentPath } from "./publicStoreRuntime";

const STORE_A = "11111111-1111-4111-8111-111111111111";
const STORE_B = "22222222-2222-4222-8222-222222222222";
const platform = { mode: "platform" as const, hostname: "shopdrive.com.br", storeSlug: "loja-a" };
const custom = { mode: "custom-domain" as const, hostname: "loja-piloto.exemplo", storeId: STORE_A, storeSlug: "loja-a" };

describe("explicit platform hosts", () => {
  it.each(["shopdrive.com.br", "www.shopdrive.com.br", "virtualmercado.lovable.app", "id-preview--9f6c1d8d-8e82-428c-a496-b3fa1dba56be.lovable.app", "localhost", "127.0.0.1", "[::1]"])("accepts verified %s", (host) => expect(isPlatformHost(host)).toBe(true));
  it.each(["loja-piloto.exemplo", "evil.lovable.app", "shopdrive.com.br.evil.com", "other.shopdrive.com.br", "shopdrive.com.br:8080", "https://shopdrive.com.br"])("does not authorize %s", (host) => expect(isPlatformHost(host)).toBe(false));
  it("normalizes case and a trailing DNS dot without stripping www", () => {
    expect(initialStoreRuntime("WWW.SHOPDRIVE.COM.BR.").hostname).toBe("www.shopdrive.com.br");
    expect(initialStoreRuntime("WWW.LOJA.EXEMPLO.").hostname).toBe("www.loja.exemplo");
  });
  it("platform slug never calls domain resolution", async () => {
    const resolver = vi.fn();
    expect(await resolveStoreRuntime("shopdrive.com.br", resolver)).toEqual({ mode: "platform", hostname: "shopdrive.com.br" });
    expect(resolver).not.toHaveBeenCalled();
  });
});

describe("strict official preview infrastructure", () => {
  const runtimeHost = "9f6c1d8d-8e82-428c-a496-b3fa1dba56be.lovableproject.com";
  it.each([
    runtimeHost,
    "id-preview--9f6c1d8d-8e82-428c-a496-b3fa1dba56be.lovable.app",
    "id-preview--11111111-1111-4111-8111-111111111111.lovable.app",
    "ID-PREVIEW--22222222-2222-4222-8222-222222222222.LOVABLE.APP.",
    runtimeHost.toUpperCase() + ".",
  ])("recognizes %s without calling the domain resolver", async (hostname) => {
    const resolver = vi.fn();
    expect(isTrustedLovablePreviewHost(hostname)).toBe(true);
    expect(initialStoreRuntime(hostname).mode).toBe("platform");
    expect((await resolveStoreRuntime(hostname, resolver)).mode).toBe("platform");
    expect(resolver).not.toHaveBeenCalled();
  });
  it.each([
    "dominio-externo-desconhecido.com", "evil.lovable.app", "preview--11111111-1111-4111-8111-111111111111.lovable.app",
    "id-preview--arbitrary.lovable.app", "id-preview--11111111111141118111111111111111.lovable.app",
    "id-preview--11111111-1111-0111-8111-111111111111.lovable.app",
    "id-preview--11111111-1111-4111-7111-111111111111.lovable.app",
    "id-preview--gggggggg-1111-4111-8111-111111111111.lovable.app",
    "id-preview--11111111-1111-4111-8111-111111111111.lovable.app.evil.com",
    "sub.id-preview--11111111-1111-4111-8111-111111111111.lovable.app",
    "id-preview--11111111-1111-4111-8111-111111111111.lovable.app:8080",
    "id-preview--11111111-1111-4111-8111-111111111111.lovable.app/loja-a",
    "id-preview--11111111-1111-4111-8111-111111111111.lovable.app?preview=true",
    "id-preview--11111111-1111-4111-8111-111111111111.lovable.app#preview",
    "https://id-preview--11111111-1111-4111-8111-111111111111.lovable.app",
    " id-preview--11111111-1111-4111-8111-111111111111.lovable.app",
    "id-preview--11111111-1111-4111-8111-111111111111.lovable.app..",
    "11111111-1111-4111-8111-111111111111.lovableproject.com",
    runtimeHost + ".evil.com", "sub." + runtimeHost, runtimeHost + ":8080", runtimeHost + "/loja-a",
  ])("does not trust lookalike or unknown host %s", (hostname) => {
    expect(isTrustedLovablePreviewHost(hostname)).toBe(false);
    expect(isPlatformHost(hostname)).toBe(false);
  });
  it("unknown hostname cannot acquire platform identity from slug or stored search tenant", async () => {
    const hostname = "dominio-externo-desconhecido.com";
    const resolver = vi.fn(async () => ({ data: [], error: null }));
    const identity = await resolveStoreRuntime(hostname, resolver);
    expect(identity).toEqual({ hostname, mode: "custom-domain-not-found" });
    expect(effectiveStoreSlug(identity, "loja-a", "loja-a")).toBeUndefined();
    expect(buildStorePath(identity, "/loja-a?preview=true")).toBe("#");
    expect(resolver).toHaveBeenCalledWith(hostname);
  });
});

describe("server-only tenant resolution, fail closed", () => {
  it("resolves exactly STORE_A from loja-piloto.exemplo", async () => {
    const resolver = vi.fn(async () => ({ data: [{ store_id: STORE_A, store_slug: "loja-a" }], error: null }));
    expect(await resolveStoreRuntime("LOJA-PILOTO.EXEMPLO.", resolver)).toEqual(custom);
    expect(resolver).toHaveBeenCalledWith("loja-piloto.exemplo");
  });
  it("zero rows means unavailable, not platform", async () => {
    expect((await resolveStoreRuntime("loja-piloto.exemplo", async () => ({ data: [], error: null }))).mode).toBe("custom-domain-not-found");
  });
  it.each([null, {}, [{ store_id: STORE_A }], [{ store_id: "STORE_A", store_slug: "loja-a" }], [{ store_id: STORE_A, store_slug: "../loja-b" }], [{ store_id: STORE_A, store_slug: "checkout" }], [{ store_id: STORE_A, store_slug: "loja-a" }, { store_id: STORE_B, store_slug: "loja-b" }]])("rejects malformed or ambiguous response %j", async (data) => {
    const result = await resolveStoreRuntime("loja-piloto.exemplo", async () => ({ data, error: null }));
    expect(result).toEqual({ hostname: "loja-piloto.exemplo", mode: "custom-domain-error" });
  });
  it("RPC error cannot fall back to cached rows", async () => {
    const result = await resolveStoreRuntime("loja-piloto.exemplo", async () => ({ data: [{ store_id: STORE_A, store_slug: "loja-a" }], error: new Error("private detail") }));
    expect(result).toEqual({ hostname: "loja-piloto.exemplo", mode: "custom-domain-error" });
  });
  it("thrown RPC error is sanitized", async () => {
    expect(await resolveStoreRuntime("loja-piloto.exemplo", async () => { throw new Error("private detail"); })).toEqual({ hostname: "loja-piloto.exemplo", mode: "custom-domain-error" });
  });
  it("hostname A result is not reused for hostname B", async () => {
    const resolver = vi.fn(async (hostname: string) => ({ data: hostname === "loja-a.exemplo" ? [{ store_id: STORE_A, store_slug: "loja-a" }] : [], error: null }));
    expect((await resolveStoreRuntime("loja-a.exemplo", resolver)).storeId).toBe(STORE_A);
    expect(await resolveStoreRuntime("loja-b.exemplo", resolver)).toEqual({ hostname: "loja-b.exemplo", mode: "custom-domain-not-found" });
    expect(resolver).toHaveBeenCalledTimes(2);
  });
  it("external slug ignores path and old search storage", () => expect(effectiveStoreSlug(custom, "loja-b", "loja-b")).toBe("loja-a"));
  it("external pending identity never uses legacy slug", () => expect(effectiveStoreSlug(initialStoreRuntime("loja-piloto.exemplo"), "loja-b", "loja-b")).toBeUndefined());
  it("platform retains route slug and legacy search fallback", () => {
    expect(effectiveStoreSlug(platform, "loja-b", "loja-c")).toBe("loja-b");
    expect(effectiveStoreSlug(platform, undefined, "loja-c")).toBe("loja-c");
  });
});

describe("store URL compatibility", () => {
  it.each(["/", "/produtos", "/categoria/C", "/promocoes", "/marca/M", "/produto/P", "/checkout", "/pedido-confirmado/O", "/auth", "/conta", "/sobre-nos", "/trocas-e-devolucoes"])("platform %s preserves slug", (path) => expect(buildStorePath(platform, path)).toBe(`/loja-a${path === "/" ? "" : path}`));
  it.each(["/", "/produtos", "/categoria/C", "/promocoes", "/marca/M", "/produto/P", "/checkout", "/pedido-confirmado/O", "/auth", "/conta", "/sobre-nos", "/trocas-e-devolucoes", "/buscar?q=x"])("custom %s is slugless", (path) => expect(buildStorePath(custom, path)).toBe(path));
  it("platform search stays root-based", () => expect(buildStorePath(platform, "/buscar?q=x")).toBe("/buscar?q=x"));
  it.each(["https://wa.me/551111111111", "https://www.google.com/maps/search/?api=1", "https://www.mercadopago.com.br", "https://checkout.infinitepay.io", "//external.exemplo/x"])("keeps deliberate external URL %s", (url) => {
    expect(buildStorePath(custom, url)).toBe(url);
    expect(adaptStoreInternalLink(custom, url)).toBe(url);
  });
  it("adapts own relative banner CTA without renaming other-store URL", () => {
    expect(adaptStoreInternalLink(custom, "/loja-a/produto/P?x=1")).toBe("/produto/P?x=1");
    expect(adaptStoreInternalLink(custom, "/loja-b/produto/P")).toBe("/loja-b/produto/P");
    expect(adaptStoreInternalLink(platform, "/loja-a/produto/P")).toBe("/loja-a/produto/P");
  });
  it("custom auth preserves only storefront intents", () => {
    expect(storeAuthRedirect(custom, "/conta?tab=pedidos&pedido=O")).toBe("/conta?tab=pedidos&pedido=O");
    for (const path of ["/loja-b/conta", "https://evil.exemplo", "//evil.exemplo", "/\\evil.exemplo", "/gestor", "/produto/%2f%2fevil.exemplo"]) expect(storeAuthRedirect(custom, path)).toBe("/conta");
  });
  it("preserves encoded single-segment internal categories", () => {
    expect(storeAuthRedirect(custom, "/categoria/caf%C3%A9")).toBe("/categoria/caf%C3%A9");
    expect(adaptStoreInternalLink(custom, "/loja-a/categoria/caf%C3%A9")).toBe("/categoria/caf%C3%A9");
  });
  it.each(["%2F", "%5C", "%00", "%252F", "%invalid", ".."])("rejects unsafe encoded segment %s", (segment) => {
    expect(storeAuthRedirect(custom, `/produto/${segment}`)).toBe("/conta");
  });
  it("keeps home CTA query and fragment in custom mode", () => {
    expect(adaptStoreInternalLink(custom, "/loja-a?src=banner")).toBe("/?src=banner");
    expect(adaptStoreInternalLink(custom, "/loja-a#ofertas")).toBe("/#ofertas");
  });
  it("content CTAs use real custom pages without changing legacy platform destinations", () => {
    expect(storeContentPath(custom, "sobre")).toBe("/sobre-nos");
    expect(storeContentPath(custom, "trocas")).toBe("/trocas-e-devolucoes");
    expect(storeContentPath(platform, "sobre")).toBe("/loja-a/sobre");
    expect(storeContentPath(platform, "trocas")).toBe("/loja-a/trocas");
  });
  it("platform auth retains same-store intent", () => {
    expect(storeAuthRedirect(platform, "/loja-a/conta?tab=pedidos")).toBe("/loja-a/conta?tab=pedidos");
    expect(storeAuthRedirect(platform, "/loja-b/conta")).toBe("/loja-a/conta");
  });
});