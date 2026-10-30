import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const backendSource = readFileSync("supabase/functions/process-credit-card/index.ts", "utf8");

function consoleCalls(source: string, fileName: string) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const calls: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(file) === "console") calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return { file, calls };
}

async function runBackend(gatewayReply: unknown, failure?: Error, gatewayStatus = 200) {
  const logs: unknown[][] = [];
  const outbound: { url: string; init: RequestInit }[] = [];
  const writes: string[] = [];
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const client = {
    auth: { getClaims: async () => ({ data: { claims: { sub: "fixture-user" } }, error: null }) },
    from: () => ({
      select() { return this; }, eq() { return this; },
      single: async () => ({ data: { mercadopago_access_token: "fixture-server-credential", mercadopago_enabled: true, mercadopago_accepts_credit: true }, error: null }),
      insert: () => { writes.push("insert"); throw new Error("Writes forbidden in fixture"); },
      update: () => { writes.push("update"); throw new Error("Writes forbidden in fixture"); },
    }),
  };
  const source = backendSource.replace(/^import .*;\n/gm, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  vm.runInNewContext(compiled, {
    serve: (fn: typeof handler) => { handler = fn; }, createClient: () => client,
    Deno: { env: { get: () => "fixture-environment" } }, Request, Response, Date,
    console: Object.fromEntries(["log", "error", "warn", "debug", "info"].map(level => [level, (...args: unknown[]) => logs.push(args)])),
    fetch: async (url: string, init: RequestInit) => {
      outbound.push({ url, init });
      if (failure) throw failure;
      return Response.json(gatewayReply, { status: gatewayStatus });
    },
  });
  if (!handler) throw new Error("Handler not mounted");
  const response = await handler(new Request("https://fixture.invalid/process-credit-card", {
    method: "POST", headers: { Authorization: "Bearer fixture-auth", "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 10, storeOwnerId: "fixture-store", customerName: "Cliente Fictício", customerEmail: "fixture@example.invalid", customerCpf: "fixture-cpf", customerPhone: "", customerAddress: {}, cardToken: "fixture-card-token-sentinel", paymentMethodId: "visa", installments: 1 }),
  }));
  return { logs: JSON.stringify(logs), outbound, writes, response, body: await response.json() };
}

describe("Mercado Pago sensitive observability", () => {
  it("card tokenization has no console sink for tokens or SDK objects", () => {
    const { calls } = consoleCalls(readFileSync("src/components/checkout/PaymentColumn.tsx", "utf8"), "PaymentColumn.tsx");
    expect(calls).toHaveLength(0);
  });

  it("backend logs accept only constant messages and the existing authenticated user ID", () => {
    const { file, calls } = consoleCalls(backendSource, "process-credit-card.ts");
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      for (const arg of call.arguments) {
        expect(ts.isStringLiteral(arg) || arg.getText(file) === "claimsData.claims.sub").toBe(true);
      }
    }
  });

  it("token goes only to gateway transport, never to logs, responses or database writes", async () => {
    const result = await runBackend({ id: "fixture-payment", status: "approved", status_detail: "accredited", token: "fixture-card-token-sentinel", card: { number: "fixture-pan-sentinel", cvv: "fixture-cvv-sentinel" }, transaction_amount: 10 });
    expect(result.outbound).toHaveLength(1);
    expect(result.outbound[0].url).toBe("https://api.mercadopago.com/v1/payments");
    expect(JSON.parse(String(result.outbound[0].init.body)).token).toBe("fixture-card-token-sentinel");
    expect(result.outbound[0].init.headers).toMatchObject({ Authorization: "Bearer fixture-server-credential" });
    for (const sentinel of ["fixture-card-token-sentinel", "fixture-pan-sentinel", "fixture-cvv-sentinel", "fixture-server-credential"]) {
      expect(result.logs).not.toContain(sentinel);
      expect(JSON.stringify(result.body)).not.toContain(sentinel);
    }
    expect(result.body.success).toBe(true);
    expect(result.body.status).toBe("approved");
    expect(result.writes).toEqual([]);
  });

  it("credential-bearing exceptions are neither logged nor returned", async () => {
    const result = await runBackend({}, new Error("fixture-card-token-sentinel fixture-server-credential fixture-cvv-sentinel"));
    expect(result.response.status).toBe(500);
    expect(result.body).toEqual({ error: "Erro interno ao processar pagamento", status: "error" });
    expect(result.logs).not.toContain("fixture-card-token-sentinel");
    expect(result.logs).not.toContain("fixture-server-credential");
    expect(result.logs).not.toContain("fixture-cvv-sentinel");
    expect(result.writes).toEqual([]);
  });

  it("API error payloads with tokens are neither logged nor reflected", async () => {
    const result = await runBackend({ token: "fixture-card-token-sentinel", message: "fixture-server-credential", cause: [{ description: "fixture-cvv-sentinel" }] }, undefined, 400);
    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: "Erro ao processar pagamento. Tente novamente.", status: "error" });
    for (const sentinel of ["fixture-card-token-sentinel", "fixture-server-credential", "fixture-cvv-sentinel"]) {
      expect(result.logs).not.toContain(sentinel);
      expect(JSON.stringify(result.body)).not.toContain(sentinel);
    }
  });

  it("rejection keeps the existing payment outcome without exposing the raw response", async () => {
    const result = await runBackend({ id: "fixture-rejected-payment", status: "rejected", status_detail: "cc_rejected_insufficient_amount", token: "fixture-card-token-sentinel" });
    expect(result.response.status).toBe(200);
    expect(result.body.success).toBe(false);
    expect(result.body.status).toBe("rejected");
    expect(result.body.error).toBe("Pagamento recusado. Saldo insuficiente no cartão.");
    expect(result.logs).not.toContain("fixture-card-token-sentinel");
    expect(JSON.stringify(result.body)).not.toContain("fixture-card-token-sentinel");
    expect(result.writes).toEqual([]);
  });
});