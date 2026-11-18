import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { describe, it, expect } from "vitest";

// Executes the real edge handler source with a synthetic database and a blocked, scripted Mercado Pago transport.
const REG = "11111111-2222-4333-8444-555555555555";
type Opts = {
  noAuth?: boolean; body?: unknown; begin?: any; createFail?: boolean; mpStatus?: string;
  row?: any; sub?: any; expired?: boolean; claimDuplicate?: boolean;
};
async function run(o: Opts = {}) {
  const calls: { name: string; args: any }[] = [];
  const outbound: { url: string; init: RequestInit }[] = [];
  let handler: ((r: Request) => Promise<Response>) | undefined;
  const row = o.row ?? { id: REG, subscription_id: "sub-1", status: "pending", plan_id: "marca", billing_cycle: "monthly", amount: 199.97,
    gateway_payment_id: "pix-1", payment_id: "pay-1", pix_expires_at: new Date(Date.now() + (o.expired ? -10 : 20) * 60000).toISOString() };
  const sub = o.sub ?? { status: "past_due", plan_id: "gratis" };
  const tables: Record<string, any> = {
    master_payment_gateways: { mercadopago_access_token: "fixture-server-secret" },
    master_subscription_regularizations: row,
    master_subscription_payments: { pix_qr_code: "fixture-qr", pix_qr_code_base64: "Zg==", pix_expires_at: row.pix_expires_at, status: "pending" },
    master_subscriptions: sub,
    profiles: { email: "fixture@example.invalid", full_name: "Loja Fictícia", store_name: "Loja", cpf_cnpj: "00000000000" },
  };
  const db = {
    auth: { getClaims: async () => (o.noAuth ? { data: null, error: {} } : { data: { claims: { sub: "owner-1", email: "fixture@example.invalid" } }, error: null }) },
    rpc: async (name: string, args: any) => {
      calls.push({ name, args });
      if (name === "begin_subscription_regularization") return { data: o.begin ?? { status: "charge", regularization_id: REG, invoice_reference: "inv_fixture", amount: 199.97, plan_id: "marca", plan_name: "MARCA", billing_cycle: "monthly", idempotency_key: "regularize:fixture", pix_expires_at: new Date(Date.now() + 30 * 60000).toISOString() }, error: null };
      if (name === "record_subscription_regularization_charge") return { data: { status: "pending", pix_qr_code: "fixture-qr", pix_qr_code_base64: "Zg==", pix_expires_at: "2026-11-19T00:00:00Z" }, error: null };
      if (name === "claim_master_subscription_webhook") return { data: o.claimDuplicate ? { claimed: false, duplicate: true } : { claimed: true, token: "claim-token" }, error: null };
      return { data: { ok: true }, error: null };
    },
    from: (t: string) => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: tables[t] ?? null, error: null }) }),
  };
  const context: any = {
    Request, Response, Date, Math, Number, String, JSON, URL, AbortSignal, encodeURIComponent, z,
    createClient: () => db, corsHeaders: { "Access-Control-Allow-Origin": "*" },
    Deno: { env: { get: () => "fixture-config" } }, console: { error: () => {}, log: () => {} },
    fetch: async (url: string, init: RequestInit) => {
      outbound.push({ url, init });
      if (init.method === "POST") {
        if (o.createFail) return new Response("{}", { status: 500 });
        return Response.json({ id: 990001, status: "pending", transaction_amount: 199.97, currency_id: "BRL", external_reference: "inv_fixture",
          point_of_interaction: { transaction_data: { qr_code: "fixture-qr", qr_code_base64: "Zg==" } } });
      }
      return Response.json({ id: "pix-1", status: o.mpStatus ?? "pending", transaction_amount: 199.97, currency_id: "BRL", external_reference: "inv_fixture",
        date_approved: o.mpStatus === "approved" ? "2026-11-19T12:00:00.000-04:00" : null, payment_method_id: "pix" });
    },
    serve: (fn: typeof handler) => { handler = fn; },
  };
  const source = ts.transpileModule(readFileSync("supabase/functions/regularize-master-subscription/index.ts", "utf8").replace(/^import .*;\n/gm, ""),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  vm.createContext(context); vm.runInContext(source, context);
  if (!handler) throw new Error("Handler missing");
  const response = await handler(new Request("https://fixture.invalid", { method: "POST", headers: o.noAuth ? {} : { Authorization: "Bearer fixture-session" },
    body: JSON.stringify(o.body ?? { action: "start" }) }));
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text), text, calls, outbound };
}

