import type { EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { PagePlan } from "./composer";
import { PAGE, mix } from "./theme";

/** Abertura de seção: foto à esquerda e bloco de cor à direita; sem foto, composição tipográfica. */
export const renderSeparator = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "separator" }>) => {
  const t = ctx.theme;
  const M = PAGE.margin;
  const img = ctx.image(plan.image);
  const fg = t.onPrimary;
  const soft = mix(t.primary, fg, 0.6);
  const idx = String(plan.index).padStart(2, "0");
  const label = `${plan.productCount} ${plan.productCount === 1 ? "produto" : "produtos"}`;

  if (img) {
    const split = 118;
    cv.rect({ x: 0, y: 0, w: split, h: PAGE.h }, t.imageBg);
    cv.imageCover(img, { x: 0, y: 0, w: split, h: PAGE.h });
    cv.rect({ x: split, y: 0, w: PAGE.w - split, h: PAGE.h }, t.primary);
    const x = split + 10, w = PAGE.w - split - 10 - M;
    cv.text([idx], x, 40, 40, mix(t.primary, fg, 0.3), { style: "bold", label: "sep-index" });
    let y = 150;
    cv.line(x, y, x + 14, y, fg, 1);
    y += 7;
    y += cv.text(cv.wrap(plan.title, w, 4), x, y, 24, fg, { style: "bold", leading: 1.1, label: "sep-title", minSize: 14 }) + 5;
    if (plan.subtitle) y += cv.text(cv.wrap(plan.subtitle, w, 3), x, y, 10, soft) + 4;
    cv.text([label.toUpperCase()], x, y + 2, 8, soft, { style: "bold", charSpace: 0.6, label: "sep-count" });
    cv.text(cv.wrap(ctx.doc.identity.storeName, w, 1), x, PAGE.h - M - 3, 8, soft, { label: "sep-store", width: w });
  } else {
    cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, t.primary);
    const w = PAGE.w - M * 2;
    cv.text([idx], M, 60, 110, mix(t.primary, fg, 0.18), { style: "bold", label: "sep-index" });
    let y = 170;
    cv.line(M, y, M + 22, y, fg, 1.2);
    y += 8;
    y += cv.text(cv.wrap(plan.title, w, 3), M, y, 36, fg, { style: "bold", leading: 1.05, label: "sep-title", minSize: 18 }) + 6;
    if (plan.subtitle) y += cv.text(cv.wrap(plan.subtitle, w, 3), M, y, 12, soft) + 4;
    cv.text([label.toUpperCase()], M, y + 2, 9, soft, { style: "bold", charSpace: 0.6, label: "sep-count" });
    cv.text(cv.wrap(ctx.doc.identity.storeName, w, 1), M, PAGE.h - M - 3, 8, soft, { label: "sep-store", width: w });
  }
};
