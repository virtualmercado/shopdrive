import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import { describe, it, expect } from 'vitest';

const secret = 'fixture-webhook-signing-key';
const access = 'fixture-provider-server-key';
const id = '184105194045';
const stamp = '1793913000';
const requestId = 'fixture-request';
const token = '11111111-1111-4111-8111-111111111111';
type Handler = (req: Request) => Promise<Response>;
interface Options { missingSecret?: boolean; fetchFails?: boolean; applyFails?: boolean; responseId?: string; topic?: string; authorizedId?: string; }
function harness(options: Options = {}) {
  let handler: Handler | undefined;
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const outbound: string[] = [];
  const logs: unknown[] = [];
  const claims = new Set<string>();
  const applied = new Set<string>();
  const db = {
    from: (table: string) => {
      if (table !== 'master_payment_gateways') throw new Error('Unexpected table');
      return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { mercadopago_webhook_secret: options.missingSecret ? null : secret, mercadopago_access_token: access }, error: null }) };
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      const key = String(args.p_event_key);
      if (name === 'claim_master_subscription_webhook') {
        if (claims.has(key)) return { data: { claimed: false, duplicate: true }, error: null };
        claims.add(key); return { data: { claimed: true, token }, error: null };
      }
      if (name === 'release_master_subscription_webhook') { claims.delete(key); return { data: null, error: null }; }
      if (name === 'apply_master_subscription_webhook') {
        if (options.applyFails) return { data: null, error: { message: `${secret} ${access}` } };
        const pid = String((args.p_resource as Record<string, unknown>).id);
        const changed = !applied.has(pid); applied.add(pid); return { data: { changed }, error: null };
      }
      throw new Error('Unexpected RPC');
    },
  };
  const context = {
    Request, Response, URL, Date, crypto, TextEncoder, Uint8Array, AbortSignal, Map, Set, z,
    createClient: () => db, Deno: { env: { get: () => 'fixture-config' } },
    corsHeaders: { 'Access-Control-Allow-Origin': '*' },
    console: { error: (...a: unknown[]) => logs.push(a), log: (...a: unknown[]) => logs.push(a) },
    fetch: async (url: string, init: RequestInit) => {
      expect(init.method).toBe('GET'); expect(url.startsWith('https://api.mercadopago.com/')).toBe(true);
      outbound.push(url);
      if (options.fetchFails) throw new Error(`${secret} ${access} fixture-payer-sensitive`);
      if (url.includes('/authorized_payments/')) return Response.json({ id: options.authorizedId ?? 'APMixedCase', preapproval_id: 'fixture-preapproval', payment: { id } });
      if (url.includes('/preapproval/')) return Response.json({ id: 'fixture-preapproval', status: 'authorized', next_payment_date: '2026-11-20T12:33:35Z' });
      return Response.json({ id: options.responseId ?? id, status: 'approved', transaction_amount: 49.97, currency_id: 'BRL', date_approved: '2026-10-20T08:33:35-04:00', external_reference: 'inv_fixture', preapproval_id: options.topic ? 'fixture-preapproval' : null, payment_method_id: 'master', payer: { email: 'fixture-payer-sensitive' }, access_token: access });
    }, serve: (fn: Handler) => { handler = fn; },
  };
  vm.createContext(context);
  const evaluate = (path: string) => {
    const source = readFileSync(path, 'utf8').replace(/^import .*;\n/gm, '').replace(/export /g, '');
    vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
  };
  evaluate('supabase/functions/master-subscription-webhook/signature.ts');
  evaluate('supabase/functions/master-subscription-webhook/index.ts');
  if (!handler) throw new Error('Handler not mounted');
  return { handler, calls, outbound, logs, applied };
}
function request(options: { unsigned?: boolean; invalid?: boolean; queryId?: string | null; headerId?: string | null; bodyId?: string; eventId?: string; body?: string; topic?: string; manifestId?: string } = {}) {
  const queryId = options.queryId === undefined ? id : options.queryId;
  const headerId = options.headerId === undefined ? requestId : options.headerId;
  const manifest = `${queryId === null ? '' : `id:${options.manifestId ?? queryId};`}${headerId === null ? '' : `request-id:${headerId};`}ts:${stamp};`;
  const signature = createHmac('sha256', secret).update(manifest).digest('hex');
  const headers: Record<string, string> = {};
  if (headerId !== null) headers['x-request-id'] = headerId;
  if (!options.unsigned) headers['x-signature'] = `ts=${stamp}, v1=${options.invalid ? '0'.repeat(64) : signature}`;
  return new Request(`https://fixture.invalid/webhook${queryId === null ? '' : `?data.id=${queryId}`}`, { method: 'POST', headers, body: options.body ?? JSON.stringify({ id: options.eventId ?? 'fixture-event', type: options.topic ?? 'payment', data: queryId === null ? undefined : { id: options.bodyId ?? queryId }, transaction_amount: 0.01, status: 'rejected' }) });
}

