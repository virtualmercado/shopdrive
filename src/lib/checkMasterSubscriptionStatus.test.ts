import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, it, expect } from "vitest";

// Real handler source; synthetic database and blocked, scripted provider (GET only).
interface RunOpts {
  claimed?: boolean;
  applyError?: boolean;
  mpId?: number;
  isRegularization?: boolean;
  freshSubStatus?: string;
  freshPayStatus?: string;
}

async function run(mpStatus: string, opts: RunOpts = {}) {
  const { claimed = true, applyError = false, mpId = 777, isRegularization = false, freshSubStatus, freshPayStatus } = opts;
  const rpcs: { name: string; args: any }[] = []; const updates: string[] = []; const outbound: { url: string; init: RequestInit }[] = [];
  let handler: ((r: Request) => Promise<Response>) | undefined;
  let subReads = 0;
  const sub = { id: "sub-1", status: "pending", plan_id: "marca", master_subscription_payments: [{ id: "pay-1", status: "pending", payment_method: "pix", gateway_payment_id: "777" }] };
  const chain = (t: string): any => ({
    select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, in() { return this; },
    maybeSingle: async () => {
      if (t === "master_subscriptions") {
        subReads += 1;
        if (subReads === 1) return { data: sub, error: null };
        return { data: { status: freshSubStatus ?? (mpStatus === "approved" && !applyError && claimed ? "active" : "pending") }, error: null };
      }
      if (t === "master_subscription_payments") {
        return { data: { status: freshPayStatus ?? (mpStatus === "approved" && !applyError && claimed ? "paid" : mpStatus === "rejected" || mpStatus === "cancelled" ? "failed" : "pending"), gateway_status: mpStatus, decline_code: null }, error: null };
      }
      if (t === "master_payment_gateways") return { data: { mercadopago_access_token: "fixture" }, error: null };
      if (t === "master_subscription_regularizations") return { data: isRegularization ? { id: "reg-1" } : null, error: null };
      return { data: null, error: null };
    },
    update() { updates.push(t); return { eq: async () => ({ error: null }) }; }, insert: async () => ({ error: null }),
  });
  const db = {
    auth: { getClaims: async () => ({ data: { claims: { sub: "owner-1" } }, error: null }) },
    from: chain,
    rpc: async (name: string, args: any) => { rpcs.push({ name, args });
      if (name === "claim_master_subscription_webhook") return { data: claimed ? { claimed: true, token: "t" } : { claimed: false, duplicate: true }, error: null };
      if (name === "apply_master_subscription_webhook" && applyError) return { data: null, error: { message: "db_error" } };
      return { data: { changed: true }, error: null }; },
  };
  const ctx: any = { Request, Response, Date, JSON, String, Object, encodeURIComponent, createClient: () => db,
    Deno: { env: { get: () => "fixture" } }, console: { log() {}, error() {} },
    fetch: async (url: string, init: RequestInit = {}) => { outbound.push({ url, init });
      return Response.json({ id: mpId, status: mpStatus, transaction_amount: 199.97, currency_id: "BRL", external_reference: "inv_fixture",
        date_approved: mpStatus === "approved" ? "2026-11-19T00:00:00Z" : null, payment_method_id: "pix" }); },
    serve: (fn: any) => { handler = fn; } };
  const src = ts.transpileModule(readFileSync("supabase/functions/check-master-subscription-status/index.ts", "utf8").replace(/^import .*;\n/gm, ""),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const resp = await handler!(new Request("https://fixture.invalid", { method: "POST", headers: { Authorization: "Bearer x" }, body: JSON.stringify({ subscriptionId: "sub-1" }) }));
  const body = await resp.json();
  return { rpcs, updates, outbound, body };
}

describe("PIX status poll settles through the webhook reconciliation", () => {
  it("approved PIX is applied by apply_master_subscription_webhook, never by direct writes", async () => {
    const r = await run("approved");
    const apply = r.rpcs.find((c) => c.name === "apply_master_subscription_webhook")!;
    expect(apply.args.p_kind).toBe("payment");
    expect(apply.args.p_resource).toMatchObject({ id: "777", status: "approved", transaction_amount: 199.97, currency_id: "BRL", external_reference: "inv_fixture" });
    expect(r.updates).toEqual([]);
    expect(r.rpcs.some((c) => c.name === "reactivate_products_after_upgrade")).toBe(false);
    expect(r.outbound).toHaveLength(1);
    expect(r.outbound[0].url).toBe("https://api.mercadopago.com/v1/payments/777");
    expect(!r.outbound[0].init.method || r.outbound[0].init.method === "GET").toBe(true);
    expect(r.body.normalizedStatus).toBe("approved");
    expect(r.body.subscription.status).toBe("active");
  });
  it("already claimed (webhook or another poll) applies nothing again", async () => {
    const r = await run("approved", { claimed: false, freshSubStatus: "active", freshPayStatus: "paid" });
    expect(r.rpcs.some((c) => c.name === "apply_master_subscription_webhook")).toBe(false);
    expect(r.updates).toEqual([]);
  });
  it("rejected PIX also goes through the shared reconciliation", async () => {
    const r = await run("rejected");
    expect(r.rpcs.find((c) => c.name === "apply_master_subscription_webhook")?.args.p_resource.status).toBe("rejected");
    expect(r.body.normalizedStatus).toBe("rejected");
  });
  it("cancelled PIX goes through the shared reconciliation", async () => {
    const r = await run("cancelled");
    expect(r.rpcs.find((c) => c.name === "apply_master_subscription_webhook")?.args.p_resource.status).toBe("cancelled");
    expect(r.body.normalizedStatus).toBe("rejected");
  });
  it("pending PIX does not settle anything", async () => {
    const r = await run("pending");
    expect(r.rpcs.some((c) => c.name === "apply_master_subscription_webhook")).toBe(false);
    expect(r.body.normalizedStatus).toBe("pending");
    expect(r.body.subscription.status).toBe("pending");
  });
  it("releases claim and avoids false success when reconciliation RPC fails", async () => {
    const r = await run("approved", { applyError: true });
    expect(r.rpcs.some((c) => c.name === "release_master_subscription_webhook")).toBe(true);
    expect(r.body.normalizedStatus).toBe("pending");
    expect(r.body.subscription.status).toBe("pending");
  });
  it("refuses settlement on provider_resource_mismatch", async () => {
    const r = await run("approved", { mpId: 999 });
    expect(r.rpcs.some((c) => c.name === "claim_master_subscription_webhook")).toBe(false);
    expect(r.rpcs.some((c) => c.name === "apply_master_subscription_webhook")).toBe(false);
    expect(r.body.normalizedStatus).toBe("pending");
  });
  it("skips regularization payments (handled exclusively by regularize-master-subscription)", async () => {
    const r = await run("approved", { isRegularization: true });
    expect(r.outbound).toHaveLength(0);
    expect(r.rpcs.some((c) => c.name === "apply_master_subscription_webhook")).toBe(false);
    expect(r.body.normalizedStatus).toBe("pending");
  });
});
