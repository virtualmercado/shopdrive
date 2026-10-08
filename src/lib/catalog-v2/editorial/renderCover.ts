import type { EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { PagePlan } from "./composer";
import { PAGE, type RGB } from "./theme";

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

  const w = PAGE.w - M * 2 - 6;
  const footY = PAGE.h - M - 4;
  const title = cv.fitTitle(ctx.title, w, 32, 20, 3);
  cv.font(12);
  const sub = ctx.subtitle ? cv.wrapNow(ctx.subtitle, w, 2) : [];
  const titleH = cv.lineH(title.size, 1.08) * (title.lines.length - 1) + title.size * 0.3528;
  const blockH = 7 + 10 * 0.3528 + 6 + titleH + (sub.length ? 5 + cv.lineH(12, 1.3) * (sub.length - 1) + 12 * 0.3528 : 0);
  const areaTop = COVER_VISUAL_H + 12;
  const areaBottom = footY - 10;
  const top = Math.max(areaTop, areaTop + (areaBottom - areaTop - blockH) * 0.4);

  cv.line(M, top, M + 18, top, fg, 1.2);
  let y = top + 7;
  y += cv.text(cv.wrap(doc.identity.storeName.toUpperCase(), w, 1), M, y, 10, soft, { style: "bold", charSpace: 0.8, label: "cover-store" }) + 6;
  y += cv.text(title.lines, M, y, title.size, fg, { style: "bold", leading: 1.08, label: "cover-title" }) + 5;
  if (sub.length) cv.text(sub, M, y, 12, soft, { leading: 1.3, label: "cover-subtitle" });

  const count = `${doc.products.length} ${doc.products.length === 1 ? "produto" : "produtos"}`;
  const year = new Date(doc.meta.generatedAt).getFullYear();
  cv.line(M, footY - 5, PAGE.w - M, footY - 5, custom ? WHITE : t.hairline, 0.25);
  const meta = [ctx.coverOptions.showCount ? count : null, ctx.coverOptions.showYear ? String(year) : null].filter(Boolean).join("  ·  ");
  if (meta) cv.text([meta], M, footY, 9, soft, { label: "cover-meta" });
  if (doc.identity.publicUrl) {
    const url = doc.identity.publicUrl.replace(/^https?:\/\//, "");
    cv.font(9, "bold");
    const uw = cv.pdf.getTextWidth(url);
    cv.text([url], PAGE.w - M - uw, footY, 9, fg, { style: "bold", label: "cover-url" });
    cv.link({ x: PAGE.w - M - uw, y: footY - 1, w: uw, h: 5 }, doc.identity.publicUrl);
  }
};
