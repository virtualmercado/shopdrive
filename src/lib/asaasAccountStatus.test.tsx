import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AsaasAccountStatusPanel, AsaasDocumentGuidance } from "@/components/asaas/AsaasAccountStatusPanel";
import {
  ASAAS_HOMOLOGATION_STORE_ID,
  asaasDocumentGuidance,
  parseAsaasMerchantStatus,
  type AsaasMerchantStatus,
} from "./asaasAccountStatus";

const approvedAccount = {
  storeId: ASAAS_HOMOLOGATION_STORE_ID,
  environment: "sandbox",
  status: "active",
  commercialStatus: "APPROVED",
  bankAccountStatus: "APPROVED",
  documentStatus: "APPROVED",
  generalApprovalStatus: "APPROVED",
  lastSyncAt: "2026-11-27T21:25:31.331Z",
};

function response(state: string, account: Record<string, unknown> | null = approvedAccount) {
  return {
    ok: true,
    state,
    environment: "sandbox",
    storeId: ASAAS_HOMOLOGATION_STORE_ID,
    ...(account ? { account } : {}),
  };
}

describe("Asaas merchant cadastral status", () => {
  it("accepts only the exact Sandbox homologation response and requires four approved areas for active", () => {
    const parsed = parseAsaasMerchantStatus(response("active"));
    expect(parsed.state).toBe("active");
    expect(parsed.account?.lastSyncAt).toBe("2026-11-27T21:25:31.331Z");
    expect(parseAsaasMerchantStatus(response("active", { ...approvedAccount, documentStatus: "PENDING" })).state).toBe("unavailable");
    expect(parseAsaasMerchantStatus(response("active", { ...approvedAccount, storeId: "another-store" })).state).toBe("unavailable");
    expect(parseAsaasMerchantStatus({ ...response("active"), environment: "production" }).state).toBe("unavailable");
    expect(parseAsaasMerchantStatus(null).state).toBe("unavailable");
  });

  it("prepares no-account, pending, rejected, review, communication, reconciliation and unavailable states", () => {
    expect(parseAsaasMerchantStatus(response("no_account", null)).state).toBe("no_account");
    const alternatives = [
      ["awaiting_documents", { ...approvedAccount, status: "awaiting_documents", documentStatus: "PENDING", generalApprovalStatus: "PENDING" }],
      ["under_review", { ...approvedAccount, status: "under_review", generalApprovalStatus: "AWAITING_APPROVAL" }],
      ["rejected", { ...approvedAccount, status: "rejected", generalApprovalStatus: "REJECTED" }],
      ["communication_failed", approvedAccount],
      ["reconciliation_required", approvedAccount],
    ] as const;
    for (const [state, account] of alternatives) {
      expect(parseAsaasMerchantStatus(response(state, account)).state).toBe(state);
    }
    expect(parseAsaasMerchantStatus(response("unknown_future_state")).state).toBe("unavailable");
  });

  it("renders the real approved panel with Sandbox, completed journey, four areas and financial blocking", () => {
    const status = parseAsaasMerchantStatus(response("active"));
    const html = renderToStaticMarkup(<AsaasAccountStatusPanel status={status} />);
    for (const text of [
      "Conta Asaas aprovada",
      "Ambiente Sandbox",
      "Jornada de ativação concluída",
      "Informações comerciais",
      "Informações bancárias",
      "Documentação",
      "Aprovação geral",
      "Última sincronização",
      "Nenhuma operação financeira real está habilitada",
    ]) expect(html).toContain(text);
    expect(html).toContain('data-status="active"');
    expect(html).not.toContain("Solicitar ativação");
    expect(html).not.toContain("wallet");
    expect(html).not.toContain("encrypted");
  });

  it("renders safe guidance for every alternative state without activation or financial actions", () => {
    const states: AsaasMerchantStatus["state"][] = [
      "no_account", "awaiting_documents", "under_review", "rejected",
      "communication_failed", "reconciliation_required", "unavailable",
    ];
    for (const state of states) {
      const account = state === "awaiting_documents"
        ? { ...approvedAccount, status: "awaiting_documents", documentStatus: "PENDING", generalApprovalStatus: "PENDING" }
        : state === "under_review"
          ? { ...approvedAccount, status: "under_review", generalApprovalStatus: "AWAITING_APPROVAL" }
          : state === "rejected"
            ? { ...approvedAccount, status: "rejected", generalApprovalStatus: "REJECTED" }
            : approvedAccount;
      const status = parseAsaasMerchantStatus(response(state, state === "no_account" ? null : account));
      const html = renderToStaticMarkup(<AsaasAccountStatusPanel status={status} />);
      expect(html).toContain(`data-status="${state}"`);
      expect(html).toContain("Nenhuma operação financeira real está habilitada");
      expect(html).not.toContain("Solicitar ativação");
    }
  });

  it("prepares orientation for presence or absence of a validated official URL without rendering or persisting a URL", () => {
    expect(asaasDocumentGuidance(false)).toContain("HTTPS");
    expect(asaasDocumentGuidance(true)).toContain("etapa futura autorizada");
    const withoutUrl = renderToStaticMarkup(<AsaasDocumentGuidance />);
    const withUrl = renderToStaticMarkup(<AsaasDocumentGuidance hasOfficialOnboardingUrl />);
    expect(withoutUrl).toContain("redirecionamento documental permanecem desabilitados");
    expect(withUrl).toContain("endereço documental oficial validado pelo backend");
    expect(withoutUrl).not.toContain("<a");
    expect(withUrl).not.toContain("<a");
  });
});
