import type { EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import { INSTITUTIONAL as L, type PagePlan } from "./composer";
import { drawChrome } from "./renderProducts";
import { PAGE, mix } from "./theme";

const BODY: [number, number, number] = [55, 55, 62];

/**
 * Apresentação da loja. 1ª página: foto no topo (ou faixa de cor com logo) + título.
 * Continuações: cabeçalho padrão. As linhas já vêm quebradas pelo compositor
 * (mesma medição), então nada é cortado aqui.
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
    const box = { x: 0, y: 0, w: PAGE.w, h: 100 };
    cv.rect(box, t.imageBg);
    // Fotos panorâmicas preenchem a faixa; packshots/retratos ficam inteiros (contain).
    if (img.width / img.height >= 1.7) cv.imageCover(img, box);
    else cv.imageContain(img, { x: M, y: M + 4, w: PAGE.w - M * 2, h: box.h - M - 8 });
    cv.text(cv.wrap(store, L.w, 1), L.x, 108, 8, t.primary, { style: "bold", charSpace: 0.8, label: "inst-store" });
    const title = cv.fitTitle(plan.title, L.w, 24, 16, 2);
    const th = cv.text(title.lines, L.x, 114, title.size, t.ink, { style: "bold", leading: 1.08, label: "inst-title" });
    cv.line(L.x, 114 + th + 4.5, L.x + 16, 114 + th + 4.5, t.accent, 1.1);
    drawChrome(cv, ctx, "", cv.page, false);
    y = L.topImage;
  } else {
    cv.rect({ x: 0, y: 0, w: PAGE.w, h: 86 }, t.primary);
    const fg = t.onPrimary;
    if (ctx.logo) {
      const lb = { x: M, y: M, w: 32, h: 18 };
      cv.rect(lb, t.paper, 2.5);
      cv.imageContain(ctx.logo, lb, 2.5);
    }
    cv.text(cv.wrap(store, L.w, 1), L.x, 40, 8, mix(t.primary, fg, 0.68), { style: "bold", charSpace: 0.8, label: "inst-store" });
    const title = cv.fitTitle(plan.title, L.w, 26, 16, 2);
    cv.text(title.lines, L.x, 47, title.size, fg, { style: "bold", leading: 1.08, label: "inst-title" });
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
