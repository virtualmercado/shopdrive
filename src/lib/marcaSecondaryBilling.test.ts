import { describe, expect, it } from "vitest";
import { allowsIndependentStoreBilling } from "./marcaSecondaryBilling";

describe("MARCA linked-store billing", () => {
  it("does not offer independent renewal or payment on the secondary store", () => {
    expect(allowsIndependentStoreBilling("secondary")).toBe(false);
  });
  it("preserves independent billing for primary and single-store accounts", () => {
    expect(allowsIndependentStoreBilling("primary")).toBe(true);
    expect(allowsIndependentStoreBilling(null)).toBe(true);
  });
});