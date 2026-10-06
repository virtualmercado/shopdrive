import type { EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { PagePlan } from "./composer";
import type { CommercialItem } from "./editorialConfig";
import { drawChrome } from "./renderProducts";
import { PAGE, type RGB } from "./theme";

const BODY: RGB = [55, 55, 62];

/** Ícones simples desenhados em vetor (sem fontes de ícone). */
const drawIcon = (cv: EditorialCanvas, key: CommercialItem["key"], cx: number, cy: number, bg: RGB, fg: RGB) => {
  const pdf = cv.pdf;
  cv.fill(bg);
  pdf.circle(cx, cy, 4.6, "F");
  cv.fill(fg);
  cv.stroke(fg);
  pdf.setLineWidth(0.45);
  if (key === "payment") {
    pdf.roundedRect(cx - 2.6, cy - 1.8, 5.2, 3.6, 0.5, 0.5, "S");
    pdf.rect(cx - 2.6, cy - 0.9, 5.2, 0.7, "F");
  } else if (key === "delivery") {
    pdf.rect(cx - 2.4, cy - 1.6, 4.8, 3.4, "S");
    pdf.line(cx - 2.4, cy - 0.3, cx + 2.4, cy - 0.3);
    pdf.line(cx, cy - 1.6, cx, cy - 0.3);
  } else if (key === "minimumOrder") {
    [-1.4, 0, 1.4].forEach((d, i) => pdf.line(cx - 2.2 + i * 0.6, cy + d, cx + 2.2, cy + d));
  } else {
    pdf.circle(cx, cy - 1.7, 0.45, "F");
    pdf.rect(cx - 0.35, cy - 0.6, 0.7, 2.6, "F");
  }
  cv.rects.push({ x: cx - 4.6, y: cy - 4.6, w: 9.2, h: 9.2, page: cv.page, kind: "shape", label: `com-icon-${key}` });
};

/** Condições comerciais: só os campos preenchidos, sem inferir nada. */
export const renderCommercial = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "commercial" }>) => {
  const t = ctx.theme;
  const M = PAGE.margin;
  const x = M + 6, w = PAGE.w - M * 2 - 12;
  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, t.paper);
  drawChrome(cv, ctx, "Condições comerciais", cv.page);

  let y = M + PAGE.headerH + 14;
  cv.line(x, y, x + 16, y, t.accent, 1.1);
  y += 7;
  const title = cv.fitTitle(plan.title, w, 26, 16, 2);
  y += cv.text(title.lines, x, y, title.size, t.ink, { style: "bold", leading: 1.08, label: "com-title" }) + 7;
  if (plan.intro) {
    cv.font(11);
    y += cv.text(cv.wrapNow(plan.intro, w, 8), x, y, 11, BODY, { leading: 1.45, label: "com-intro" }) + 10;
  }

  const tx = x + 16, tw = w - 16;
  cv.font(10.5);
  // Limite de 500 caracteres validado na configuração: cabe em até 12 linhas.
  const blocks = plan.items.map((it) => it.text.split("\n").flatMap((p) => cv.wrapNow(p, tw, 10)).slice(0, 12));
  const lh = cv.lineH(10.5, 1.45);
  const heights = blocks.map((l) => 7 + 5.5 + (l.length - 1) * lh + 10.5 * 0.3528);
  const natural = heights.reduce((a, b) => a + b, 0) + Math.max(0, plan.items.length - 1) * 7;
  // Poucos campos: distribui o espaço livre entre os blocos (sem criar conteúdo).
  const free = Math.max(0, PAGE.h - M - 30 - y - natural);
  const extra = plan.items.length > 1 ? Math.min(14, (free * 0.45) / (plan.items.length - 1)) : 0;
  y += Math.min(22, free * 0.12);
  plan.items.forEach((it, i) => {
    cv.line(x, y, x + w, y, t.hairline, 0.25);
    y += 7;
    drawIcon(cv, it.key, x + 4.6, y + 4.4, t.tint, t.primary);
    cv.text([it.label.toUpperCase()], tx, y, 8, t.primary, { style: "bold", charSpace: 0.7, label: `com-label-${it.key}` });
    y += 5.5 + cv.text(blocks[i], tx, y + 5.5, 10.5, BODY, { leading: 1.45, label: `com-text-${it.key}` }) + (i < plan.items.length - 1 ? 7 + extra : 0);
  });
};
