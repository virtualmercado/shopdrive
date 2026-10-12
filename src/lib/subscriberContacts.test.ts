import { describe, it, expect } from "vitest";
import { normalizePhoneBR, buildSubscribersCsv, primaryContactPhone, type SubscriberRow } from "./subscriberContacts";

describe("normalizePhoneBR", () => {
  it("formatted and digits-only inputs normalize equally", () => {
    expect(normalizePhoneBR("(92) 99999-9999")).toBe("5592999999999");
    expect(normalizePhoneBR("92999999999")).toBe("5592999999999");
  });
  it("keeps existing 55 prefix", () => {
    expect(normalizePhoneBR("+55 92 99999-9999")).toBe("5592999999999");
  });
  it("does not invent DDI for ambiguous numbers", () => {
    expect(normalizePhoneBR("99999-9999")).toBeNull();
    expect(normalizePhoneBR("")).toBeNull();
  });
});

const row = (o: Partial<SubscriberRow>): SubscriberRow => ({
  id: "1", store_name: "Loja", full_name: null, store_slug: "loja", account_status: "active",
  created_at: "2026-01-01T00:00:00Z", cpf_cnpj: null, address: null, address_number: null,
  address_complement: null, address_neighborhood: null, address_city: null, address_state: null,
  address_zip_code: null, account_email: "a@x.com", profile_email: null, phone: null, whatsapp: null,
  plan_code: "gratis", subscription_status: "free", filter_status: "inactive", product_count: 0,
  setup_status: null, progress_percent: null, ...o,
});

describe("contacts", () => {
  it("prefers WhatsApp over phone", () => {
    expect(primaryContactPhone({ whatsapp: "1", phone: "2" })).toBe("1");
    expect(primaryContactPhone({ whatsapp: null, phone: "2" })).toBe("2");
  });
  it("CSV has one line per row plus header, with BOM", () => {
    const csv = buildSubscribersCsv([row({}), row({ id: "2", whatsapp: "92999999999" })], (d) => d);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).toContain("5592999999999");
  });
});
