import { supabase } from "@/integrations/supabase/client";

/** Server projection of a contracted, delinquent subscription. The browser never sends plan, cycle or amount. */
export type SubscriptionRegularization = {
  state: "none" | "payable";
  plan_id?: "pro" | "premium" | "marca";
  plan_name?: string;
  billing_cycle?: "monthly" | "annual";
  amount?: number;
  currency?: string;
  payment_method?: "pix";
  temporarily_limited?: boolean;
  open?: { regularization_id: string; pix_qr_code?: string | null; pix_qr_code_base64?: string | null; pix_expires_at?: string | null } | null;
  last?: { regularization_id: string; status: string; plan_id: string; applied_at?: string | null } | null;
};

export const REGULARIZATION_PATH = "/gestor/checkout-assinatura?flow=regularizar";

export async function fetchMyRegularization(): Promise<SubscriptionRegularization> {
  const { data, error } = await (supabase.rpc as any)("get_my_subscription_regularization");
  // A lookup error never means "nothing to pay": the page shows the retry state instead.
  if (error || !data) throw new Error("regularization_lookup_failed");
  return data as SubscriptionRegularization;
}

/**
 * Billing banner target. A downgraded subscription stores "gratis" as its current plan and MARCA has its own
 * checkout: both go to the regularization of the same subscription. Other plans keep the existing invoice flow.
 */
export function billingCtaPath(planId: string | null | undefined, billingCycle: string | null | undefined): string {
  const plan = (planId || "").toLowerCase();
  if (!plan || plan === "gratis" || plan === "free" || plan === "marca") return REGULARIZATION_PATH;
  const cycle = billingCycle === "annual" ? "anual" : "mensal";
  return `/gestor/checkout-assinatura?plano=${plan}&ciclo=${cycle}&origem=regularizar&flow=pay_invoice`;
}

/** Checkout router: regularization flow, or any invoice link whose plan the generic checkout cannot price. */
export function isRegularizationRoute(params: URLSearchParams): boolean {
  if (params.get("flow") === "regularizar") return true;
  const plan = (params.get("plano") || "").toLowerCase();
  return params.get("flow") === "pay_invoice" && !["pro", "premium", "marca"].includes(plan);
}

export type RegularizationStatus = "pending" | "paid" | "failed" | "expired" | "cancelled" | "busy" | "not_eligible";

/** Only a server-confirmed, applied payment counts as success. */
export function isRegularized(status: string | null | undefined): boolean {
  return status === "paid";
}

export function closedChargeMessage(status: string): string | null {
  switch (status) {
    case "failed": return "O pagamento não foi aprovado. Você pode gerar um novo PIX.";
    case "expired":
    case "cancelled": return "O PIX expirou sem pagamento. Gere um novo código para regularizar.";
    default: return null;
  }
}

export const cycleLabel = (c?: string) => (c === "annual" ? "Anual" : "Mensal");
export const planLabel = (p?: string, name?: string) => name || (p ? p.toUpperCase() : "—");
