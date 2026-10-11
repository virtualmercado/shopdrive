import type { EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import { INSTITUTIONAL as L, type PagePlan } from "./composer";
import { drawChrome } from "./renderProducts";
import { PAGE } from "./theme";

const BODY: [number, number, number] = [55, 55, 62];

/** Faixa superior da imagem personalizada (mm). A interface calcula a recomendação a partir daqui. */
export const INSTITUTIONAL_BAND = { x: 0, y: 0, w: PAGE.w, h: 100 } as const;
/** Logo discreta do modo Padrão, no canto superior esquerdo. */
export const INSTITUTIONAL_LOGO_MAX = { w: 32, h: 18 } as const;

/**
 * Apresentação da loja. 1ª página:
 * - Padrão: fundo branco + logo discreta no canto superior esquerdo (sem bloco de cor).
 * - Imagem personalizada: imagem da loja em cover na faixa superior, sem logo sobreposta.
 * Continuações: cabeçalho padrão. As linhas já vêm quebradas pelo compositor.
 */
export const renderInstitutional = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "institutional" }>) => {
  const t = ctx.theme;
  const M = PAGE.margin;
  const img = plan.part === 1 ? ctx.image(plan.image) : null;
  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, t.paper);
  const store = ctx.doc.identity.storeName.toUpperCase();

  let y: number;
  if (plan.part > 1) {
    drawChrome(cv, ctx, `Apresentação · ${plan.part}/${plan.parts}`, cv.page);
    y = L.topNext;
  } else if (img) {
    cv.imageCover(img, INSTITUTIONAL_BAND);
    cv.text(cv.wrap(store, L.w, 1), L.x, 108, 8, t.muted, { style: "bold", charSpace: 0.8, label: "inst-store" });
    const title = cv.fitTitle(plan.title, L.w, 24, 16, 2);
    const th = cv.text(title.lines, L.x, 114, title.size, t.ink, { style: "bold", leading: 1.08, label: "inst-title" });
    cv.line(L.x, 114 + th + 4.5, L.x + 16, 114 + th + 4.5, t.accent, 1.1);
    drawChrome(cv, ctx, "", cv.page, false);
    y = L.topImage;
  } else {
    if (ctx.logo) {
      const s = Math.min(INSTITUTIONAL_LOGO_MAX.w / ctx.logo.width, INSTITUTIONAL_LOGO_MAX.h / ctx.logo.height);
      const w = ctx.logo.width * s, h = ctx.logo.height * s;
      cv.imageContain(ctx.logo, { x: M, y: M, w, h });
      cv.rects.push({ page: cv.page, kind: "image", x: M, y: M, w, h, label: "inst-logo" });
    }
    cv.text(cv.wrap(store, L.w, 1), L.x, 40, 8, t.muted, { style: "bold", charSpace: 0.8, label: "inst-store" });
    const title = cv.fitTitle(plan.title, L.w, 26, 16, 2);
    cv.text(title.lines, L.x, 47, title.size, t.ink, { style: "bold", leading: 1.08, label: "inst-title" });
    drawChrome(cv, ctx, "", cv.page, false);
    y = L.topPlain;
  }

  const lh = L.size * 0.3528 * L.leading;
  plan.blocks.forEach((lines) => {
    cv.text(lines, L.x, y, L.size, BODY, { leading: L.leading, label: "inst-text" });
    y += lines.length * lh + L.paraGap;
  });
  if (plan.part < plan.parts) cv.text(["continua →"], L.x, L.bottom + 2, 7.5, t.muted, { align: "right", width: L.w, label: "inst-continue" });
};
