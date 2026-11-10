/**
 * Shipping label recipient taken from the address copy stored on the order
 * (`orders.customer_address`, written at purchase time by the checkout and by manual orders).
 *
 * Known snapshot formats:
 *  - checkout:     "Rua, 123 - Apto 4, Bairro, Cidade - UF, CEP: 00000-000"
 *  - manual order: "Rua, 123, Apto 4, Bairro, Cidade/UF, CEP: 00000000"
 *
 * Editing the customer's registration later must never change what a historical label prints,
 * so the label reads only this copy. When the copy is not usable, `planShippingLabel` decides
 * what the caller may do: pickup orders never get a delivery label, and the customer's current
 * registered address may only be printed after the merchant explicitly confirms a warning that it
 * is NOT the historical address of the order.
 */
import { DELIVERY_TO_BE_AGREED_LABEL } from "@/lib/checkoutValidation";

export interface LabelRecipient {
  full_name: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
}

export interface OrderAddressSource {
  customer_name?: string | null;
  customer_address?: string | null;
  delivery_method?: string | null;
}

const CEP_TAIL = /,?\s*CEP:?\s*([\d.\-\s]{5,12})\s*$/i;
const CITY_UF = /^(.+?)\s*(?:-|\/)\s*([A-Za-z]{2})$/;

/** Parses a stored order address. Returns null when the copy is not a complete delivery address. */
export function parseOrderAddressSnapshot(snapshot: string | null | undefined): Omit<LabelRecipient, "full_name"> | null {
  const text = (snapshot ?? "").trim();
  if (!text || text === DELIVERY_TO_BE_AGREED_LABEL) return null;

  const cepMatch = text.match(CEP_TAIL);
  if (!cepMatch || cepMatch.index === undefined) return null;
  const digits = cepMatch[1].replace(/\D/g, "");
  if (digits.length < 5) return null;
  const cep = digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;

  const segments = text.slice(0, cepMatch.index).split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  if (segments.length < 2) return null;
  const cityMatch = segments.pop()!.match(CITY_UF);
  if (!cityMatch) return null;

  const street = segments[0];
  const neighborhood = segments.length >= 2 ? segments[segments.length - 1] : undefined;
  const middle = segments.length >= 3 ? segments.slice(1, -1) : [];
  let number: string | undefined;
  const complementParts: string[] = [];
  if (middle.length) {
    const [first, ...others] = middle;
    const dash = first.indexOf(" - ");
    if (dash >= 0) {
      number = first.slice(0, dash).trim();
      complementParts.push(first.slice(dash + 3).trim());
    } else {
      number = first;
    }
    complementParts.push(...others);
  }

  return {
    street,
    number: number || undefined,
    complement: complementParts.filter(Boolean).join(", ") || undefined,
    neighborhood,
    city: cityMatch[1].trim(),
    state: cityMatch[2].toUpperCase(),
    cep,
  };
}

/**
 * Recipient printed on the shipping label, built exclusively from the order's own copy.
 * Pickup orders store the store's pickup point (not a destination), so they return null too.
 */
export function labelRecipientFromOrder(order: OrderAddressSource): LabelRecipient | null {
  if (order.delivery_method === "retirada") return null;
  const parsed = parseOrderAddressSnapshot(order.customer_address);
  if (!parsed) return null;
  return { full_name: (order.customer_name ?? "").trim(), ...parsed };
}

export const LABEL_PICKUP_MESSAGE =
  "Este pedido foi registrado como Retirada no local e não possui endereço de entrega.";
export const LABEL_NO_ADDRESS_MESSAGE = "Não há endereço de entrega suficiente para gerar esta etiqueta.";
export const LABEL_LEGACY_WARNING =
  "Este pedido antigo não possui um endereço de entrega completo gravado no histórico. O endereço exibido abaixo é o endereço atual cadastrado para este cliente. Confirme antes de imprimir a etiqueta.";
export const LABEL_TO_BE_AGREED_WARNING =
  "Este pedido foi registrado como “A combinar pelo WhatsApp” e não possui um endereço de entrega confirmado no histórico. O endereço exibido abaixo é o endereço atual cadastrado para este cliente e pode não ser o que foi combinado na época. Confirme antes de imprimir a etiqueta.";

export type ShippingLabelPlan =
  /** Print directly from the order's own copy (unchanged behaviour). */
  | { kind: "snapshot"; recipient: LabelRecipient }
  /** Pickup order: never print a delivery label. */
  | { kind: "pickup" }
  /** No historical address: current registration may be shown, only after explicit confirmation. */
  | { kind: "needs_confirmation"; reason: "to_be_agreed" | "incomplete" };

export function planShippingLabel(order: OrderAddressSource): ShippingLabelPlan {
  if (order.delivery_method === "retirada") return { kind: "pickup" };
  const recipient = labelRecipientFromOrder(order);
  if (recipient) return { kind: "snapshot", recipient };
  const toBeAgreed = (order.customer_address ?? "").trim() === DELIVERY_TO_BE_AGREED_LABEL;
  return { kind: "needs_confirmation", reason: toBeAgreed ? "to_be_agreed" : "incomplete" };
}

/** A fallback address is only printable when it identifies a real destination. */
export function isDeliverableRecipient(r: Partial<LabelRecipient> | null | undefined): r is LabelRecipient {
  if (!r) return false;
  const filled = (v?: string | null) => !!(v ?? "").trim();
  return filled(r.street) && filled(r.city) && filled(r.state) && (r.cep ?? "").replace(/\D/g, "").length === 8;
}

export function confirmationWarning(reason: "to_be_agreed" | "incomplete"): string {
  return reason === "to_be_agreed" ? LABEL_TO_BE_AGREED_WARNING : LABEL_LEGACY_WARNING;
}

/** Display lines for the confirmation dialog (same fields the label prints). */
export function recipientLines(r: LabelRecipient): string[] {
  const streetLine = [r.street, r.number].filter(Boolean).join(", ") + (r.complement ? ` - ${r.complement}` : "");
  const cityLine = [r.city, r.state].filter(Boolean).join(" - ");
  return [r.full_name, streetLine, r.neighborhood, cityLine, r.cep ? `CEP: ${r.cep}` : ""]
    .map((l) => (l ?? "").trim())
    .filter(Boolean);
}
