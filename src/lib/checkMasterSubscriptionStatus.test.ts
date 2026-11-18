import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, it, expect } from "vitest";

// Real handler source; synthetic database and blocked, scripted provider (GET only).
async function run(mpStatus: string, claimed = true) {
  const rpcs: { name: string; args: any }[] = []; const updates: string[] = []; const outbound: RequestInit[] = [];
  let handler: ((r: Request) => Promise<Response>) | undefined;
  const sub = { id: "sub-1", status: "pending", plan_id: "marca", master_subscription_payments: [{ id: "pay-1", status: "pending", payment_method: "pix", gateway_payment_id: "777" }] };
  const chain = (t: string): any => ({
    select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, in() { return this; },
    maybeSingle: async () => ({ data: t === "master_subscriptions" ? sub : t === "master_payment_gateways" ? { mercadopago_access_token: "fixture" } : null, error: null }),
    update() { updates.push(t); return { eq: async () => ({ error: null }) }; }, insert: async () => ({ error: null }),
  });
  const db = {
    auth: { getClaims: async () => ({ data: { claims: { sub: "owner-1" } }, error: null }) },
    from: chain,
    rpc: async (name: string, args: any) => { rpcs.push({ name, args });
      if (name === "claim_master_subscription_webhook") return { data: claimed ? { claimed: true, token: "t" } : { claimed: false, duplicate: true }, error: null };
      return { data: { changed: true }, error: null }; },
  };
  const ctx: any = { Request, Response, Date, JSON, String, Object, encodeURIComponent, createClient: () => db,
    Deno: { env: { get: () => "fixture" } }, console: { log() {}, error() {} },
    fetch: async (_u: string, init: RequestInit = {}) => { outbound.push(init);
      return Response.json({ id: 777, status: mpStatus, transaction_amount: 199.97, currency_id: "BRL", external_reference: "inv_fixture",
        date_approved: mpStatus === "approved" ? "2026-11-19T00:00:00Z" : null, payment_method_id: "pix" }); },
    serve: (fn: any) => { handler = fn; } };
  const src = ts.transpileModule(readFileSync("supabase/functions/check-master-subscription-status/index.ts", "utf8").replace(/^import .*;\n/gm, ""),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  vm.createContext(ctx); vm.runInContext(src, ctx);
  await handler!(new Request("https://fixture.invalid", { method: "POST", headers: { Authorization: "Bearer x" }, body: JSON.stringify({ subscriptionId: "sub-1" }) }));
  return { rpcs, updates, outbound };
}

describe("PIX status poll settles through the webhook reconciliation", () => {
  it("approved PIX is applied by apply_master_subscription_webhook, never by direct writes", async () => {
    const r = await run("approved");
    const apply = r.rpcs.find((c) => c.name === "apply_master_subscription_webhook")!;
    expect(apply.args.p_kind).toBe("payment");
    expect(apply.args.p_resource).toMatchObject({ id: "777", status: "approved", transaction_amount: 199.97, currency_id: "BRL", external_reference: "inv_fixture" });
    expect(r.updates).toEqual([]);
    expect(r.rpcs.some((c) => c.name === "reactivate_products_after_upgrade")).toBe(false);
    expect(r.outbound.every((i) => !i.method || i.method === "GET")).toBe(true);
  });
  it("already claimed (webhook or another poll) applies nothing again", async () => {
    const r = await run("approved", false);
    expect(r.rpcs.some((c) => c.name === "apply_master_subscription_webhook")).toBe(false);
    expect(r.updates).toEqual([]);
  });
  it("rejected PIX also goes through the shared reconciliation", async () => {
    const r = await run("rejected");
    expect(r.rpcs.find((c) => c.name === "apply_master_subscription_webhook")?.args.p_resource.status).toBe("rejected");
  });
  it("pending PIX does not settle anything", async () => {
    const r = await run("pending");
    expect(r.rpcs.some((c) => c.name === "apply_master_subscription_webhook")).toBe(false);
  });
});
