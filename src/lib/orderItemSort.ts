/**
 * Single presentation rule for order items (view, edit, A4 PDF and thermal print).
 *
 * Only orders with `order_format_version >= 2` are sorted here. Legacy orders are returned
 * exactly as their caller fetched them, so each legacy screen keeps its original behaviour.
 * Sorting never merges, removes or changes items: it only returns a new array order.
 */
export type OrderItemSortMode = "insertion" | "product" | "code";

export const DEFAULT_ORDER_ITEM_SORT_MODE: OrderItemSortMode = "insertion";

export const ORDER_ITEM_SORT_OPTIONS: { value: OrderItemSortMode; label: string }[] = [
  { value: "insertion", label: "Inserção" },
  { value: "product", label: "Produto" },
  { value: "code", label: "Código" },
];

export const ORDER_ITEM_SORT_LABEL = "Ordenar itens por";

export interface SortableOrderItem {
  product_id?: string | null;
  product_name?: string | null;
  variant_sku?: string | null;
  variations?: unknown;
  item_position?: number | null;
}

export const isOrderItemSortMode = (value: unknown): value is OrderItemSortMode =>
  value === "insertion" || value === "product" || value === "code";

/** Orders created after the positioning rollout (server sets the version on insert). */
export const isPositionedOrder = (order: { order_format_version?: number | null } | null | undefined): boolean =>
  Number(order?.order_format_version ?? 0) >= 2;

/** Same text the PDF prints for a variation ("Cor: Azul • Tamanho: M"). */
export const orderItemVariationText = (variations: unknown): string =>
  variations && typeof variations === "object" && !Array.isArray(variations)
    ? Object.entries(variations as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" • ")
    : "";

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Locale-aware compare with a strict code-unit tie-break, so the result is always total. */
const compareText = (a: string, b: string): number => {
  const c = collator.compare(a, b);
  if (c !== 0) return c;
  return a < b ? -1 : a > b ? 1 : 0;
};

const text = (v: unknown) => String(v ?? "").trim();

/** "CÓD: 2446" / "COD 0760" / "Código: X-1" written inside the name frozen on the item. */
const NAME_CODE = /(?<![\p{L}\p{N}])C[ÓóOo][Dd](?:[Ii][Gg][Oo])?(?:\.?\s*:\s*|\.\s*|\s+)([0-9A-Za-z._/-]*[0-9][0-9A-Za-z._/-]*)/gu;

/** Code from the frozen name (last occurrence), never from the current catalog. */
export const frozenNameCode = (name: unknown): string => {
  const matches = [...text(name).matchAll(NAME_CODE)];
  return matches.length ? matches[matches.length - 1][1] : "";
};

/** Frozen code: the variation SKU stored on the item, else the code inside the frozen name. */
const frozenCode = (item: SortableOrderItem) => text(item.variant_sku) || frozenNameCode(item.product_name);

/** Product-base identity frozen on the item: product_id, else the code in the frozen name, else the frozen name. */
const productGroupKey = (item: SortableOrderItem) => {
  const pid = text(item.product_id);
  if (pid) return `p:${pid}`;
  const code = frozenNameCode(item.product_name);
  return code ? `c:${code.toLocaleLowerCase("pt-BR")}` : `n:${text(item.product_name).toLocaleLowerCase("pt-BR")}`;
};

interface Entry<T> {
  item: T;
  index: number;
  position: number;
}

const byPosition = <T>(a: Entry<T>, b: Entry<T>) =>
  a.position !== b.position ? a.position - b.position : a.index - b.index;

/**
 * Deterministic order for format-2 items.
 * - insertion: item_position ASC.
 * - product: groups by product base (alphabetical by frozen name), variations by text, then position.
 * - code: frozen code ASC (variant SKU, else the code inside the frozen name; items without code last),
 *   then name, variation, position.
 * Items without a position yet (new lines while editing) follow the positioned ones in their current order.
 */
export const sortOrderItems = <T extends SortableOrderItem>(items: readonly T[], mode: OrderItemSortMode): T[] => {
  const entries: Entry<T>[] = items.map((item, index) => {
    const pos = Number(item.item_position);
    return { item, index, position: Number.isFinite(pos) && pos >= 1 ? pos : Number.MAX_SAFE_INTEGER };
  });

  if (mode === "product") {
    const groupName = new Map<string, Entry<T>>();
    for (const e of [...entries].sort(byPosition)) {
      const key = productGroupKey(e.item);
      if (!groupName.has(key)) groupName.set(key, e);
    }
    return entries
      .sort((a, b) => {
        const ka = productGroupKey(a.item);
        const kb = productGroupKey(b.item);
        if (ka !== kb) {
          const na = text(groupName.get(ka)?.item.product_name);
          const nb = text(groupName.get(kb)?.item.product_name);
          return compareText(na, nb) || compareText(ka, kb);
        }
        return (
          compareText(orderItemVariationText(a.item.variations), orderItemVariationText(b.item.variations)) ||
          byPosition(a, b)
        );
      })
      .map((e) => e.item);
  }

  if (mode === "code") {
    return entries
      .sort((a, b) => {
        const ca = frozenCode(a.item);
        const cb = frozenCode(b.item);
        if (!ca !== !cb) return ca ? -1 : 1;
        return (
          compareText(ca, cb) ||
          compareText(text(a.item.product_name), text(b.item.product_name)) ||
          compareText(orderItemVariationText(a.item.variations), orderItemVariationText(b.item.variations)) ||
          byPosition(a, b)
        );
      })
      .map((e) => e.item);
  }

  return entries.sort(byPosition).map((e) => e.item);
};

/**
 * Items as they must be presented for this order. Legacy orders: unchanged input order
 * (whatever the legacy screen already did). Format-2 orders: the shared deterministic rule.
 */
export const presentOrderItems = <T extends SortableOrderItem>(
  order: { order_format_version?: number | null } | null | undefined,
  items: readonly T[] | null | undefined,
  mode: OrderItemSortMode = DEFAULT_ORDER_ITEM_SORT_MODE,
): T[] => {
  const list = items ? [...items] : [];
  return isPositionedOrder(order) ? sortOrderItems(list, isOrderItemSortMode(mode) ? mode : DEFAULT_ORDER_ITEM_SORT_MODE) : list;
};
