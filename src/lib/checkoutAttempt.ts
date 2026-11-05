/** Order authorization lives only in this checkout's session, never URLs/logs/order caches. */
export interface CheckoutAttempt { attemptId: string; guestPaymentToken: string; expiresAt: string; orderId?: string; state?: 'ready' | 'unknown' | 'terminal'; }
export function attemptStorageKey(storeId: string, customerId: string | null) { return `shopdrive_checkout_attempt:${storeId}:${customerId || 'guest'}`; }
export function loadCheckoutAttempt(key: string): CheckoutAttempt | null {
 try {
  const raw = sessionStorage.getItem(key); if (!raw) return null;
  const value = JSON.parse(raw);
  // An expired order-bound attempt must not disappear: require reconciliation, not a new order.
  if (typeof value.attemptId !== 'string' || !/^[0-9a-f]{64}$/.test(value.guestPaymentToken) || typeof value.expiresAt !== 'string') throw new Error('checkout_attempt_unreadable');
  return value;
 } catch { throw new Error('checkout_attempt_unreadable'); }
}
export function saveCheckoutAttempt(key: string, attempt: CheckoutAttempt) {
 sessionStorage.setItem(key, JSON.stringify(attempt)); // Failure prevents order submission; don't silently lose idempotency.
}
export const CARD_MESSAGES = {
 tokenization: 'Não foi possível validar os dados do cartão.',
 notStarted: 'Não foi possível iniciar o pagamento. Nenhuma cobrança foi realizada.',
 unknown: 'Não foi possível confirmar o pagamento. Estamos verificando o resultado. Não tente pagar novamente agora.',
 approvedPending: 'Pagamento aprovado. Estamos confirmando seu pedido.',
 rejected: 'Pagamento recusado pelo banco emissor.',
};
export function safeCardMessage(status: string, detail?: string) {
 if (status === 'not_started') return CARD_MESSAGES.notStarted;
 if (status === 'rejected') return detail === 'cc_rejected_insufficient_amount' ? 'Pagamento recusado. Saldo insuficiente no cartão.' : CARD_MESSAGES.rejected;
 if (['cancelled','expired'].includes(status)) return 'Este pagamento foi encerrado. O estoque foi liberado.';
 return CARD_MESSAGES.unknown;
}
