import { describe, expect, it } from "vitest";
import {
  EMPTY_MAIN_BANNER_CONTENT,
  getContrastingTextColor,
  hasStructuredBannerContent,
  isSafeBannerUrl,
  normalizeMainBannerContent,
  removeMainBannerContentAt,
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

  it("keeps old image-only banners without an overlay", () => expect(hasStructuredBannerContent(undefined)).toBe(false));
  it("renders a title by itself", () => expect(hasStructuredBannerContent({ ...EMPTY_MAIN_BANNER_CONTENT, title: "Título" })).toBe(true));
  it("renders title and subtitle", () => expect(hasStructuredBannerContent({ ...EMPTY_MAIN_BANNER_CONTENT, title: "Título", subtitle: "Texto" })).toBe(true));
  it("renders title, subtitle and valid CTA", () => expect(hasStructuredBannerContent({ ...EMPTY_MAIN_BANNER_CONTENT, title: "Título", subtitle: "Texto", ctaText: "Ver", ctaUrl: "/produtos" })).toBe(true));
  it.each(["left", "center", "right"] as const)("accepts %s alignment", (contentPosition) => expect(normalizeMainBannerContent([{ contentPosition }])[0].contentPosition).toBe(contentPosition));
  it("uses black text over a light button", () => expect(getContrastingTextColor("#FFFFFF")).toBe("#000000"));
  it("uses white text over a dark button", () => expect(getContrastingTextColor("#000000")).toBe("#FFFFFF"));
  it("preserves four independent slides", () => expect(normalizeMainBannerContent([{ title: "1" }, { title: "2" }, { title: "3" }, { title: "4" }]).map((item) => item.title)).toEqual(["1", "2", "3", "4"]));
  it("limits metadata to four slides", () => expect(normalizeMainBannerContent([{}, {}, {}, {}, {}])).toHaveLength(4));
  it("accepts product routes", () => expect(isSafeBannerUrl("/produto/item-1")).toBe(true));
  it("accepts category routes", () => expect(isSafeBannerUrl("/categoria/naturais")).toBe(true));
  it("accepts promotion routes", () => expect(isSafeBannerUrl("/promocoes")).toBe(true));
  it("accepts secure external URLs", () => expect(isSafeBannerUrl("https://example.com/oferta?q=1")).toBe(true));
  it("rejects javascript URLs", () => expect(isSafeBannerUrl("javascript:alert(1)")).toBe(false));
  it("rejects vbscript URLs", () => expect(isSafeBannerUrl("vbscript:msgbox(1)")).toBe(false));
  it("rejects data URLs", () => expect(isSafeBannerUrl("data:text/html;base64,WA==")).toBe(false));
  it("rejects protocol-relative URLs", () => expect(isSafeBannerUrl("//example.com")).toBe(false));
  it("treats HTML in titles as plain data", () => expect(normalizeMainBannerContent([{ title: "<script>alert(1)</script>" }])[0].title).toBe("<script>alert(1)</script>"));
  it("rejects text beyond title limits", () => expect(normalizeMainBannerContent([{ title: "x".repeat(61) }])[0].title).toBe(""));
  it("rejects text beyond subtitle limits", () => expect(normalizeMainBannerContent([{ subtitle: "x".repeat(121) }])[0].subtitle).toBe(""));
  it("rejects text beyond CTA limits", () => expect(normalizeMainBannerContent([{ ctaText: "x".repeat(31) }])[0].ctaText).toBe(""));
  it("does not show a CTA without a destination", () => expect(hasStructuredBannerContent({ ...EMPTY_MAIN_BANNER_CONTENT, ctaText: "Comprar" })).toBe(false));
  it("removes metadata with its desktop slide", () => expect(removeMainBannerContentAt(normalizeMainBannerContent([{ title: "A" }, { title: "B" }]), 0)[0].title).toBe("B"));
  it("does not mutate metadata when normalizing", () => {
    const source = [{ title: "A" }];
    normalizeMainBannerContent(source);
    expect(source).toEqual([{ title: "A" }]);
  });
  it("keeps missing fields optional", () => expect(normalizeMainBannerContent([{ subtitle: "Só subtítulo" }])[0]).toMatchObject({ title: "", subtitle: "Só subtítulo", ctaText: "" }));
});