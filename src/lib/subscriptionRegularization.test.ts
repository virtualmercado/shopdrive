import { describe, it, expect } from "vitest";
import { billingCtaPath, isRegularizationRoute, isRegularized, closedChargeMessage, REGULARIZATION_PATH } from "./subscriptionRegularization";

describe("regularization routing", () => {
  it("downgraded subscription (current plan gratis) opens the regularization, not a priceless checkout", () => {
    expect(billingCtaPath("gratis", "monthly")).toBe(REGULARIZATION_PATH);
  });
  it("MARCA banner opens the regularization of the same subscription", () => {
    expect(billingCtaPath("marca", "monthly")).toBe(REGULARIZATION_PATH);
  });
  it("PRO/PREMIUM keep the existing invoice flow", () => {
    expect(billingCtaPath("premium", "annual")).toBe("/gestor/checkout-assinatura?plano=premium&ciclo=anual&origem=regularizar&flow=pay_invoice");
  });
  it("router sends regularization and unpriceable invoice links to the regularization page", () => {
    expect(isRegularizationRoute(new URLSearchParams("flow=regularizar"))).toBe(true);
    expect(isRegularizationRoute(new URLSearchParams("plano=gratis&flow=pay_invoice"))).toBe(true);
    expect(isRegularizationRoute(new URLSearchParams("plano=pro&flow=pay_invoice"))).toBe(false);
    expect(isRegularizationRoute(new URLSearchParams("plano=marca"))).toBe(false);
  });
});

describe("regularization outcome", () => {
  it("only a server-applied payment is success", () => {
    expect(isRegularized("paid")).toBe(true);
    for (const s of ["pending", "failed", "expired", "cancelled", "busy"]) expect(isRegularized(s)).toBe(false);
  });
  it("rejected and expired charges ask for a new PIX", () => {
    expect(closedChargeMessage("failed")).toMatch(/não foi aprovado/);
    expect(closedChargeMessage("expired")).toMatch(/expirou/);
    expect(closedChargeMessage("pending")).toBeNull();
  });
});
