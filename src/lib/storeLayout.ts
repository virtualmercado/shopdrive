/**
 * Central, pure normalization of the store layout value.
 *
 * Historical/legacy values written by the landing-page onboarding
 * ("modelo-1", "modelo-2", "modelo-3") must be mapped to the canonical
 * layout keys consumed by the public store components.
 *
 * Any unknown, empty, null or undefined value falls back to "layout_01".
 * This function never throws, never mutates its argument, performs no I/O
 * and is fully deterministic.
 */

export type StoreLayoutType = "layout_01" | "layout_02" | "layout_03";

export const CANONICAL_STORE_LAYOUTS: readonly StoreLayoutType[] = [
  "layout_01",
  "layout_02",
  "layout_03",
] as const;

export const DEFAULT_STORE_LAYOUT: StoreLayoutType = "layout_01";

const STORE_LAYOUT_ALIASES = {
  "modelo-1": "layout_01",
  "modelo-2": "layout_02",
  "modelo-3": "layout_03",
  layout_01: "layout_01",
  layout_02: "layout_02",
  layout_03: "layout_03",
} as const satisfies Record<string, StoreLayoutType>;

export function normalizeStoreLayout(value: unknown): StoreLayoutType {
  if (typeof value !== "string") return DEFAULT_STORE_LAYOUT;
  const key = value.trim() as keyof typeof STORE_LAYOUT_ALIASES;
  return STORE_LAYOUT_ALIASES[key] ?? DEFAULT_STORE_LAYOUT;
}

/** True when the value is already a canonical layout key. */
export function isCanonicalStoreLayout(value: unknown): value is StoreLayoutType {
  return typeof value === "string" && CANONICAL_STORE_LAYOUTS.includes(value as StoreLayoutType);
}
