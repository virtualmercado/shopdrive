import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type Handler = (request: Request) => Promise<Response>;
const storeId = "22222222-2222-4222-8222-222222222222";
const actorId = "11111111-1111-4111-8111-111111111111";
const subscriptionId = "33333333-3333-4333-8333-333333333333";
const syntheticToken = "synthetic-provider-token-never-real";

/** Executes the deployed handler source with an entirely synthetic transport. */
function harness(options: { claims?: boolean; admin?: boolean; cancelled?: boolean; concurrent?: boolean } = {}) {
  let handler: Handler | undefined;
  let providerStatus = options.cancelled ? "cancelled" : "authorized";
  let reads = 0;
  let releaseReads: (() => void) | undefined;
  const bothReads = new Promise<void>((resolve) => { releaseReads = resolve; });
  const requests: { url: string; method: string; body: string | null }[] = [];
  const writes: { table: string; value: unknown }[] = [];
  const logs: unknown[] = [];
  const db = {
    auth: { getClaims: async () => ({ data: options.claims === false ? null : { claims: { sub: actorId } }, error: null }) },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "has_role") {
        expect(args).toEqual({ _user_id: actorId, _role: "admin" });
        return { data: options.admin === true, error: null };
      }
      if (name === "get_brand_inherited_plan") {
        expect(args).toEqual({ p_store_id: storeId });
        return { data: "marca", error: null };
      }
      throw new Error("Unexpected synthetic RPC");
    },
    from: (table: string) => ({
      select() { return this; },
      eq() { return this; },
      async maybeSingle() {
        if (table === "brand_account_owned_stores") return { data: { brand_account_id: "fixture-brand", store_role: "secondary" }, error: null };
        if (table === "master_subscriptions") return { data: { id: subscriptionId, user_id: storeId, plan_id: "premium", status: "active", gateway: "mercadopago", gateway_subscription_id: "fixture-recurrence", current_period_end: "2026-11-20T00:00:00Z" }, error: null };
        if (table === "master_payment_gateways") return { data: { mercadopago_access_token: syntheticToken }, error: null };
        throw new Error("Unexpected synthetic table");
      },
      async insert(value: unknown) {
        if (table !== "master_subscription_logs") throw new Error("Financial record writes forbidden in this test");
        writes.push({ table, value });
        return { data: null, error: null };
      },
    }),
  };
  const context = {
    Request, Response, AbortSignal,
    createClient: () => db,
    corsHeaders: { "Access-Control-Allow-Origin": "*" },
    Deno: { env: { get: () => "synthetic-config" }, serve: (fn: Handler) => { handler = fn; } },
    console: { log: (...args: unknown[]) => logs.push(args), error: (...args: unknown[]) => logs.push(args), warn: (...args: unknown[]) => logs.push(args) },
    // No real fetch exists inside this VM. Every external call is captured locally.
    fetch: async (url: string, init: RequestInit = {}) => {
      expect(url).toBe("https://api.mercadopago.com/preapproval/fixture-recurrence");
      const method = init.method ?? "GET";
      requests.push({ url, method, body: typeof init.body === "string" ? init.body : null });
      if (method === "GET") {
        const snapshot = providerStatus;
        if (options.concurrent) {
          reads += 1;
          if (reads === 2) releaseReads?.();
          await bothReads;
        }
        return Response.json({ status: snapshot, next_payment_date: null });
      }
      expect(method).toBe("PUT");
      expect(JSON.parse(String(init.body))).toEqual({ status: "cancelled" });
      providerStatus = "cancelled";
      return Response.json({ status: providerStatus, next_payment_date: null });
    },
  };
  const source = readFileSync("supabase/functions/cancel-marca-secondary-recurrence/index.ts", "utf8").replace(/^import .*;\r?\n/gm, "");
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
  if (!handler) throw new Error("Synthetic handler was not registered");
  return { handler, requests, writes, logs };
}

const request = (authenticated = true) => new Request("https://fixture.invalid/cancel", {
  method: "POST", headers: authenticated ? { Authorization: "Bearer synthetic-jwt" } : {},
  body: JSON.stringify({ store_id: storeId, subscription_id: subscriptionId }),
});

describe("Real MARCA recurrence cancellation handler, synthetic-only validation", () => {
  it("requires authentication, without provider calls or database writes", async () => {
    const h = harness({ admin: true });
    expect((await h.handler(request(false))).status).toBe(401);
    expect(h.requests).toHaveLength(0);
    expect(h.writes).toHaveLength(0);
  });
  it("rejects invalid claims", async () => {
    const h = harness({ claims: false, admin: true });
    expect((await h.handler(request())).status).toBe(401);
    expect(h.requests).toHaveLength(0);
  });
  it("denies a MARCA owner without the server-side admin role", async () => {
    const h = harness({ admin: false });
    expect((await h.handler(request())).status).toBe(403);
    expect(h.requests).toHaveLength(0);
    expect(h.writes).toHaveLength(0);
  });
  it("does not issue a new cancellation on a sequential retry", async () => {
    const h = harness({ admin: true });
    expect((await h.handler(request())).status).toBe(200);
    expect((await h.handler(request())).status).toBe(200);
    expect(h.requests.filter((r) => r.method === "PUT")).toHaveLength(1);
    expect(h.writes.every((w) => w.table === "master_subscription_logs")).toBe(true);
  });
  it("preserves the paid period and does not expose the synthetic provider token", async () => {
    const h = harness({ admin: true, cancelled: true });
    const response = await h.handler(request());
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ paid_until: "2026-11-20T00:00:00Z", local_status: "active" });
    expect(h.requests.filter((r) => r.method === "PUT")).toHaveLength(0);
    expect(text).not.toContain(syntheticToken);
    expect(JSON.stringify(h.logs)).not.toContain(syntheticToken);
    expect(JSON.stringify(h.writes)).not.toContain(syntheticToken);
  });
  // Expected failure is a release blocker, NOT certification of idempotence.
  // Once the handler gains a durable single-flight claim, remove .fails.
  it.fails("BLOCKER: concurrent requests must cancel the external recurrence only once", async () => {
    const h = harness({ admin: true, concurrent: true });
    const responses = await Promise.all([h.handler(request()), h.handler(request())]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(h.requests.filter((r) => r.method === "PUT")).toHaveLength(1);
  });
});