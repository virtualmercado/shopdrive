import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) }, rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuthContext: () => ({}) }));
vi.mock("./useMerchantStore", () => ({ useMerchantStore: () => ({}) }));

const { verifyAndProvision } = await import("./useMerchantDomain");

function respond(verifyState: string) {
  invoke.mockImplementation(async (name: string) =>
    name === "verify-custom-domain-dns" ? { data: { state: verifyState }, error: null } : { data: { v2_state: "routing_provisioning" }, error: null });
}
const hostnameCalls = () => invoke.mock.calls.filter(([n]) => n === "manage-custom-domain-hostname").map(([, o]) => (o as { body: { action: string } }).body.action);

describe("Custom Hostname is created only after an explicit verification proves DNS", () => {
  beforeEach(() => invoke.mockReset());
  it.each(["pending_ownership", "ownership_error", "dns_pending", "dns_error", "active", "inactive"])("%s never touches Cloudflare", async (s) => {
    respond(s); await verifyAndProvision(); expect(hostnameCalls()).toEqual([]);
  });
  it("dns_verified requests exactly one create", async () => {
    respond("dns_verified"); await verifyAndProvision(); expect(hostnameCalls()).toEqual(["create"]);
  });
  it.each(["routing_provisioning", "ssl_provisioning"])("%s only re-reads status", async (s) => {
    respond(s); await verifyAndProvision(); expect(hostnameCalls()).toEqual(["status"]);
  });
  it("a failed verification never creates", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "x", context: new Response(JSON.stringify({ error: "feature_unavailable" })) } });
    await expect(verifyAndProvision()).rejects.toThrow("feature_unavailable");
    expect(hostnameCalls()).toEqual([]);
  });
});
