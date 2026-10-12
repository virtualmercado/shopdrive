import type { EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { PagePlan } from "./composer";
import { PAGE, type RGB } from "./theme";

/** Faixa superior da imagem personalizada da abertura de seção (mm). A interface calcula a recomendação a partir daqui. */
export const SEPARATOR_BAND = { x: 0, y: 0, w: PAGE.w, h: 158 } as const;
/** Logo discreta do modo Padrão (mesmo princípio da apresentação institucional). */
export const SEPARATOR_LOGO_MAX = { w: 32, h: 18 } as const;

const drawTitleBlock = (cv: EditorialCanvas, x: number, w: number, top: number, bottom: number, title: string, subtitle: string | null, label: string, sizes: { title: number; min: number; lines: number }, fg: RGB, soft: RGB, accent: RGB) => {
  const t = cv.fitTitle(title, w, sizes.title, sizes.min, sizes.lines);
  cv.font(11);
  const sub = subtitle ? cv.wrapNow(subtitle, w, 3) : [];
  const titleH = cv.lineH(t.size, 1.08) * (t.lines.length - 1) + t.size * 0.3528;
  const subH = sub.length ? cv.lineH(11, 1.35) * (sub.length - 1) + 11 * 0.3528 + 5 : 0;
  const blockH = 8 + titleH + 6 + subH + 8.5 * 0.3528;
  let y = Math.max(top, top + (bottom - top - blockH) / 2);
  cv.line(x, y, x + 16, y, accent, 1.1);
  y += 8;
  y += cv.text(t.lines, x, y, t.size, fg, { style: "bold", leading: 1.08, label: "sep-title" }) + 6;
  if (sub.length) y += cv.text(sub, x, y, 11, soft, { leading: 1.35, label: "sep-subtitle" }) + 5;
  cv.text([label.toUpperCase()], x, y, 8.5, soft, { style: "bold", charSpace: 0.7, label: "sep-count" });
};

const FAINT: RGB = [229, 231, 235];

/**
 * Abertura de seção (categoria/marca), sempre sobre fundo branco:
 * - Imagem personalizada: cover só na faixa superior; textos abaixo; sem logo sobreposta.
 * - Padrão (ou imagem que falhou): logo discreta no canto superior esquerdo; sem foto nem bloco de cor.
 */
export const renderSeparator = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "separator" }>) => {
  const t = ctx.theme;
  const M = PAGE.margin;
  const img = plan.imageSource === "custom" ? ctx.image(plan.image) : null;
  const fg = t.ink, soft = t.muted;
  const idx = String(plan.index).padStart(2, "0");
  const label = `${plan.productCount} ${plan.productCount === 1 ? "produto" : "produtos"}`;
  const store = ctx.doc.identity.storeName;
  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, t.paper);

  if (img) {
    const imgH = SEPARATOR_BAND.h;
    cv.imageCover(img, SEPARATOR_BAND);
    const w = PAGE.w - M * 2 - 40;
    cv.text([idx], PAGE.w - M - 40, imgH + 14, 40, FAINT, { style: "bold", align: "right", width: 40, label: "sep-index" });
    drawTitleBlock(cv, M, w, imgH + 14, PAGE.h - M - 14, plan.title, plan.subtitle, label, { title: 30, min: 16, lines: 3 }, fg, soft, t.accent);
    cv.text(cv.wrap(store, PAGE.w - M * 2, 1), M, PAGE.h - M - 3, 8, soft, { label: "sep-store" });
  } else {
    const w = PAGE.w - M * 2;
    if (ctx.logo) {
      const s = Math.min(SEPARATOR_LOGO_MAX.w / ctx.logo.width, SEPARATOR_LOGO_MAX.h / ctx.logo.height);
      const lw = ctx.logo.width * s, lh = ctx.logo.height * s;
      cv.imageContain(ctx.logo, { x: M, y: M, w: lw, h: lh });
      cv.rects.push({ page: cv.page, kind: "image", x: M, y: M, w: lw, h: lh, label: "sep-logo" });
    }
    cv.text([idx], M, 50, 110, FAINT, { style: "bold", label: "sep-index" });
    drawTitleBlock(cv, M, w, 150, PAGE.h - M - 20, plan.title, plan.subtitle, label, { title: 36, min: 18, lines: 3 }, fg, soft, t.accent);
    cv.text(cv.wrap(store, w, 1), M, PAGE.h - M - 3, 8, soft, { label: "sep-store", width: w });
  }
};
