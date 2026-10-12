import type { EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { PagePlan } from "./composer";
import { PAGE, type RGB } from "./theme";
import type { CoverTextKey } from "./coverTypography";

/** Altura da região visual superior da capa (logo no Padrão). Os textos ficam abaixo, nas posições de sempre. */
export const COVER_VISUAL_H = 178;
/** Limites da logo no modo Padrão: ~33% da largura da página. */
export const COVER_LOGO_MAX = { w: 70, h: 56 } as const;

/**
 * Capa editorial em dois modos:
 * - Padrão: página 100% branca, logo cadastrada centralizada (contain) na região superior.
 * - Personalizada: imagem enviada pela loja cobrindo a A4 inteira (cover, sem distorção).
 * Nunca usa foto de produto nem bloco com a cor da loja.
 */
export const renderCover = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "cover" }>) => {
  const { theme: t, doc } = ctx;
  const M = PAGE.margin;
  const custom = ctx.image(plan.heroImage);
  const WHITE: RGB = [255, 255, 255];

  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, WHITE);

  if (custom) {
    cv.imageCover(custom, { x: 0, y: 0, w: PAGE.w, h: PAGE.h });
  } else if (ctx.logo && ctx.coverOptions.showLogo) {
    const s = Math.min(COVER_LOGO_MAX.w / ctx.logo.width, COVER_LOGO_MAX.h / ctx.logo.height);
    const w = ctx.logo.width * s, h = ctx.logo.height * s;
    cv.imageContain(ctx.logo, { x: (PAGE.w - w) / 2, y: (COVER_VISUAL_H - h) / 2, w, h });
    cv.rects.push({ page: cv.page, kind: "image", x: (PAGE.w - w) / 2, y: (COVER_VISUAL_H - h) / 2, w, h, label: "cover-logo" });
  }

  const fg: RGB = custom ? WHITE : t.ink;
  const soft: RGB = custom ? WHITE : t.muted;
  // Tipografia escolhida pelo lojista: troca só família/peso/cor; tamanhos e posições são os de sempre.
  const typo = ctx.coverTypography;
  const use = (key: CoverTextKey, fallback: RGB): RGB => { cv.fontOverride = typo?.[key].font ?? null; return typo?.[key].color ?? fallback; };

  const w = PAGE.w - M * 2 - 6;
  const footY = PAGE.h - M - 4;
  const titleColor = use("title", fg);
  const title = cv.fitTitle(ctx.title, w, 32, 20, 3);
  const subColor = use("subtitle", soft);
  cv.font(12);
  const sub = ctx.subtitle ? cv.wrapNow(ctx.subtitle, w, 2) : [];
  cv.fontOverride = null;
  const titleH = cv.lineH(title.size, 1.08) * (title.lines.length - 1) + title.size * 0.3528;
  const blockH = 7 + 10 * 0.3528 + 6 + titleH + (sub.length ? 5 + cv.lineH(12, 1.3) * (sub.length - 1) + 12 * 0.3528 : 0);
  const areaTop = COVER_VISUAL_H + 12;
  const areaBottom = footY - 10;
  const top = Math.max(areaTop, areaTop + (areaBottom - areaTop - blockH) * 0.4);

  cv.line(M, top, M + 18, top, fg, 1.2);
  let y = top + 7;
  const storeColor = use("storeName", soft);
  y += cv.text(cv.wrap(doc.identity.storeName.toUpperCase(), w, 1), M, y, 10, storeColor, { style: "bold", charSpace: 0.8, label: "cover-store" }) + 6;
  use("title", fg);
  y += cv.text(title.lines, M, y, title.size, titleColor, { style: "bold", leading: 1.08, label: "cover-title" }) + 5;
  use("subtitle", soft);
  if (sub.length) cv.text(sub, M, y, 12, subColor, { leading: 1.3, label: "cover-subtitle" });
  cv.fontOverride = null;

  const count = `${doc.products.length} ${doc.products.length === 1 ? "produto" : "produtos"}`;
  const year = new Date(doc.meta.generatedAt).getFullYear();
  cv.line(M, footY - 5, PAGE.w - M, footY - 5, custom ? WHITE : t.hairline, 0.25);
  // Quantidade e ano na mesma linha, cada um com seu estilo; mesma posição de antes.
  const parts: { text: string; key: CoverTextKey | null; label: string }[] = [];
  if (ctx.coverOptions.showCount) parts.push({ text: count, key: "productCount", label: "cover-count" });
  if (ctx.coverOptions.showCount && ctx.coverOptions.showYear) parts.push({ text: "  ·  ", key: null, label: "cover-meta-sep" });
  if (ctx.coverOptions.showYear) parts.push({ text: String(year), key: "year", label: "cover-year" });
  if (parts.length) {
    let x = M, maxH = 0;
    parts.forEach((p) => {
      const color = p.key ? use(p.key, soft) : ((cv.fontOverride = null), soft);
      maxH = Math.max(maxH, cv.text([p.text], x, footY, 9, color, { label: p.label }));
      x += cv.pdf.getTextWidth(p.text);
    });
    cv.fontOverride = null;
    cv.rects.push({ page: cv.page, kind: "shape", x: M, y: footY, w: x - M, h: maxH, label: "cover-meta" });
  }
  if (doc.identity.publicUrl) {
    const url = doc.identity.publicUrl.replace(/^https?:\/\//, "");
    cv.font(9, "bold");
    const uw = cv.pdf.getTextWidth(url);
    cv.text([url], PAGE.w - M - uw, footY, 9, fg, { style: "bold", label: "cover-url" });
    cv.link({ x: PAGE.w - M - uw, y: footY - 1, w: uw, h: 5 }, doc.identity.publicUrl);
  }
};
