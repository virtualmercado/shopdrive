import type { EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { PagePlan } from "./composer";
import { PAGE, mix } from "./theme";

/**
 * Capa editorial: foto + painel tipográfico com a identidade da loja.
 * Foto horizontal/quadrada: sangria recortada ao centro. Vertical: foto inteira
 * sobre fundo suave (evita cortar o produto).
 */
export const renderCover = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "cover" }>) => {
  const { theme: t, doc } = ctx;
  const M = PAGE.margin;
  const hero = ctx.image(plan.heroImage);
  const heroH = hero ? 178 : 0;

  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, hero ? t.paper : t.primary);

  if (hero) {
    const box = { x: 0, y: 0, w: PAGE.w, h: heroH };
    cv.rect(box, t.imageBg);
    if (hero.width / hero.height >= 0.95) cv.imageCover(hero, box);
    else cv.imageContain(hero, { x: 0, y: M + 14, w: PAGE.w, h: heroH - M - 14 }, 8);
    cv.rect({ x: 0, y: heroH, w: PAGE.w, h: PAGE.h - heroH }, t.primary);
  }

  const fg = t.onPrimary;
  const soft = mix(t.primary, fg, 0.68);

  // Logo em cartão branco (legível sobre foto ou cor).
  if (ctx.logo && ctx.coverOptions.showLogo) {
    const logoBox = { x: M, y: M, w: 36, h: 21 };
    cv.rect(logoBox, t.paper, 2.5);
    cv.imageContain(ctx.logo, logoBox, 2.5);
  }

  const w = PAGE.w - M * 2 - 6;
  const footY = PAGE.h - M - 4;
  const title = cv.fitTitle(ctx.title, w, hero ? 32 : 38, 20, 3);
  cv.font(12);
  const sub = ctx.subtitle ? cv.wrapNow(ctx.subtitle, w, 2) : [];
  const titleH = cv.lineH(title.size, 1.08) * (title.lines.length - 1) + title.size * 0.3528;
  const blockH = 7 + 10 * 0.3528 + 6 + titleH + (sub.length ? 5 + cv.lineH(12, 1.3) * (sub.length - 1) + 12 * 0.3528 : 0);
  // Bloco centrado opticamente na área de cor, acima do rodapé.
  const areaTop = hero ? heroH + 12 : 96;
  const areaBottom = footY - 10;
  const top = Math.max(areaTop, areaTop + (areaBottom - areaTop - blockH) * (hero ? 0.4 : 0.55));

  cv.line(M, top, M + 18, top, t.accent === t.primary ? fg : t.accent, 1.2);
  let y = top + 7;
  y += cv.text(cv.wrap(doc.identity.storeName.toUpperCase(), w, 1), M, y, 10, soft, { style: "bold", charSpace: 0.8, label: "cover-store" }) + 6;
  y += cv.text(title.lines, M, y, title.size, fg, { style: "bold", leading: 1.08, label: "cover-title" }) + 5;
  if (sub.length) cv.text(sub, M, y, 12, soft, { leading: 1.3, label: "cover-subtitle" });

  const count = `${doc.products.length} ${doc.products.length === 1 ? "produto" : "produtos"}`;
  const year = new Date(doc.meta.generatedAt).getFullYear();
  cv.line(M, footY - 5, PAGE.w - M, footY - 5, mix(t.primary, fg, 0.25), 0.25);
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