describe('Real subscription webhook, synthetic transport only', () => {
  it('missing signature returns 401 before parsing or dedup', async () => { const h = harness(); expect((await h.handler(request({ unsigned: true, body: '{' }))).status).toBe(401); expect(h.calls).toHaveLength(0); expect(h.outbound).toHaveLength(0); });
  it('invalid signature returns 401 without claiming any dedup key', async () => { const h = harness(); expect((await h.handler(request({ invalid: true }))).status).toBe(401); expect(h.calls).toHaveLength(0); expect(h.outbound).toHaveLength(0); });
  it('missing authentic signing configuration stays fail closed', async () => { const h = harness({ missingSecret: true }); expect((await h.handler(request())).status).toBe(503); expect(h.calls).toHaveLength(0); expect(h.outbound).toHaveLength(0); });
  it('valid signature is accepted; signature then claim then GET then reconciliation', async () => { const h = harness(); expect((await h.handler(request())).status).toBe(200); expect(h.calls.map(c => c.name)).toEqual(['claim_master_subscription_webhook', 'apply_master_subscription_webhook']); expect(h.outbound).toEqual([`https://api.mercadopago.com/v1/payments/${id}`]); });
  it('body financial fields are ignored; only normalized GET response is applied', async () => { const h = harness(); await h.handler(request()); expect(h.calls[1].args.p_resource).toMatchObject({ status: 'approved', transaction_amount: 49.97, external_reference: 'inv_fixture', date_approved: '2026-10-20T08:33:35-04:00' }); expect(JSON.stringify(h.calls[1])).not.toContain('fixture-payer-sensitive'); expect(JSON.stringify(h.calls[1])).not.toContain(access); });
  it('duplicate valid event is processed once without a second provider GET', async () => { const h = harness(); await h.handler(request()); const response = await h.handler(request()); expect(await response.json()).toEqual({ received: true, duplicate: true }); expect(h.outbound).toHaveLength(1); expect(h.calls.filter(c => c.name === 'apply_master_subscription_webhook')).toHaveLength(1); });
  it('invalid event cannot poison the later valid event dedup', async () => { const h = harness(); await h.handler(request({ invalid: true })); expect((await h.handler(request())).status).toBe(200); expect(h.calls.filter(c => c.name === 'claim_master_subscription_webhook')).toHaveLength(1); });
  it('valid signature with mismatched body ID is rejected before dedup', async () => { const h = harness(); expect((await h.handler(request({ bodyId: 'other-payment' }))).status).toBe(400); expect(h.calls).toHaveLength(0); });
  it('signed invalid JSON is rejected before dedup', async () => { const h = harness(); expect((await h.handler(request({ body: '{' }))).status).toBe(400); expect(h.calls).toHaveLength(0); });
  it('truly absent request-id component is omitted from official manifest', async () => { const h = harness(); expect((await h.handler(request({ headerId: null }))).status).toBe(200); });
  it('absent data.id is allowed only for a signed test notification', async () => { const h = harness(); expect((await h.handler(request({ queryId: null, topic: 'test' }))).status).toBe(200); expect(h.outbound).toHaveLength(0); expect((await harness().handler(request({ queryId: null }))).status).toBe(400); });
  it('current official SDK preserves mixed-case signed IDs', async () => { const h = harness({ topic: 'authorized_payment' }); expect((await h.handler(request({ topic: 'authorized_payment', queryId: 'APMixedCase' }))).status).toBe(200); expect(h.outbound[0]).toContain('/authorized_payments/APMixedCase'); expect((await harness().handler(request({ queryId: 'APMixedCase', manifestId: 'apmixedcase' }))).status).toBe(401); });
  it('recurring notification resolves authorized payment then GETs real payment and billing date', async () => { const h = harness({ topic: 'authorized_payment' }); await h.handler(request({ topic: 'authorized_payment', queryId: 'APMixedCase' })); expect(h.outbound).toEqual(['https://api.mercadopago.com/authorized_payments/APMixedCase', `https://api.mercadopago.com/v1/payments/${id}`, 'https://api.mercadopago.com/preapproval/fixture-preapproval']); expect(h.calls[1].args.p_resource).toMatchObject({ id, preapproval_id: 'fixture-preapproval', next_payment_date: '2026-11-20T12:33:35Z' }); });
  it('failed provider lookup releases the claim and returns retryable failure without secrets', async () => { const h = harness({ fetchFails: true }); const r = await h.handler(request()); expect(r.status).toBe(503); expect(h.calls.at(-1)?.name).toBe('release_master_subscription_webhook'); for (const s of [secret, access, 'fixture-payer-sensitive']) { expect(JSON.stringify(h.logs)).not.toContain(s); expect(await r.clone().text()).not.toContain(s); } });
  it('failed transaction releases claim instead of acknowledging success', async () => { const h = harness({ applyFails: true }); expect((await h.handler(request())).status).toBe(503); expect(h.calls.at(-1)?.name).toBe('release_master_subscription_webhook'); });
  it('provider ID mismatch cannot reconcile', async () => { const h = harness({ responseId: 'other-payment' }); expect((await h.handler(request())).status).toBe(503); expect(h.calls.some(c => c.name === 'apply_master_subscription_webhook')).toBe(false); });
  it('successful responses and logs never expose signatures, credentials or sensitive payloads', async () => { const h = harness(); const r = await h.handler(request()); const text = await r.text(); for (const s of [secret, access, 'fixture-payer-sensitive', token]) { expect(text).not.toContain(s); expect(JSON.stringify(h.logs)).not.toContain(s); } });
});