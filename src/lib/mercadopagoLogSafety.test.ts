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

interface BackendFixtureOptions {
  failure?: Error;
  gatewayStatus?: number;
  orderId?: string;
  orderRow?: { store_owner_id: string; payment_status: string; card_payment_id: string | null; total_amount?: number } | null;
  bodyAmount?: number;
  updateError?: boolean;
}

async function runBackend(gatewayReply: unknown, failureOrOptions?: Error | BackendFixtureOptions) {
  const options: BackendFixtureOptions = failureOrOptions instanceof Error
    ? { failure: failureOrOptions }
    : (failureOrOptions || {});
  const { failure, gatewayStatus = 200, orderId = "fixture-order-default", orderRow, updateError = false, bodyAmount = 10 } = options;
  const logs: unknown[][] = [];
  const outbound: { url: string; init: RequestInit }[] = [];
  const writes: string[] = [];
  const updates: { values: Record<string, unknown>; filters: string[] }[] = [];
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const client = {
    auth: { getClaims: async () => ({ data: { claims: { sub: "fixture-user" } }, error: null }) },
    from: () => ({
      select() { return this; }, eq() { return this; },
      single: async () => ({ data: { mercadopago_access_token: "fixture-server-credential", mercadopago_enabled: true, mercadopago_accepts_credit: true }, error: null }),
      maybeSingle: async () => ({
        data: orderRow === undefined
          ? { store_owner_id: "fixture-store", payment_status: "pending", card_payment_id: null, total_amount: 10 }
          : orderRow,
        error: null,
      }),
      insert: () => { writes.push("insert"); throw new Error("Writes forbidden in fixture"); },
      update: (values: Record<string, unknown>) => {
        writes.push("update");
        const filters: string[] = [];
        const chain = {
          eq: (col: string, val: unknown) => { filters.push(`${col}=${String(val)}`); return chain; },
          neq: (col: string, val: unknown) => { filters.push(`${col}!=${String(val)}`); return chain; },
          then: (resolve: (r: { error: Error | null }) => void) =>
            resolve({ error: updateError ? new Error("fixture-update-failure") : null }),
        };
        updates.push({ values, filters });
        return chain;
      },
    }),
  };
  const source = backendSource.replace(/^import .*;\n/gm, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  vm.runInNewContext(compiled, {
    serve: (fn: typeof handler) => { handler = fn; }, createClient: () => client,
    Deno: { env: { get: () => "fixture-environment" } }, Request, Response, Date, crypto,
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
    body: JSON.stringify({ amount: bodyAmount, storeOwnerId: "fixture-store", customerName: "Cliente Fictício", customerEmail: "fixture@example.invalid", customerCpf: "fixture-cpf", customerPhone: "", customerAddress: {}, cardToken: "fixture-card-token-sentinel", paymentMethodId: "visa", installments: 1, ...(orderId ? { orderId } : {}) }),
  }));
  return { logs: JSON.stringify(logs), outbound, writes, updates, response, body: await response.json() };
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
    const result = await runBackend({ token: "fixture-card-token-sentinel", message: "fixture-server-credential", cause: [{ description: "fixture-cvv-sentinel" }] }, { gatewayStatus: 400 });
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

describe("Mercado Pago transactional card flow", () => {
  it("charges the persisted order total, ignoring a forged request amount", async () => {
    const result = await runBackend({ id: "p1", status: "approved", transaction_amount: 10 }, { bodyAmount: 0.01 });
    expect(JSON.parse(String(result.outbound[0].init.body)).transaction_amount).toBe(10);
  });

  it("rejects card charges without a persisted order", async () => {
    const result = await runBackend({}, { orderRow: null });
    expect(result.outbound).toHaveLength(0);
  });

  const orderId = "11111111-2222-3333-4444-555555555555";

  it("uses a stable idempotency key and external_reference bound to the order", async () => {
    const result = await runBackend(
      { id: "fixture-payment", status: "approved", status_detail: "accredited", transaction_amount: 10 },
      { orderId },
    );
    expect(result.outbound).toHaveLength(1);
    const headers = result.outbound[0].init.headers as Record<string, string>;
    expect(headers["X-Idempotency-Key"]).toBe(`order-${orderId}`);
    expect(JSON.parse(String(result.outbound[0].init.body)).external_reference).toBe(orderId);
  });

  it("approval confirms the same pre-created order exactly once", async () => {
    const result = await runBackend(
      { id: "fixture-payment", status: "approved", status_detail: "accredited", transaction_amount: 10 },
      { orderId },
    );
    expect(result.body.success).toBe(true);
    expect(result.body.orderConfirmed).toBe(true);
    expect(result.body.message).toBe("Pagamento aprovado com sucesso!");
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].values).toMatchObject({
      status: "confirmed",
      payment_status: "approved",
      card_payment_id: "fixture-payment",
    });
    expect(result.updates[0].filters).toContain(`id=${orderId}`);
    expect(result.updates[0].filters).toContain("payment_status!=approved");
  });

  it("approval with a failed local confirmation never reports a generic payment error", async () => {
    const result = await runBackend(
      { id: "fixture-payment", status: "approved", status_detail: "accredited", transaction_amount: 10 },
      { orderId, updateError: true },
    );
    expect(result.body.success).toBe(true);
    expect(result.body.status).toBe("approved");
    expect(result.body.orderConfirmed).toBe(false);
    expect(result.body.message).toBe("Pagamento aprovado. Estamos confirmando seu pedido.");
    expect(JSON.stringify(result.body)).not.toContain("Erro ao processar pagamento");
  });

  it("an order already approved short-circuits without a new gateway charge", async () => {
    const result = await runBackend(
      { id: "fixture-payment", status: "approved" },
      { orderId, orderRow: { store_owner_id: "fixture-store", payment_status: "approved", card_payment_id: "fixture-existing-payment" } },
    );
    expect(result.outbound).toHaveLength(0);
    expect(result.body.success).toBe(true);
    expect(result.body.duplicate).toBe(true);
    expect(result.body.paymentId).toBe("fixture-existing-payment");
    expect(result.updates).toHaveLength(0);
  });

  it("rejection marks the same order rejected once so stock is returned a single time", async () => {
    const result = await runBackend(
      { id: "fixture-rejected", status: "rejected", status_detail: "cc_rejected_insufficient_amount" },
      { orderId },
    );
    expect(result.body.success).toBe(false);
    expect(result.body.status).toBe("rejected");
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].values).toMatchObject({
      payment_status: "rejected",
      card_payment_id: "fixture-rejected",
    });
    expect(result.updates[0].filters).toContain(`id=${orderId}`);
    expect(result.updates[0].filters).toContain("payment_status!=approved");
  });

  it("pending payment links the payment id to the order without confirming it", async () => {
    const result = await runBackend(
      { id: "fixture-pending", status: "pending", status_detail: "pending_review_manual" },
      { orderId },
    );
    expect(result.body.success).toBe(false);
    expect(result.body.status).toBe("pending");
    expect(result.body.orderConfirmed).toBe(false);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].values).toEqual({ card_payment_id: "fixture-pending" });
    expect(result.updates[0].filters).toContain("payment_status=pending");
  });
});