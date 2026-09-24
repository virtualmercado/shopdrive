import { supabase } from "@/integrations/supabase/client";

/** Option group (attribute) with stable ids used by the variant matrix. */
export interface VariantOptionGroup {
  id: string;
  name: string;
  values: { id: string; value: string }[];
}

export interface ProductVariantRow {
  id: string;
  sku: string;
  option_value_ids: string[];
  stock_quantity: number;
  active: boolean;
}

export interface VariantLimits {
  max_groups: number;
  max_values_per_group: number;
  max_variants: number;
}

/** Fallback only; the server (get_variant_limits) is the source of truth and re-validates. */
export const DEFAULT_VARIANT_LIMITS: VariantLimits = { max_groups: 4, max_values_per_group: 30, max_variants: 200 };

let limitsCache: VariantLimits | null = null;
export async function fetchVariantLimits(): Promise<VariantLimits> {
  if (limitsCache) return limitsCache;
  const { data } = await supabase.rpc("get_variant_limits" as any);
  limitsCache = (data as unknown as VariantLimits) || DEFAULT_VARIANT_LIMITS;
  return limitsCache;
}

export const comboKey = (valueIds: string[]) => [...valueIds].sort().join("|");

/** Deterministic cartesian product following group/value order. */
export function cartesian(groups: VariantOptionGroup[]): { id: string; value: string; group: string }[][] {
  if (groups.length === 0) return [];
  return groups.reduce<{ id: string; value: string; group: string }[][]>(
    (acc, g) => {
      const next: { id: string; value: string; group: string }[][] = [];
      acc.forEach((combo) => g.values.forEach((v) => next.push([...combo, { id: v.id, value: v.value, group: g.name }])));
      return next;
    },
    [[]],
  );
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16),
      );

/**
 * Reconciles edited value strings with previous ids so renames keep the same id.
 * Unchanged strings keep their id; remaining new strings reuse ids of removed
 * strings at the same position (rename); anything else gets a new id.
 */
export function reconcileValueIds(
  prev: { id: string; value: string }[],
  nextValues: string[],
): { id: string; value: string }[] {
  const used = new Set<string>();
  const result: ({ id: string; value: string } | null)[] = nextValues.map((val) => {
    const hit = prev.find((p) => p.value === val && !used.has(p.id));
    if (hit) {
      used.add(hit.id);
      return { id: hit.id, value: val };
    }
    return null;
  });
  return result.map((r, i) => {
    if (r) return r;
    const atPos = prev[i];
    if (atPos && !used.has(atPos.id) && !nextValues.includes(atPos.value)) {
      used.add(atPos.id);
      return { id: atPos.id, value: nextValues[i] };
    }
    return { id: newId(), value: nextValues[i] };
  });
}

/** Loads the active matrix of a product (owner or public, RLS decides). */
export async function loadVariantMatrix(productId: string) {
  const [groupsRes, valuesRes, variantsRes] = await Promise.all([
    supabase.from("product_option_groups" as any).select("id, name, position").eq("product_id", productId).is("archived_at", null).order("position"),
    supabase.from("product_option_values" as any).select("id, option_group_id, value, position").eq("product_id", productId).is("archived_at", null).order("position"),
    supabase.from("product_variants" as any).select("id, sku, option_value_ids, stock_quantity, active").eq("product_id", productId).is("archived_at", null),
  ]);
  const groups: VariantOptionGroup[] = ((groupsRes.data as any[]) || []).map((g) => ({
    id: g.id,
    name: g.name,
    values: ((valuesRes.data as any[]) || [])
      .filter((v) => v.option_group_id === g.id)
      .map((v) => ({ id: v.id, value: v.value })),
  }));
  return { groups, variants: ((variantsRes.data as any[]) || []) as ProductVariantRow[] };
}
