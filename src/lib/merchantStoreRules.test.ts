import { describe, expect, it } from "vitest";
import { delegatedMerchantRouteAllowed, isStoreUuid, parseManagedStore } from "./merchantStoreRules";

describe("selected-store boundaries", () => {
  it("requires an actual UUID, not a browser arbitrary store string", () => {
    expect(isStoreUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isStoreUuid("other-store")).toBe(false);
  });
  it("keeps non-migrated and account-control screens outside delegated administration", () => {
    expect(delegatedMerchantRouteAllowed("/lojista/products")).toBe(true);
    expect(delegatedMerchantRouteAllowed("/lojista/settings")).toBe(false);
    expect(delegatedMerchantRouteAllowed("/lojista/customers/11111111-1111-4111-8111-111111111111")).toBe(false);
    expect(delegatedMerchantRouteAllowed("/lojista/catalog-pdf")).toBe(false);
  });
  it("rejects malformed server store contexts without falling back to an account", () => {
    expect(() => parseManagedStore({ storeId: "untrusted" })).toThrow("store_context_invalid");
  });
});