import { readFileSync } from "node:fs";
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

});
