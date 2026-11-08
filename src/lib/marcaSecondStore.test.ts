import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parseSlots, resolveCreationResponse, slotView } from "./marcaSecondStore";

describe("MARCA second-store slots (UI view of server state)", () => {
  it("one MARCA store offers creation", () => {
    expect(slotView(parseSlots({ eligible: true, used: 1, limit: 2, canCreate: true, pending: false }))).toBe("create");
  });
  it("two stores show the limit and never the form", () => {
    expect(slotView(parseSlots({ eligible: true, used: 2, limit: 2, canCreate: true, pending: false }))).toBe("limit");
    expect(slotView(parseSlots({ eligible: true, used: 2, limit: 2, canCreate: false }))).toBe("limit");
  });
  it("non-MARCA or unknown state hides the area", () => {
    expect(slotView(parseSlots({ eligible: false, used: 0, canCreate: true }))).toBe("hidden");
    expect(slotView(null)).toBe("hidden");
  });
  it("limit response is distinct from generic failure", () => {
    expect(resolveCreationResponse({ status: "limit_reached" }).kind).toBe("limit_reached");
    expect(resolveCreationResponse({ status: "failed" })).toMatchObject({ kind: "error", rotateKey: true });
  });
});

type Handler = (request: Request) => Promise<Response>;
const ACTOR = "11111111-1111-4111-8111-111111111111";
const NEW_USER = "22222222-2222-4222-8222-222222222222";
const KEY = "33333333-3333-4333-8333-333333333333";

/** Executes the real handler source with a synthetic in-memory backend (no network, no real accounts). */
function harness(opts: { linked?: number; failComplete?: string } = {}) {
  let handler: Handler | undefined;
  const state = { linked: opts.linked ?? 1, requests: new Map<string, { status: string; token: string; user?: string; storeId?: string }>(), pending: null as string | null };
  const users: { id: string; meta: Record<string, unknown> }[] = [];
  const calls: { name: string; args: unknown }[] = [];
  const logs: unknown[] = [];
  const db = {
    auth: {
      getClaims: async (jwt: string) => ({ data: jwt === "synthetic-jwt" ? { claims: { sub: ACTOR } } : null, error: null }),
      admin: {
        createUser: async (p: { user_metadata: Record<string, unknown> }) => { calls.push({ name: "createUser", args: p.user_metadata }); users.push({ id: NEW_USER, meta: p.user_metadata }); return { data: { user: { id: NEW_USER } }, error: null }; },
        deleteUser: async (id: string) => { calls.push({ name: "deleteUser", args: id }); return { error: null }; },
      },
      resetPasswordForEmail: async (_e: string, o: { redirectTo: string }) => { calls.push({ name: "reset", args: o.redirectTo }); return { error: null }; },
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "begin_marca_second_store_creation") {
        expect(args.p_actor).toBe(ACTOR);
        const key = String(args.p_key);
        const r = state.requests.get(key);
        if (r?.status === "completed") return { data: { state: "completed", storeId: r.storeId }, error: null };
        if (r && r.status !== "pending") return { data: { state: "failed" }, error: null };
        if (state.linked >= 2) return { data: { state: "limit_reached" }, error: null };
        if (state.pending) return { data: { state: "in_progress" }, error: null };
        state.pending = key; state.requests.set(key, { status: "pending", token: "fence-" + key });
        return { data: { state: "claimed", requestId: "req-" + key, attemptToken: "fence-" + key, email: "nova@example.invalid", ownerName: "Dona", storeName: "Loja Nova", existingUserId: null, cleanupUserId: null }, error: null };
      }
      const key = String(args.p_request_id).replace("req-", "");
      const r = state.requests.get(key)!;
      if (name === "complete_marca_second_store_creation") {
        if (opts.failComplete) return { data: null, error: { message: opts.failComplete } };
        if (r.token !== args.p_attempt_token || r.status !== "pending") return { data: null, error: { message: "request_superseded" } };
        if (state.linked >= 2) return { data: null, error: { message: "limit_reached" } };
        state.linked++; r.status = "completed"; r.storeId = String(args.p_user_id); state.pending = null;
        return { data: { storeId: r.storeId }, error: null };
      }
      if (name === "fail_marca_second_store_creation") { const ok = r.status === "pending"; r.status = "failed"; state.pending = null; return { data: ok, error: null }; }
      if (name === "_marca_creation_user") return { data: null, error: null };
      throw new Error("unexpected rpc " + name);
    },
  };
  const context = {
    Request, Response, URL, crypto,
    createClient: () => db,
    corsHeaders: { "Access-Control-Allow-Origin": "*" },
    Deno: { env: { get: () => "synthetic-config" }, serve: (fn: Handler) => { handler = fn; } },
    console: { log: (...a: unknown[]) => logs.push(a), error: (...a: unknown[]) => logs.push(a), warn: (...a: unknown[]) => logs.push(a) },
    fetch: async () => { throw new Error("network blocked in synthetic test"); },
  };
  const source = readFileSync("supabase/functions/create-marca-second-store/index.ts", "utf8").replace(/^import .*;\r?\n/gm, "");
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
  if (!handler) throw new Error("handler not registered");
  return { handler, state, calls, logs, users };
}
const req = (body: Record<string, unknown> = {}, jwt = "synthetic-jwt") => new Request("https://fixture.invalid/fn", {
  method: "POST", headers: { Authorization: `Bearer ${jwt}`, Origin: "https://shopdrive.com.br" },
  body: JSON.stringify({ idempotencyKey: KEY, email: "nova@example.invalid", ownerName: "Dona", storeName: "Loja Nova", ...body }),
});

