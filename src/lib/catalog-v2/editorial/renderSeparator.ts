import type { EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { PagePlan } from "./composer";
import { PAGE, mix, type RGB } from "./theme";

/**
 * Bloco tipográfico (linha, título, subtítulo, quantidade) medido antes de
 * desenhar, para centralizar verticalmente dentro da área de cor.
 */
const drawTitleBlock = (cv: EditorialCanvas, x: number, w: number, top: number, bottom: number, title: string, subtitle: string | null, label: string, sizes: { title: number; min: number; lines: number }, fg: RGB, soft: RGB) => {
  const t = cv.fitTitle(title, w, sizes.title, sizes.min, sizes.lines);
  cv.font(11);
  const sub = subtitle ? cv.wrapNow(subtitle, w, 3) : [];
  const titleH = cv.lineH(t.size, 1.08) * (t.lines.length - 1) + t.size * 0.3528;
  const subH = sub.length ? cv.lineH(11, 1.35) * (sub.length - 1) + 11 * 0.3528 + 5 : 0;
  const blockH = 8 + titleH + 6 + subH + 8.5 * 0.3528;
  let y = Math.max(top, top + (bottom - top - blockH) / 2);
  cv.line(x, y, x + 16, y, fg, 1.1);
  y += 8;
  y += cv.text(t.lines, x, y, t.size, fg, { style: "bold", leading: 1.08, label: "sep-title" }) + 6;
  if (sub.length) y += cv.text(sub, x, y, 11, soft, { leading: 1.35, label: "sep-subtitle" }) + 5;
  cv.text([label.toUpperCase()], x, y, 8.5, soft, { style: "bold", charSpace: 0.7, label: "sep-count" });
};

/**
 * Abertura de seção. Foto vertical: coluna à esquerda + cor à direita.
 * Foto horizontal/quadrada: faixa no topo + cor embaixo. Sem foto: tipográfica.
 */
export const renderSeparator = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "separator" }>) => {
  const t = ctx.theme;
  const M = PAGE.margin;
  // Ícone/logo da categoria ou marca: nunca recortado; vai num cartão sobre a página tipográfica.
  const emblem = plan.imageSource === "ref" ? ctx.image(plan.image) : null;
  const img = plan.imageSource === "ref" ? null : ctx.image(plan.image);
  const fg = t.onPrimary;
  const soft = mix(t.primary, fg, 0.68);
  const faint = mix(t.primary, fg, 0.3);
  const idx = String(plan.index).padStart(2, "0");
  const label = `${plan.productCount} ${plan.productCount === 1 ? "produto" : "produtos"}`;
  const store = ctx.doc.identity.storeName;

  if (img && img.width / img.height < 0.8) {
    const split = 112;
    cv.rect({ x: 0, y: 0, w: split, h: PAGE.h }, t.imageBg);
    cv.imageCover(img, { x: 0, y: 0, w: split, h: PAGE.h });
    cv.rect({ x: split, y: 0, w: PAGE.w - split, h: PAGE.h }, t.primary);
    const x = split + 11, w = PAGE.w - split - 11 - M;
    cv.text([idx], x, M + 10, 44, faint, { style: "bold", label: "sep-index" });
    drawTitleBlock(cv, x, w, 90, PAGE.h - M - 20, plan.title, plan.subtitle, label, { title: 24, min: 14, lines: 5 }, fg, soft);
    cv.text(cv.wrap(store, w, 1), x, PAGE.h - M - 3, 8, soft, { label: "sep-store", width: w });
  } else if (img) {
    const imgH = 158;
    cv.rect({ x: 0, y: 0, w: PAGE.w, h: imgH }, t.imageBg);
    cv.imageCover(img, { x: 0, y: 0, w: PAGE.w, h: imgH });
    cv.rect({ x: 0, y: imgH, w: PAGE.w, h: PAGE.h - imgH }, t.primary);
    const w = PAGE.w - M * 2 - 40;
    cv.text([idx], PAGE.w - M - 40, imgH + 14, 40, faint, { style: "bold", align: "right", width: 40, label: "sep-index" });
    drawTitleBlock(cv, M, w, imgH + 14, PAGE.h - M - 14, plan.title, plan.subtitle, label, { title: 30, min: 16, lines: 3 }, fg, soft);
    cv.text(cv.wrap(store, PAGE.w - M * 2, 1), M, PAGE.h - M - 3, 8, soft, { label: "sep-store" });
  } else {
    cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, t.primary);
    const w = PAGE.w - M * 2;
    if (emblem) {
      const box = { x: PAGE.w - M - 44, y: M + 6, w: 44, h: 44 };
      cv.rect(box, t.paper, 4);
      cv.imageContain(emblem, box, 5);
    }
    cv.text([idx], M, 50, 110, mix(t.primary, fg, 0.16), { style: "bold", label: "sep-index" });
    drawTitleBlock(cv, M, w, 150, PAGE.h - M - 20, plan.title, plan.subtitle, label, { title: 36, min: 18, lines: 3 }, fg, soft);
    cv.text(cv.wrap(store, w, 1), M, PAGE.h - M - 3, 8, soft, { label: "sep-store", width: w });
  }
};
