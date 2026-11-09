import { describe, it, expect } from "vitest";
import {
  buildShippingProducts,
  classifyService,
  findQuote,
  maskCep,
  normalizeMelhorEnvioResponse,
} from "../../supabase/functions/_shared/melhorEnvioQuotes";
import { unavailableLabel } from "./shippingQuotes";

const correios = { id: 1, name: "Correios" };
const ok = (id: number, name: string, price: string, days: number) => ({
  id, name, price, custom_price: price, discount: "0.00", currency: "R$",
  delivery_time: days, delivery_range: { min: days - 1, max: days + 1 }, company: correios,
});
const err = (id: number, name: string, error: string) => ({ id, name, company: correios, error });

// Respostas reais (sanitizadas) capturadas em 09/11/2026.
const manausToManaus = [
  err(1, "PAC", "Transportadora não atende este trecho."),
  ok(2, "SEDEX", "16.11", 2),
  err(17, "Mini Envios", "Transportadora não atende este trecho."),
];
const manausToSaoPaulo = [ok(1, "PAC", "24.13", 15), ok(2, "SEDEX", "47.26", 2), ok(17, "Mini Envios", "18.85", 18)];

describe("normalização das cotações Correios", () => {
  it("PAC e Mini Envios rejeitados pelo provedor no trecho ficam indisponíveis e SEDEX continua", () => {
    const r = normalizeMelhorEnvioResponse(manausToManaus);
    expect(r.quotes.map((q) => q.service_key)).toEqual(["sedex"]);
    expect(r.quotes[0].custom_price).toBe(16.11);
    expect(r.services.find((s) => s.service_key === "pac")).toMatchObject({ available: false, reason: "route" });
    expect(r.services.find((s) => s.service_key === "mini_envios")).toMatchObject({ available: false, reason: "route" });
  });

  it("PAC e Mini Envios retornados com preço aparecem com o preço do próprio serviço", () => {
    const r = normalizeMelhorEnvioResponse(manausToSaoPaulo);
    expect(findQuote(r.quotes, "pac")?.custom_price).toBe(24.13);
    expect(findQuote(r.quotes, "sedex")?.custom_price).toBe(47.26);
    expect(findQuote(r.quotes, "mini_envios")?.custom_price).toBe(18.85);
    expect(r.services.every((s) => s.available)).toBe(true);
  });

  it("erro do Mini Envios não remove PAC nem SEDEX", () => {
    const r = normalizeMelhorEnvioResponse([
      ok(1, "PAC", "25.47", 15), ok(2, "SEDEX", "48.60", 2),
      err(17, "Mini Envios", "Valor segurado ultrapassa o limite máximo de R$ 111,93."),
    ]);
    expect(r.quotes.map((q) => q.service_key)).toEqual(["pac", "sedex"]);
    expect(r.services.find((s) => s.service_key === "mini_envios")?.reason).toBe("insurance");
  });

  it("classifica restrição de dimensões e peso", () => {
    const r = normalizeMelhorEnvioResponse([
      err(17, "Mini Envios", "Dimensões do objeto ultrapassam o limite da transportadora."),
      err(1, "PAC", "Peso do objeto ultrapassa o limite."),
    ]);
    expect(r.services.find((s) => s.service_key === "mini_envios")?.reason).toBe("dimensions");
    expect(r.services.find((s) => s.service_key === "pac")?.reason).toBe("weight");
    expect(unavailableLabel(r.services, "mini_envios")).toBe("Peso ou dimensões excedem o limite");
    expect(unavailableLabel(r.services, "pac")).toBe("Peso ou dimensões excedem o limite");
  });

  it("mensagem por trecho continua 'Não disponível para este CEP'", () => {
    const r = normalizeMelhorEnvioResponse(manausToManaus);
    expect(unavailableLabel(r.services, "pac")).toBe("Não disponível para este CEP");
    expect(unavailableLabel(r.services, "mini_envios")).toBe("Não disponível para este CEP");
  });

  it("nunca cria preço: preço zero, inválido ou sem prazo não é disponível", () => {
    const r = normalizeMelhorEnvioResponse([
      ok(1, "PAC", "0.00", 15),
      { ...ok(2, "SEDEX", "abc", 2) },
      { ...ok(17, "Mini Envios", "18.85", 18), delivery_time: null },
    ]);
    expect(r.quotes).toEqual([]);
    expect(r.services.every((s) => !s.available)).toBe(true);
  });

  it("serviço solicitado e não retornado fica indisponível", () => {
    const r = normalizeMelhorEnvioResponse([ok(2, "SEDEX", "12.12", 2)]);
    expect(r.services.find((s) => s.service_key === "pac")?.reason).toBe("not_returned");
  });

  it("identifica por ID estável e ignora outras transportadoras", () => {
    expect(classifyService({ id: 1, name: "PAC", company: { name: "Correios" } })).toBe("pac");
    expect(classifyService({ id: 2, name: "SEDEX", company: "Correios" })).toBe("sedex");
    expect(classifyService({ id: 17, name: "Mini Envios", company: "Correios" })).toBe("mini_envios");
    expect(classifyService({ id: 3, name: ".Package", company: { name: "Jadlog" } })).toBeNull();
    expect(classifyService({ id: 99, name: "Mini Envios", company: "Correios" })).toBe("mini_envios");
  });
});

describe("payload enviado ao provedor", () => {
  it("valor segurado é por unidade (não multiplicado pela quantidade)", () => {
    const [p] = buildShippingProducts([{ id: "a", width: 11, height: 2, length: 16, weight: 0.1, insurance_value: 40, quantity: 2 }]);
    expect(p.insurance_value).toBe(40);
    expect(p.quantity).toBe(2);
  });

  it("mantém unidades (cm/kg) sem conversão e usa os fallbacks já existentes", () => {
    const [full, empty] = buildShippingProducts([
      { id: "a", width: 5, height: 17, length: 5, weight: 0.25, insurance_value: 19.98, quantity: 3 },
      { id: "b", insurance_value: 10, quantity: 1 },
    ]);
    expect(full).toMatchObject({ width: 5, height: 17, length: 5, weight: 0.25, quantity: 3 });
    expect(empty).toMatchObject({ width: 11, height: 2, length: 16, weight: 0.3 });
  });

  it("decimal brasileiro em texto vira número, nunca concatenação", () => {
    const [p] = buildShippingProducts([{ id: "a", weight: "0,5", width: "11", height: "2", length: "16", quantity: "2" }]);
    expect(p.weight).toBe(0.5);
    expect(p.width).toBe(11);
    expect(p.quantity).toBe(2);
  });

  it("CEP aparece mascarado nos registros", () => {
    expect(maskCep("69077-190")).toBe("69077-***");
  });
});