describe("Real create-marca-second-store handler, synthetic-only", () => {
  it("rejects unauthenticated calls without creating accounts", async () => {
    const h = harness();
    expect((await h.handler(req({}, "forged"))).status).toBe(401);
    expect(h.calls.some((c) => c.name === "createUser")).toBe(false);
  });
  it("creates an independent owner tagged with the request, links once and sends the password e-mail", async () => {
    const h = harness();
    const res = await h.handler(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "completed", storeId: NEW_USER, accessEmailSent: true });
    expect(h.users).toHaveLength(1);
    expect(h.users[0].id).not.toBe(ACTOR);
    expect(h.users[0].meta).toMatchObject({ store_name: "Loja Nova", marca_store_request_id: "req-" + KEY });
    expect(h.calls.find((c) => c.name === "reset")?.args).toBe("https://shopdrive.com.br/reset-password");
    expect(JSON.stringify(body)).not.toContain("fence-");
  });
  it("replay with the same key returns the same store without a second account", async () => {
    const h = harness();
    await h.handler(req());
    const again = await (await h.handler(req())).json();
    expect(again).toMatchObject({ status: "completed", storeId: NEW_USER });
    expect(h.calls.filter((c) => c.name === "createUser")).toHaveLength(1);
  });
  it("with 2 linked stores the server blocks a third, even with a forged new key", async () => {
    const h = harness({ linked: 2 });
    const res = await h.handler(req({ idempotencyKey: "44444444-4444-4444-8444-444444444444" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ status: "limit_reached" });
    expect(h.calls.some((c) => c.name === "createUser")).toBe(false);
  });
  it("concurrent requests with different keys create only one store", async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.handler(req()), h.handler(req({ idempotencyKey: "55555555-5555-4555-8555-555555555555" }))]);
    expect([a.status, b.status].sort()).toEqual([200, 202]);
    expect(h.calls.filter((c) => c.name === "createUser")).toHaveLength(1);
    expect(h.state.linked).toBe(2);
  });
  it("a failed link removes the just-created owner account (no orphan)", async () => {
    const h = harness({ failComplete: "limit_reached" });
    const res = await h.handler(req());
    expect(res.status).toBe(409);
    expect(h.calls.filter((c) => c.name === "deleteUser").map((c) => c.args)).toEqual([NEW_USER]);
    expect(JSON.stringify(h.logs)).not.toContain("nova@example.invalid");
  });
});
