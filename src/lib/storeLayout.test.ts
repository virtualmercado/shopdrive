import { describe, it, expect } from "vitest";
import {
  normalizeStoreLayout,
  isCanonicalStoreLayout,
  DEFAULT_STORE_LAYOUT,
} from "./storeLayout";

describe("normalizeStoreLayout", () => {
  it("maps legacy onboarding values preserving the merchant's choice", () => {
    expect(normalizeStoreLayout("modelo-1")).toBe("layout_01");
    expect(normalizeStoreLayout("modelo-2")).toBe("layout_02");
    expect(normalizeStoreLayout("modelo-3")).toBe("layout_03");
  });

  it("keeps canonical values untouched", () => {
    expect(normalizeStoreLayout("layout_01")).toBe("layout_01");
    expect(normalizeStoreLayout("layout_02")).toBe("layout_02");
    expect(normalizeStoreLayout("layout_03")).toBe("layout_03");
  });

  it("falls back safely for empty/unknown values", () => {
    expect(normalizeStoreLayout(null)).toBe("layout_01");
    expect(normalizeStoreLayout(undefined)).toBe("layout_01");
    expect(normalizeStoreLayout("")).toBe("layout_01");
    expect(normalizeStoreLayout("   ")).toBe("layout_01");
    expect(normalizeStoreLayout("qualquer-valor")).toBe("layout_01");
    expect(normalizeStoreLayout(42)).toBe("layout_01");
    expect(normalizeStoreLayout({})).toBe("layout_01");
  });

  it("is case sensitive by design: LAYOUT_01 is unknown -> fallback", () => {
    // Documented behaviour: we do NOT lowercase arbitrary input, since the
    // canonical values stored by the platform are always lowercase.
    expect(normalizeStoreLayout("LAYOUT_01")).toBe("layout_01");
    expect(normalizeStoreLayout("MODELO-2")).toBe(DEFAULT_STORE_LAYOUT);
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeStoreLayout(" layout_02 ")).toBe("layout_02");
    expect(normalizeStoreLayout("\tmodelo-3\n")).toBe("layout_03");
  });

  it("never throws and is deterministic", () => {
    const inputs: unknown[] = [null, undefined, "", "x", "modelo-1", "layout_03", [], () => {}];
    for (const input of inputs) {
      expect(() => normalizeStoreLayout(input)).not.toThrow();
      expect(normalizeStoreLayout(input)).toBe(normalizeStoreLayout(input));
      expect(isCanonicalStoreLayout(normalizeStoreLayout(input))).toBe(true);
    }
  });

  it("does not mutate the received argument", () => {
    const obj = { store_layout: "modelo-2" };
    normalizeStoreLayout(obj.store_layout);
    expect(obj).toEqual({ store_layout: "modelo-2" });
  });
});
