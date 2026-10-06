import type { EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { PagePlan } from "./composer";
import { PAGE, mix } from "./theme";

/** Capa editorial: foto em sangria + painel tipográfico com a identidade da loja. */
export const renderCover = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "cover" }>) => {
  const { theme: t, doc } = ctx;
  const M = PAGE.margin;
  const hero = ctx.image(plan.heroImage);
  const heroH = hero ? 172 : 0;

  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, hero ? t.paper : t.primary);

  if (hero) {
    cv.rect({ x: 0, y: 0, w: PAGE.w, h: heroH }, t.imageBg);
    cv.imageCover(hero, { x: 0, y: 0, w: PAGE.w, h: heroH });
    cv.rect({ x: 0, y: heroH, w: PAGE.w, h: PAGE.h - heroH }, t.primary);
  }

  const fg = t.onPrimary;
  const soft = mix(t.primary, fg, 0.62);

  // Logo em cartão branco (fica legível sobre foto ou cor).
  const logoBox = { x: M, y: M, w: 34, h: 20 };
  if (ctx.logo) {
    cv.rect(logoBox, t.paper, 2.5);
    cv.imageContain(ctx.logo, logoBox, 2.5);
  }

  const top = hero ? heroH + 16 : 120;
  const w = PAGE.w - M * 2 - 10;
  cv.line(M, top, M + 18, top, t.accent === t.primary ? fg : t.accent, 1.2);
  let y = top + 7;
  y += cv.text(cv.wrap(ctx.doc.identity.storeName.toUpperCase(), w, 1), M, y, 10, soft, { style: "bold", charSpace: 0.8, label: "cover-store" }) + 5;
  cv.font(34, "bold");
  y += cv.text(cv.wrap(ctx.title, w, 2), M, y, 34, fg, { style: "bold", leading: 1.05, label: "cover-title" }) + 5;
  if (ctx.subtitle) y += cv.text(cv.wrap(ctx.subtitle, w, 2), M, y, 12, soft, { label: "cover-subtitle" }) + 4;

  const footY = PAGE.h - M - 4;
  const count = `${doc.products.length} ${doc.products.length === 1 ? "produto" : "produtos"}`;
  const year = new Date(doc.meta.generatedAt).getFullYear();
  cv.text([`${count}  ·  ${year}`], M, footY, 9, soft, { label: "cover-meta" });
  if (doc.identity.publicUrl) {
    const url = doc.identity.publicUrl.replace(/^https?:\/\//, "");
    cv.font(9);
    const uw = cv.pdf.getTextWidth(url);
    cv.text([url], PAGE.w - M - uw, footY, 9, fg, { style: "bold", label: "cover-url" });
    cv.link({ x: PAGE.w - M - uw, y: footY - 1, w: uw, h: 5 }, doc.identity.publicUrl);
  }
};
