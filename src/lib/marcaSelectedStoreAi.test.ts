import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parseSelectedStoreHeader } from "../../supabase/functions/_shared/authorization";

type Handler = (request: Request) => Promise<Response>;
const actor = "11111111-1111-4111-8111-111111111111";
const storeB = "22222222-2222-4222-8222-222222222222";
const productB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const productA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** Runs the real AI function source with synthetic auth, database and AI transport. No network exists in the VM. */
function harness(file: string, opts: { approved?: boolean } = {}) {
  let handler: Handler | undefined;
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const logs: Record<string, unknown>[] = [];
  const aiCalls: string[] = [];
  const db = {
    auth: {
      getUser: async () => ({ data: { user: { id: actor } }, error: null }),
      getClaims: async () => ({ data: { claims: { sub: actor } }, error: null }),
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcs.push({ name, args });
      if (name === "can_actor_manage_marca_store") return { data: opts.approved === true && args.p_actor === actor && args.p_store_id === storeB, error: null };
      if (name === "can_manage_owned_store") return { data: opts.approved === true && args.p_store_id === storeB, error: null };
      throw new Error("Unexpected synthetic RPC");
    },
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      return {
        select() { return this; },
        eq(column: string, value: unknown) { filters[column] = value; return this; },
        async maybeSingle() {
          if (table !== "products") throw new Error("Unexpected synthetic table");
          const owner = filters.id === productB ? storeB : filters.id === productA ? actor : null;
          return { data: owner && owner === filters.user_id ? { id: filters.id } : null, error: null };
        },
        async insert(value: Record<string, unknown>) {
          if (table !== "ai_product_logs") throw new Error("Unexpected write");
          logs.push(value);
          return { data: null, error: null };
        },
      };
    },
  };
  const aiResponse = file.includes("palette")
    ? { choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ primary: "#111111", secondary: "#222222", headerBg: "#333333", headerText: "#ffffff", buttonBg: "#444444", buttonText: "#ffffff", footerBg: "#555555", footerText: "#ffffff", topBarBg: "#666666", topBarText: "#ffffff", explanation: "ok" }) } }] } }] }
    : { choices: [{ message: { content: JSON.stringify({ description_long: "Descrição sintética" }) } }] };
  const context = {
    Request, Response, JSON,
    createClient: () => db,
    parseSelectedStoreHeader,
    serve: (fn: Handler) => { handler = fn; },
    Deno: { env: { get: () => "synthetic-config" }, serve: (fn: Handler) => { handler = fn; } },
    console: { log: () => {}, error: () => {}, warn: () => {} },
    fetch: async (url: string) => {
      expect(url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
      aiCalls.push(url);
      return Response.json(aiResponse);
    },
  };
  const source = readFileSync(`supabase/functions/${file}/index.ts`, "utf8").replace(/^import .*;\r?\n/gm, "");
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
  if (!handler) throw new Error("handler not registered");
  return { handler, rpcs, logs, aiCalls };
}

const writerRequest = (store: string | null, productId?: string) => new Request("https://fixture.invalid/ai", {
  method: "POST",
  headers: { Authorization: "Bearer synthetic-jwt", ...(store ? { "x-shopdrive-store-id": store } : {}) },
  body: JSON.stringify({ tone: "neutral", channel: "loja_vm", product_id: productId }),
});
const paletteRequest = (store: string | null) => new Request("https://fixture.invalid/palette", {
  method: "POST",
  headers: { Authorization: "Bearer synthetic-jwt", ...(store ? { "x-shopdrive-store-id": store } : {}) },
  body: JSON.stringify({ basePalette: {}, paletteName: "Fixture", refinementPrompt: "mais claro" }),
});

describe("AI product writer in the selected MARCA store (real handler, synthetic transport)", () => {
  it("is available in the approved linked store and attributes the log to that store", async () => {
    const h = harness("ai-product-writer", { approved: true });
    const res = await h.handler(writerRequest(storeB, productB));
    expect(res.status).toBe(200);
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]).toMatchObject({ user_id: actor, store_id: storeB, product_id: productB });
  });
  it("denies a linked store without approved membership before calling AI", async () => {
    const h = harness("ai-product-writer", { approved: false });
    expect((await h.handler(writerRequest(storeB, productB))).status).toBe(403);
    expect(h.aiCalls).toHaveLength(0);
    expect(h.logs).toHaveLength(0);
  });
  it("rejects a product of another store in the selected context", async () => {
    const h = harness("ai-product-writer", { approved: true });
    expect((await h.handler(writerRequest(storeB, productA))).status).toBe(403);
    expect(h.aiCalls).toHaveLength(0);
  });
  it("rejects a manipulated store header", async () => {
    const h = harness("ai-product-writer", { approved: true });
    expect((await h.handler(writerRequest("not-a-store"))).status).toBe(403);
    expect(h.aiCalls).toHaveLength(0);
  });
  it("keeps the own store unchanged without a membership lookup", async () => {
    const h = harness("ai-product-writer");
    expect((await h.handler(writerRequest(null, productA))).status).toBe(200);
    expect(h.rpcs).toHaveLength(0);
    expect(h.logs[0]).toMatchObject({ user_id: actor, store_id: actor, product_id: productA });
  });
});

describe("AI palette refinement in the selected MARCA store", () => {
  it("is available in the approved linked store", async () => {
    const h = harness("refine-color-palette", { approved: true });
    expect((await h.handler(paletteRequest(storeB))).status).toBe(200);
    expect(h.rpcs).toEqual([{ name: "can_manage_owned_store", args: { p_store_id: storeB } }]);
  });
  it("denies an unapproved linked store before calling AI", async () => {
    const h = harness("refine-color-palette", { approved: false });
    expect((await h.handler(paletteRequest(storeB))).status).toBe(403);
    expect(h.aiCalls).toHaveLength(0);
  });
});
