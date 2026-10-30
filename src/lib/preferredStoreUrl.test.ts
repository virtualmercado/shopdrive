import { describe, expect, it } from "vitest";
import { customDomainRedirectUrl, isValidCustomStoreHostname, preferredStoreUrl } from "./preferredStoreUrl";

const ORIGIN = "https://shopdrive.com.br";
const SLUG = "aromadaamazoniarevenda";
const HOST = "www.redearoma.com.br";

describe("isValidCustomStoreHostname", () => {
  it("accepts real hostnames", () => {
    expect(isValidCustomStoreHostname(HOST)).toBe(true);
    expect(isValidCustomStoreHostname("loja.exemplo.com")).toBe(true);
  });
  it("rejects non-hostnames and non-strings", () => {
    expect(isValidCustomStoreHostname(null)).toBe(false);
    expect(isValidCustomStoreHostname(undefined)).toBe(false);
    expect(isValidCustomStoreHostname("")).toBe(false);
    expect(isValidCustomStoreHostname("localhost")).toBe(false);
    expect(isValidCustomStoreHostname("https://evil.com")).toBe(false);
    expect(isValidCustomStoreHostname("evil.com/path")).toBe(false);
    expect(isValidCustomStoreHostname("EVIL.com")).toBe(false);
  });
});

describe("preferredStoreUrl", () => {
  it("uses the active custom domain when present", () => {
    expect(preferredStoreUrl(ORIGIN, SLUG, HOST)).toBe(`https://${HOST}`);
  });
  it("falls back to the traditional ShopDrive URL", () => {
    expect(preferredStoreUrl(ORIGIN, SLUG, null)).toBe(`${ORIGIN}/${SLUG}`);
    expect(preferredStoreUrl(ORIGIN, SLUG, undefined)).toBe(`${ORIGIN}/${SLUG}`);
    expect(preferredStoreUrl(ORIGIN, SLUG, "not a host")).toBe(`${ORIGIN}/${SLUG}`);
  });
});

describe("customDomainRedirectUrl", () => {
  it("redirects the store root to the custom domain root", () => {
    expect(customDomainRedirectUrl(HOST, SLUG, `/${SLUG}`)).toBe(`https://${HOST}/`);
  });
  it("preserves sub-path, query string and hash", () => {
    expect(customDomainRedirectUrl(HOST, SLUG, `/${SLUG}/produto/123`, "?x=1"))
      .toBe(`https://${HOST}/produto/123?x=1`);
    expect(customDomainRedirectUrl(HOST, SLUG, `/${SLUG}/categoria/abc`, "?q=óleo", "#topo"))
      .toBe(`https://${HOST}/categoria/abc?q=óleo#topo`);
    expect(customDomainRedirectUrl(HOST, SLUG, `/${SLUG}/checkout`)).toBe(`https://${HOST}/checkout`);
    expect(customDomainRedirectUrl(HOST, SLUG, `/${SLUG}/conta`)).toBe(`https://${HOST}/conta`);
    expect(customDomainRedirectUrl(HOST, SLUG, `/${SLUG}/auth`)).toBe(`https://${HOST}/auth`);
    expect(customDomainRedirectUrl(HOST, SLUG, `/${SLUG}/buscar`)).toBe(`https://${HOST}/buscar`);
  });
  it("fails closed when the path does not belong to the store slug", () => {
    expect(customDomainRedirectUrl(HOST, SLUG, "/outra-loja")).toBeNull();
    expect(customDomainRedirectUrl(HOST, SLUG, `/${SLUG}x/produto/1`)).toBeNull();
    expect(customDomainRedirectUrl(HOST, SLUG, "/")).toBeNull();
  });
  it("fails closed on invalid or ambiguous hostnames", () => {
    expect(customDomainRedirectUrl(null, SLUG, `/${SLUG}`)).toBeNull();
    expect(customDomainRedirectUrl("evil.com/@x", SLUG, `/${SLUG}`)).toBeNull();
    expect(customDomainRedirectUrl(42, SLUG, `/${SLUG}`)).toBeNull();
  });
  it("never builds protocol-relative or control-character targets", () => {
    expect(customDomainRedirectUrl(HOST, SLUG, `/${SLUG}` , "?a=b\tc")).toBe(`https://${HOST}/`);
  });
});
