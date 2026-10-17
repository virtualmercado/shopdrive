import { describe, expect, it } from "vitest";
import { validCampaignInformation, validCampaignContent, validCampaignAudienceDates } from "./emailCampaignValidation";

describe("campaign stage validation", () => {
  it("accepts name and subject independently of message content", () => {
    expect(validCampaignInformation("Teste", "Assunto")).toBe(true);
    expect(validCampaignInformation("", "Assunto")).toBe(false);
  });
  it("requires nonempty content at the content stage", () => {
    expect(validCampaignContent(" \n ", "", "")).toBe(false);
    expect(validCampaignContent("Mensagem", "", "")).toBe(true);
  });
  it("requires valid HTTPS CTA when used", () => {
    expect(validCampaignContent("Mensagem", "Abrir", "http://shopdrive.com.br")).toBe(false);
    expect(validCampaignContent("Mensagem", "Abrir", "https://shopdrive.com.br")).toBe(true);
  });
  it("rejects reversed audience dates", () => {
    expect(validCampaignAudienceDates("2026-10-17", "2026-10-16")).toBe(false);
    expect(validCampaignAudienceDates("", "")).toBe(true);
  });
});