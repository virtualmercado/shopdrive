import { describe, it, expect, vi } from "vitest";
import {
  htmlToCatalogText,
  buildCatalogProductUrl,
  buildCatalogStoreUrl,
  createCatalogImageLoader,
  fitWithinEdge,
} from "./catalogPdfClassic";

describe("htmlToCatalogText", () => {
  it("removes tags and keeps paragraphs", () => {
    const out = htmlToCatalogText("<p><strong>Chá</strong> de açaí</p><p>Linha 2<br>Linha 3</p>");
    expect(out).toBe("Chá de açaí\n\nLinha 2\nLinha 3");
  });
  it("renders lists as bullets and decodes entities", () => {
    expect(htmlToCatalogText("<ul><li>Coração</li><li>A &amp; B&nbsp;100g</li></ul>")).toBe("• Coração\n• A & B 100g");
  });
  it("drops scripts entirely", () => {
    expect(htmlToCatalogText('<p>ok</p><script>alert(1)</script><img src=x onerror="x">')).toBe("ok");
  });
});

describe("catalog links", () => {
  it("always use the public ShopDrive origin with tracking", () => {
    expect(buildCatalogProductUrl("aroma", "p1")).toBe("https://shopdrive.com.br/aroma/produto/p1?src=catalogo_pdf");
    expect(buildCatalogStoreUrl("aroma")).toBe("https://shopdrive.com.br/aroma");
  });
});

describe("image loader", () => {
  it("decodes a repeated image once and survives failures", async () => {
    const decode = vi.fn(async (url: string) =>
      url === "bad" ? null : { data: "d", width: 10, height: 10, format: "JPEG" as const },
    );
    const loader = createCatalogImageLoader(decode);
    const a = await loader.load("u", false, 400);
    const b = await loader.load("u", false, 400);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(a?.alias).toBe(b?.alias);
    expect(await loader.load("bad", false, 400)).toBeNull();
  });
  it("downscales keeping aspect ratio and never upscales", () => {
    expect(fitWithinEdge(4000, 2000, 800)).toEqual({ width: 800, height: 400 });
    expect(fitWithinEdge(300, 200, 800)).toEqual({ width: 300, height: 200 });
  });
});
