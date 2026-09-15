import { describe, expect, it } from "vitest";
import {
  getContrastingTextColor,
  hasStructuredBannerContent,
  isSafeBannerUrl,
  normalizeMainBannerContent,
} from "./mainBannerContent";

describe("main banner content", () => {
  it("accepts internal and http links and rejects executable protocols", () => {
    expect(isSafeBannerUrl("/promocoes")).toBe(true);
    expect(isSafeBannerUrl("https://shopdrive.com.br/produto")).toBe(true);
    expect(isSafeBannerUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeBannerUrl("data:text/html,test")).toBe(false);
    expect(isSafeBannerUrl("//evil.example")).toBe(false);
  });

  it("chooses accessible CTA text colors", () => {
    expect(getContrastingTextColor("#F7E36D")).toBe("#000000");
    expect(getContrastingTextColor("#151515")).toBe("#FFFFFF");
  });

  it("renders only meaningful structured content", () => {
    expect(hasStructuredBannerContent(normalizeMainBannerContent([{}])[0])).toBe(false);
    expect(hasStructuredBannerContent(normalizeMainBannerContent([{ title: "Oferta" }])[0])).toBe(true);
    expect(hasStructuredBannerContent(normalizeMainBannerContent([{ ctaText: "Comprar", ctaUrl: "javascript:x" }])[0])).toBe(false);
  });

  it("normalizes invalid metadata safely", () => {
    const normalized = normalizeMainBannerContent([{ contentPosition: "outside", textColor: "red" }]);
    expect(normalized[0]?.contentPosition).toBe("left");
    expect(normalized[0]?.textColor).toBe("#FFFFFF");
  });
});