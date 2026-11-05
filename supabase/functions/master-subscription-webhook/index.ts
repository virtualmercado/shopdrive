import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { verifyMercadoPagoSignature } from "./signature.ts";

// Hard decline codes - these should NOT be retried automatically
const HARD_DECLINE_CODES = [
  "cc_rejected_card_disabled",
  "cc_rejected_card_type_not_allowed",
  "cc_rejected_duplicated_payment",
  "cc_rejected_high_risk",
  "cc_rejected_max_attempts",
  "cc_rejected_other_reason",
  "cc_rejected_blacklist",
  "cc_rejected_bad_filled_card_number",
  "cc_rejected_bad_filled_date",
  "cc_rejected_bad_filled_security_code",
  "cc_rejected_bad_filled_other",
  "cc_amount_rate_limit_exceeded",
  "expired_token",
  "invalid_installments",
  "invalid_payment_type",
];

function isHardDecline(statusDetail: string | null): boolean {
  if (!statusDetail) return false;
  return HARD_DECLINE_CODES.includes(statusDetail);
}

function getUserFriendlyMessage(statusDetail: string | null): string {
  switch (statusDetail) {
    case "cc_rejected_card_disabled":
      return "Cartão bloqueado ou desativado. Atualize os dados do cartão.";
    case "cc_rejected_insufficient_amount":
      return "Saldo insuficiente. Tente novamente ou atualize o cartão.";
    case "cc_rejected_bad_filled_card_number":
      return "Número do cartão incorreto. Atualize os dados do cartão.";
    case "cc_rejected_bad_filled_date":
      return "Data de validade incorreta. Atualize os dados do cartão.";
    case "cc_rejected_bad_filled_security_code":
      return "Código de segurança incorreto. Tente novamente.";
    case "cc_rejected_high_risk":
      return "Pagamento recusado por segurança. Contate seu banco.";
    case "cc_rejected_call_for_authorize":
      return "Autorização necessária. Contate seu banco.";
    case "cc_rejected_max_attempts":
      return "Limite de tentativas excedido. Aguarde ou use outro cartão.";
    case "cc_rejected_duplicated_payment":
      return "Pagamento duplicado detectado.";
    case "expired_token":
      return "Sessão expirada. Atualize os dados do cartão.";
    default:
      return "Pagamento recusado pelo emissor. Atualize seu cartão para evitar a suspensão do plano.";
  }
}


