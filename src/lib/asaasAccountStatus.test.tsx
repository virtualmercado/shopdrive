import { describe, expect, it } from "vitest";
import {
  ASAAS_HOMOLOGATION_STORE_ID,
  asaasDocumentControls,
  parseAsaasMerchantStatus,
  resolveAsaasStatusForIdentity,
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

  it("prepares no-account, pending, rejected, review, communication and reconciliation without deriving approval", () => {
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
      expect(parseAsaasMerchantStatus(response(state, account)).state).not.toBe("active");
    }
    expect(parseAsaasMerchantStatus(response("unknown_future_state")).state).toBe("unavailable");
  });

  it("fails closed on mismatched state, invalid synchronization and missing account data", () => {
    expect(parseAsaasMerchantStatus(response("active", { ...approvedAccount, status: "under_review" })).state).toBe("unavailable");
    expect(parseAsaasMerchantStatus(response("active", { ...approvedAccount, lastSyncAt: "invalid" })).state).toBe("unavailable");
    expect(parseAsaasMerchantStatus(response("active", null)).state).toBe("unavailable");
    expect(parseAsaasMerchantStatus(response("no_account"))).toMatchObject({ state: "no_account", account: null });
  });

  it("keeps every document action disabled with or without a validated official URL", () => {
    for (const hasUrl of [false, true]) {
      const controls = asaasDocumentControls(hasUrl);
      expect(controls.redirectEnabled).toBe(false);
      expect(controls.uploadEnabled).toBe(false);
      expect(controls.faceRecognitionEnabled).toBe(false);
    }
    expect(asaasDocumentControls(false).channel).toBe("awaiting_official_url");
    expect(asaasDocumentControls(true).channel).toBe("validated_future_redirect");
  });

  it("drops the previous cadastral result on store switch and session termination", () => {
    const result = parseAsaasMerchantStatus(response("active"));
    const snapshot = { identity: `${ASAAS_HOMOLOGATION_STORE_ID}:${ASAAS_HOMOLOGATION_STORE_ID}`, result };
    expect(resolveAsaasStatusForIdentity(snapshot, snapshot.identity)).toBe(result);
    expect(resolveAsaasStatusForIdentity(snapshot, "another-actor:another-store")).toBeNull();
    expect(resolveAsaasStatusForIdentity(snapshot, null)).toBeNull();
    expect(resolveAsaasStatusForIdentity(null, snapshot.identity)).toBeNull();
  });
});