describe("regularize-master-subscription (synthetic provider, no real charge)", () => {
  it("unauthenticated caller never reaches the ledger or the provider", async () => {
    const r = await run({ noAuth: true });
    expect(r.status).toBe(401); expect(r.calls).toHaveLength(0); expect(r.outbound).toHaveLength(0);
  });
  it("browser-supplied plan, cycle or amount is rejected", async () => {
    const r = await run({ body: { action: "start", amount: 0.01, plan: "marca", billingCycle: "annual" } });
    expect(r.status).toBe(400); expect(r.outbound).toHaveLength(0);
  });
  it("charge uses the server amount, invoice reference and stable idempotency key, then records it", async () => {
    const r = await run();
    const post = r.outbound.find((x) => x.init.method === "POST")!;
    const payload = JSON.parse(String(post.init.body));
    expect(payload.transaction_amount).toBe(199.97);
    expect(payload.external_reference).toBe("inv_fixture");
    expect(payload.payment_method_id).toBe("pix");
    expect(post.init.headers).toMatchObject({ "X-Idempotency-Key": "regularize:fixture" });
    expect(r.calls.map((c) => c.name)).toEqual(["begin_subscription_regularization", "record_subscription_regularization_charge"]);
    expect(r.body).toMatchObject({ state: "pending", regularizationId: REG, pix: { qrCode: "fixture-qr" } });
    expect(r.text).not.toContain("fixture-server-secret");
  });
  it("open charge is reused: same QR, no provider call", async () => {
    const r = await run({ begin: { status: "open", regularization_id: REG, pix_qr_code: "fixture-qr", pix_qr_code_base64: "Zg==", pix_expires_at: "x" } });
    expect(r.outbound).toHaveLength(0); expect(r.body.pix.qrCode).toBe("fixture-qr");
  });
  it("concurrent start in progress and non-eligible accounts never call the provider", async () => {
    expect((await run({ begin: { status: "busy" } })).status).toBe(202);
    const ne = await run({ begin: { status: "not_eligible", reason: "secondary_store" } });
    expect(ne.status).toBe(409); expect(ne.outbound).toHaveLength(0);
  });
  it("provider failure releases the lease and records nothing", async () => {
    const r = await run({ createFail: true });
    expect(r.status).toBe(502);
    expect(r.calls.map((c) => c.name)).toEqual(["begin_subscription_regularization", "release_subscription_regularization_charge"]);
  });
  it("status poll applies an approved payment only through the shared webhook reconciliation", async () => {
    const r = await run({ body: { action: "status", regularizationId: REG }, mpStatus: "approved" });
    const apply = r.calls.find((c) => c.name === "apply_master_subscription_webhook")!;
    expect(apply.args.p_kind).toBe("payment");
    expect(apply.args.p_resource).toMatchObject({ id: "pix-1", status: "approved", preapproval_id: null, next_payment_date: null });
    expect(r.calls.find((c) => c.name === "claim_master_subscription_webhook")!.args.p_event_key).toBe("payment:pix-1:regularization-poll:approved");
    expect(r.outbound.every((x) => x.init.method === "GET")).toBe(true);
  });
  it("success is reported only when the server applied it to the same active subscription", async () => {
    const applied = await run({ body: { action: "status", regularizationId: REG }, row: { id: REG, subscription_id: "sub-1", status: "paid", plan_id: "marca", payment_id: "pay-1" }, sub: { status: "active", plan_id: "marca" } });
    expect(applied.body.state).toBe("paid");
    const notApplied = await run({ body: { action: "status", regularizationId: REG }, row: { id: REG, subscription_id: "sub-1", status: "paid", plan_id: "marca" }, sub: { status: "past_due", plan_id: "gratis" } });
    expect(notApplied.body.state).toBe("pending");
  });
  it("pending PIX past expiry is closed by expiry, never by activation", async () => {
    const r = await run({ body: { action: "status", regularizationId: REG }, expired: true, mpStatus: "pending" });
    expect(r.calls.some((c) => c.name === "expire_subscription_regularization")).toBe(true);
    expect(r.calls.some((c) => c.name === "apply_master_subscription_webhook")).toBe(false);
  });
  it.each(["rejected", "cancelled"])("%s PIX goes through the shared reconciliation (which closes only the charge)", async (st) => {
    const r = await run({ body: { action: "status", regularizationId: REG }, mpStatus: st });
    expect(r.calls.find((c) => c.name === "apply_master_subscription_webhook")?.args.p_resource.status).toBe(st);
  });
});

async function createSubscription(regEligible: boolean) {
  const calls: string[] = []; const outbound: string[] = [];
  let handler: ((r: Request) => Promise<Response>) | undefined;
  const db = {
    auth: { getClaims: async () => ({ data: { claims: { sub: "owner-1" } }, error: null }) },
    rpc: async (name: string) => {
      calls.push(name);
      if (name === "is_plan_marca_enabled") return { data: true, error: null };
      if (name === "_subscription_regularization_terms") return { data: regEligible ? { eligible: true, plan_id: "marca" } : { eligible: false, reason: "no_subscription" }, error: null };
      if (name === "claim_marca_upgrade_checkout") return { data: null, error: { message: "stop-here" } };
      return { data: null, error: null };
    },
    from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) }),
  };
  const context: any = { Request, Response, Date, Math, Number, String, JSON, URL, z, createClient: () => db,
    Deno: { env: { get: () => "fixture-config" } }, console: { error: () => {}, log: () => {} },
    fetch: async (u: string) => { outbound.push(u); return Response.json({}); }, serve: (fn: typeof handler) => { handler = fn; } };
  const source = ts.transpileModule(readFileSync("supabase/functions/create-master-subscription/index.ts", "utf8").replace(/^import .*;\n/gm, ""),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  vm.createContext(context); vm.runInContext(source, context);
  const res = await handler!(new Request("https://fixture.invalid", { method: "POST", headers: { Authorization: "Bearer fixture" },
    body: JSON.stringify({ userId: "owner-1", planId: "marca", billingCycle: "monthly", paymentMethod: "pix", recurringConsent: false, acceptanceId: "a", brandAccountId: "b" }) }));
  return { status: res.status, body: await res.json(), calls, outbound };
}

describe("create-master-subscription with a regularizable MARCA", () => {
  it("refuses a second MARCA contract while the existing one can be regularized", async () => {
    const r = await createSubscription(true);
    expect(r.status).toBe(409); expect(r.body.regularize).toBe(true);
    expect(r.calls).not.toContain("claim_marca_upgrade_checkout"); expect(r.calls).not.toContain("validate_marca_checkout");
    expect(r.outbound).toHaveLength(0);
  });
  it("first MARCA purchase continues to the existing contract validation", async () => {
    const r = await createSubscription(false);
    expect(r.calls).toContain("claim_marca_upgrade_checkout");
  });
});