const Identifier = z.union([z.string().regex(/^[A-Za-z0-9_-]{1,200}$/), z.number().int().nonnegative().refine(Number.isSafeInteger)]).transform(String);
const EventSchema = z.object({
  id: Identifier.optional(), type: z.string().max(100).optional(), topic: z.string().max(100).optional(),
  action: z.string().max(100).optional(), data: z.object({ id: Identifier }).optional(),
});
const PaymentSchema = z.object({
  id: Identifier, status: z.enum(['approved','pending','in_process','authorized','rejected','cancelled','refunded','charged_back']),
  status_detail: z.string().max(200).nullish(), transaction_amount: z.number().positive().finite(),
  currency_id: z.literal('BRL'), date_approved: z.string().datetime({ offset: true }).nullish(),
  external_reference: z.string().max(200).nullish(), preapproval_id: Identifier.nullish(),
  payment_method_id: z.string().max(100).optional(),
});
const AuthorizedSchema = z.object({ id: Identifier, preapproval_id: Identifier, payment: z.object({ id: Identifier.nullish() }).nullish() });
const PreapprovalSchema = z.object({ id: Identifier, status: z.enum(['authorized','pending','paused','cancelled']), next_payment_date: z.string().datetime({ offset: true }).nullish() });
const topics = new Set(['payment','subscription_authorized_payment','authorized_payment','subscription_preapproval','preapproval','subscription_preapproval_plan','test']);
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  // Even when configuration is missing, unsigned notifications are never accepted.
  if (!req.headers.get('x-signature')) return json({ error: 'Invalid signature' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Webhook unavailable' }, 503);
  const db = createClient(url, key);
  let eventKey: string | undefined;
  let claimToken: string | undefined;
  try {
    const { data: gateway, error: configError } = await db.from('master_payment_gateways')
      .select('mercadopago_webhook_secret,mercadopago_access_token')
      .eq('gateway_name','mercadopago').eq('is_active',true).eq('is_default',true).maybeSingle();
    if (configError) throw new Error('config_lookup_failed');
    if (!gateway?.mercadopago_webhook_secret) return json({ error: 'Webhook signature configuration missing' }, 503);
    if (!await verifyMercadoPagoSignature(req, gateway.mercadopago_webhook_secret)) return json({ error: 'Invalid signature' }, 401);
    // Authenticate before parsing and before any deduplication write.
    const bodyText = await req.text();
    if (bodyText.length > 65536) return json({ error: 'Invalid event' }, 400);
    let raw: unknown;
    try { raw = JSON.parse(bodyText); } catch { return json({ error: 'Invalid event' }, 400); }
    const parsed = EventSchema.safeParse(raw);
    if (!parsed.success) return json({ error: 'Invalid event' }, 400);
    const event = parsed.data;
    const topic = event.type ?? event.topic;
    if (!topic) return json({ error: 'Invalid event' }, 400);
    const signedId = new URL(req.url).searchParams.get('data.id');
    if (topic !== 'test' && (!signedId || !/^[A-Za-z0-9_-]{1,200}$/.test(signedId))) return json({ error: 'Signed resource ID required' }, 400);
    if (event.data && event.data.id !== signedId) return json({ error: 'Resource ID mismatch' }, 400);
    if (!topics.has(topic)) return json({ received: true, ignored: true });
    if (!gateway.mercadopago_access_token) return json({ error: 'Webhook resource configuration missing' }, 503);
    const resourceId = signedId ?? 'test';
    // Resource namespace prevents a notification ID from suppressing another payment.
    const eventIdentity = event.id ?? `${req.headers.get('x-request-id') ?? 'absent'}:${req.headers.get('x-signature')?.match(/(?:^|,)\s*ts\s*=\s*(\d+)/)?.[1] ?? ''}`;
    eventKey = `${topic}:${resourceId}:${eventIdentity}`;
    const { data: claim, error: claimError } = await db.rpc('claim_master_subscription_webhook', { p_event_key: eventKey, p_resource_id: resourceId, p_topic: topic });
    if (claimError || !claim) throw new Error('claim_failed');
    if (!claim.claimed) return claim.duplicate ? json({ received: true, duplicate: true }) : json({ error: 'Event processing; retry later' }, 503);
    if (typeof claim.token !== 'string') throw new Error('invalid_claim');
    claimToken = claim.token;
    const getResource = async (path: string): Promise<unknown> => {
      const response = await fetch(`https://api.mercadopago.com/${path}`, {
        method: 'GET', headers: { Authorization: `Bearer ${gateway.mercadopago_access_token}` }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) { await response.text(); throw new Error('provider_lookup_failed'); }
      return response.json();
    };
    let kind = 'ignored';
    let resource: Record<string, unknown> = {};
    if (topic === 'preapproval' || topic === 'subscription_preapproval') {
      resource = PreapprovalSchema.parse(await getResource(`preapproval/${encodeURIComponent(resourceId)}`));
      if (resource.id !== resourceId) throw new Error('provider_resource_mismatch');
      kind = 'preapproval';
    } else if (topic === 'payment' || topic === 'authorized_payment' || topic === 'subscription_authorized_payment') {
      let paymentId = resourceId;
      let preapprovalId: string | undefined;
      if (topic !== 'payment') {
        const ap = AuthorizedSchema.parse(await getResource(`authorized_payments/${encodeURIComponent(resourceId)}`));
        if (ap.id !== resourceId) throw new Error('provider_resource_mismatch');
        if (!ap.payment?.id) throw new Error('provider_payment_not_ready');
        paymentId = ap.payment.id;
        preapprovalId = ap.preapproval_id;
      }
      const payment = PaymentSchema.parse(await getResource(`v1/payments/${encodeURIComponent(paymentId)}`));
      if (payment.id !== paymentId || (preapprovalId && payment.preapproval_id && payment.preapproval_id !== preapprovalId)) throw new Error('provider_resource_mismatch');
      if (payment.status === 'approved' && !payment.date_approved) throw new Error('provider_approval_date_missing');
      resource = { ...payment, preapproval_id: preapprovalId ?? payment.preapproval_id ?? null,
        hard_decline: isHardDecline(payment.status_detail ?? null), user_message: getUserFriendlyMessage(payment.status_detail ?? null) };
      kind = 'payment';
    }
    const { data: result, error: applyError } = await db.rpc('apply_master_subscription_webhook', {
      p_event_key: eventKey, p_claim_token: claimToken, p_kind: kind, p_resource: resource,
    });
    if (applyError || !result) throw new Error('reconciliation_failed');
    return json({ received: true, changed: result.changed === true });
  } catch {
    // No provider body, secrets, hashes, request data or caught errors reach logs/results.
    if (eventKey && claimToken) {
      try { await db.rpc('release_master_subscription_webhook', { p_event_key: eventKey, p_claim_token: claimToken }); } catch { /* Lease also permits safe retry. */ }
    }
    console.error('MASTER_SUBSCRIPTION_WEBHOOK_RETRY_REQUIRED');
    return json({ error: 'Webhook temporarily unavailable; retry later' }, 503);
  }
});
