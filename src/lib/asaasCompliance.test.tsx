import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ASAAS_JOURNEY_STEPS,
  ASAAS_OFFICIAL_URL,
  ASAAS_REGULATORY_COPY,
  ASAAS_SEAL_ALLOWED_HOST,
  ASAAS_SEAL_ALT,
  ASAAS_SEAL_REQUIRED_ID,
  ASAAS_SEAL_URLS,
  ASAAS_SUPPORT,
  getAsaasSealUrl,
  parseAsaasHomologationAccess,
  resolveAsaasSealVariant,
} from "./asaasCompliance";
import { AsaasFinancialServicesSeal } from "@/components/asaas/AsaasFinancialServicesSeal";
import { AsaasFinancialSupportCard } from "@/components/asaas/AsaasFinancialSupportCard";
import { AsaasSubaccountFormPreview } from "@/components/asaas/AsaasSubaccountFormPreview";
import { delegatedMerchantRouteAllowed } from "./merchantStoreRules";

describe("Asaas BaaS Phase 2.5 compliance rules", () => {
  it("uses exclusively official baas.asaas.com URLs with the ShopDrive ID QB1VEH9J", () => {
    const variants = ["positive", "negative-black", "negative-white"] as const;
    for (const variant of variants) {
      const url = new URL(getAsaasSealUrl(variant));
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe(ASAAS_SEAL_ALLOWED_HOST);
      expect(url.searchParams.get("id")).toBe(ASAAS_SEAL_REQUIRED_ID);
    }
    expect(ASAAS_SEAL_URLS.positive).toBe(
      "https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=QB1VEH9J",
    );
    expect(ASAAS_SEAL_URLS["negative-black"]).toBe(
      "https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Preto.svg?id=QB1VEH9J",
    );
    expect(ASAAS_SEAL_URLS["negative-white"]).toBe(
      "https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Branco.svg?id=QB1VEH9J",
    );
  });

  it("selects positive seal for light surface and negative-white for dark surface", () => {
    expect(resolveAsaasSealVariant("light", false)).toBe("positive");
    expect(resolveAsaasSealVariant("dark", false)).toBe("negative-white");
    expect(resolveAsaasSealVariant("auto", false)).toBe("positive");
    expect(resolveAsaasSealVariant("auto", true)).toBe("negative-white");
    expect(resolveAsaasSealVariant("light", false, "negative-black")).toBe("negative-black");
  });

  it("renders clickable seal opening asaas.com in new tab without no-referrer on the img", () => {
    const lightHtml = renderToStaticMarkup(<AsaasFinancialServicesSeal surface="light" />);
    expect(lightHtml).toContain(`href="${ASAAS_OFFICIAL_URL}"`);
    expect(lightHtml).toContain('target="_blank"');
    expect(lightHtml).toContain('rel="noopener"');
    expect(lightHtml).toContain(
      'src="https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=QB1VEH9J"',
    );
    expect(lightHtml).toContain(`alt="${ASAAS_SEAL_ALT}"`);
    expect(lightHtml).toContain('width="160"');
    expect(lightHtml).toContain('height="48"');
    expect(lightHtml).not.toContain("no-referrer");
    expect(lightHtml).not.toContain("noreferrer");
    expect(lightHtml).not.toMatch(/filter|opacity-|mask-/);

    const darkHtml = renderToStaticMarkup(<AsaasFinancialServicesSeal surface="dark" />);
    expect(darkHtml).toContain(
      'src="https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Branco.svg?id=QB1VEH9J"',
    );
    expect(darkHtml).not.toContain("no-referrer");
  });

  it("keeps regulatory copy explicit and free of prohibited financial naming for ShopDrive", () => {
    const allCopy = [
      ASAAS_REGULATORY_COPY.cardTitle,
      ASAAS_REGULATORY_COPY.cardDescription,
      ASAAS_REGULATORY_COPY.cardProviderNotice,
      ASAAS_REGULATORY_COPY.pageTitle,
      ASAAS_REGULATORY_COPY.pageSubtitle,
      ASAAS_REGULATORY_COPY.transparencyPrimary,
      ASAAS_REGULATORY_COPY.transparencySecondary,
      ASAAS_REGULATORY_COPY.ownershipNotice,
      ...ASAAS_REGULATORY_COPY.termsReferencePoints,
      ASAAS_SUPPORT.title,
      ASAAS_SUPPORT.description,
      ASAAS_SUPPORT.shopdriveScope,
      ASAAS_SUPPORT.asaasScope,
    ].join(" ");

    expect(allCopy).toContain("serviços financeiros");
    expect(allCopy).toContain("Asaas");
    expect(allCopy).toContain("plataforma tecnológica");

    const prohibitedPatterns = [
      /ShopDrive\s+(Bank|Banco|Pay|Payments|Financeira|Wallet)/i,
      /(Banco|Conta|Conta financeira)\s+ShopDrive/i,
      /ShopDrive\s+fornece\s+conta\s+financeira/i,
      /ShopDrive\s+processa\s+boletos/i,
      /ShopDrive\s+recebe\s+os\s+valores/i,
    ];
    for (const pattern of prohibitedPatterns) {
      expect(allCopy).not.toMatch(pattern);
    }
  });

  it("renders official Asaas financial support channels separated from ShopDrive support", () => {
    const html = renderToStaticMarkup(<AsaasFinancialSupportCard />);
    expect(html).toContain("Suporte para serviços financeiros");
    expect(html).toContain("0800 009 0037");
    expect(html).toContain("contato@asaas.com.br");
    expect(html).toContain("Suporte ShopDrive:");
    expect(html).toContain("Suporte Asaas:");
  });

  it("renders homologation preview form with disabled final button and 5 journey steps", () => {
    expect(ASAAS_JOURNEY_STEPS).toHaveLength(5);
    const html = renderToStaticMarkup(
      <AsaasSubaccountFormPreview
        initialData={{
          name: "",
          email: "",
          cpfCnpj: "",
          phone: "",
          zipCode: "",
          address: "",
          addressNumber: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: "",
        }}
      />,
    );
    expect(html).toContain("Solicitar ativação");
    expect(html).toContain("disabled");
    expect(html).toContain("Disponível após conclusão da homologação BaaS.");
    expect(html).toContain("A conta Asaas será criada em nome do próprio lojista responsável por esta loja.");
  });

  it("fails closed on unauthorized, missing, or mismatched store homologation access responses", () => {
    const storeA = "11111111-1111-4111-8111-111111111111";
    const storeB = "22222222-2222-4222-8222-222222222222";
    expect(parseAsaasHomologationAccess(null, storeA).enabled).toBe(false);
    expect(parseAsaasHomologationAccess({ enabled: false, storeId: storeA }, storeA).enabled).toBe(false);
    expect(parseAsaasHomologationAccess({ enabled: true, storeId: storeB }, storeA).enabled).toBe(false);
    expect(parseAsaasHomologationAccess({ enabled: true, storeId: storeA }, storeA).enabled).toBe(true);
    expect(delegatedMerchantRouteAllowed("/lojista/payment-methods/asaas")).toBe(true);
  });
});