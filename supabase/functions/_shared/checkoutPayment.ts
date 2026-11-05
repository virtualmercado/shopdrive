// No token/card data is logged or stored here. Used by real handlers and synthetic tests.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const PAYMENT_UNKNOWN = 'Não foi possível confirmar o pagamento. Estamos verificando o resultado. Não tente pagar novamente agora.';
export const PAYMENT_NOT_STARTED = 'Não foi possível iniciar o pagamento. Nenhuma cobrança foi realizada.';
export const PAYMENT_LOCAL_PENDING = 'Pagamento aprovado. Estamos confirmando seu pedido.';
export class PaymentAccessError extends Error {}
export async function tokenHash(value: string): Promise<string> {
 const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function paymentIdentity(req: Request, auth: SupabaseClient, guestToken?: string) {
 const header = req.headers.get('Authorization');
 let userId: string | null = null;
 if (header?.startsWith('Bearer ')) {
  const { data, error } = await auth.auth.getClaims(header.slice(7));
  if (!error && typeof data?.claims?.sub === 'string') userId = data.claims.sub;
 }
 if (userId) return { p_user_id: userId, p_token_hash: null };
 if (!guestToken || !/^[0-9a-f]{64}$/.test(guestToken)) throw new PaymentAccessError();
 return { p_user_id: null, p_token_hash: await tokenHash(guestToken) };
}
export async function authorizePayment(db: SupabaseClient, orderId: string, method: string, identity: { p_user_id: string | null; p_token_hash: string | null }) {
 const { data, error } = await db.rpc('authorize_checkout_payment', { p_order_id: orderId, p_method: method, ...identity });
 if (error || !data) throw new PaymentAccessError();
 return data;
}
export function pixProvider(settings: Record<string, unknown>): 'mercadopago' | 'pagbank' | null {
 if (settings.pix_enabled && settings.pix_provider === 'infinitepay') return null;
 if (settings.pix_enabled && settings.pix_provider === 'mercado_pago') return 'mercadopago';
 if (settings.pix_enabled && settings.pix_provider === 'pagbank') return 'pagbank';
 if (settings.mercadopago_enabled && settings.mercadopago_accepts_pix) return 'mercadopago';
 if (settings.pagbank_enabled && settings.pagbank_accepts_pix) return 'pagbank';
 return null;
}
export function cardProviderEnabled(settings: Record<string, unknown>): boolean {
 if (settings.credit_card_enabled && settings.credit_card_provider && settings.credit_card_provider !== 'mercado_pago') return false;
 return Boolean(settings.credit_card_enabled || (settings.mercadopago_enabled && settings.mercadopago_accepts_credit));
}
export function rejectionMessage(detail?: string): string {
 if (detail === 'cc_rejected_insufficient_amount') return 'Pagamento recusado. Saldo insuficiente no cartão.';
 if (detail === 'cc_rejected_call_for_authorize') return 'Pagamento recusado. Solicite autorização ao banco emissor.';
 return 'Pagamento recusado pelo banco emissor.';
}
export function normalizeGatewayPayment(raw: Record<string, any>, order: { id: string; total_amount: number }, gateway = 'mercadopago') {
 if (gateway === 'pagbank') {
  if (raw.reference_id !== order.id || !raw.id || Number(raw.qr_codes?.[0]?.amount?.value) !== Math.round(Number(order.total_amount)*100)) return null;
  const status = raw.charges?.[0]?.status;
  const qr = raw.qr_codes?.[0];
  return { id: String(raw.id), state: status === 'PAID' ? 'approved' : ['CANCELED','DECLINED'].includes(status) ? 'cancelled' : 'pending', detail: '', qr: qr?.text, qrBase64: qr?.links?.find((l: any) => l.rel === 'QRCODE.PNG')?.href, expiresAt: qr?.expiration_date };
 }
 if (!raw.id || raw.external_reference !== order.id || Math.round(Number(raw.transaction_amount)*100) !== Math.round(Number(order.total_amount)*100)) return null;
 if (!['approved','pending','in_process','authorized','rejected','cancelled','expired'].includes(raw.status)) return null;
 return { id: String(raw.id), state: ['in_process','authorized'].includes(raw.status) ? 'pending' : raw.status, detail: String(raw.status_detail || ''), qr: raw.point_of_interaction?.transaction_data?.qr_code, qrBase64: raw.point_of_interaction?.transaction_data?.qr_code_base64, expiresAt: raw.date_of_expiration };
}
export async function fetchPayment(url: string, init: RequestInit) {
 return fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
}
export async function reconcilePayment(order: { id: string; total_amount: number; card_payment_id?: string }, externalId: string | null, credential: string, gateway = 'mercadopago') {
 const headers = { Authorization: `Bearer ${credential}` };
 if (externalId || order.card_payment_id) {
  const id = externalId || order.card_payment_id;
  const response = await fetchPayment(gateway === 'pagbank' ? `https://api.pagseguro.com/orders/${encodeURIComponent(String(id))}` : `https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(id))}`, { headers });
  return response.ok ? normalizeGatewayPayment(await response.json(), order, gateway) : null;
 }
 if (gateway !== 'mercadopago') return null; // Never issue a second PagBank create to resolve an unknown first call.
 const response = await fetchPayment(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(order.id)}&sort=date_created&criteria=desc&limit=10`, { headers });
 if (!response.ok) return null;
 const raw = await response.json();
 const matches = (raw.results || []).map((item: Record<string, any>) => normalizeGatewayPayment(item, order)).filter(Boolean);
 return matches.length === 1 ? matches[0] : null; // zero or conflicting results remain unknown; never charge again.
}
export async function persistPayment(db: SupabaseClient, orderId: string, payment: NonNullable<ReturnType<typeof normalizeGatewayPayment>>) {
 // Commit provider result first; a failed order update can always replay without charging.
 const { error } = await db.rpc('record_checkout_payment_result', { p_order_id: orderId, p_state: payment.state, p_external_id: payment.id, p_qr: payment.qr || null, p_qr_base64: payment.qrBase64 || null, p_pix_expires_at: payment.expiresAt || null });
 if (error) return { success: payment.state === 'approved', status: payment.state === 'approved' ? 'approved' : 'unknown', orderConfirmed: false, message: payment.state === 'approved' ? PAYMENT_LOCAL_PENDING : PAYMENT_UNKNOWN };
 const { data, error: applyError } = await db.rpc('apply_checkout_payment_result', { p_order_id: orderId });
 if (applyError || !data) return { success: payment.state === 'approved', status: payment.state === 'approved' ? 'approved' : 'unknown', orderConfirmed: false, message: payment.state === 'approved' ? PAYMENT_LOCAL_PENDING : PAYMENT_UNKNOWN };
 return { ...data, success: payment.state === 'approved' || Boolean(data.qrCode), message: payment.state === 'rejected' ? rejectionMessage(payment.detail) : payment.state === 'approved' ? 'Pagamento aprovado com sucesso!' : 'Pagamento pendente de confirmação.' };
}
