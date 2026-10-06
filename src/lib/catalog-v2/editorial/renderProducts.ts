import { formatBRL, type Box, type EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { PagePlan } from "./composer";
import type { CatalogProduct } from "../types";
import { PAGE } from "./theme";

const M = PAGE.margin;
export const CONTENT: Box = { x: M, y: M + PAGE.headerH + 4, w: PAGE.w - M * 2, h: PAGE.h - M * 2 - PAGE.headerH - PAGE.footerH - 4 };

interface InfoScale { name: number; nameLines: number; desc: number; price: number; gap: number }

const SCALES: Record<1 | 2 | 3 | 4, InfoScale> = {
  1: { name: 20, nameLines: 2, desc: 10, price: 20, gap: 3 },
  2: { name: 14, nameLines: 3, desc: 9, price: 15, gap: 2.5 },
  3: { name: 14, nameLines: 2, desc: 9, price: 15, gap: 2.2 },
  4: { name: 11, nameLines: 2, desc: 8, price: 12.5, gap: 1.8 },
};

const descriptionOf = (p: CatalogProduct) => p.description.plainText.replace(/\n+/g, " ").trim();

/** Bloco de informações com reserva do rodapé (preço + botão) antes da descrição. */
const drawInfo = (cv: EditorialCanvas, ctx: RenderContext, p: CatalogProduct, b: Box, s: InfoScale) => {
  const t = ctx.theme;
  let y = b.y;
  const meta = [ctx.categoryName(p.categoryId), ctx.brandName(p.brandId)].filter(Boolean).join("  ·  ");
  if (meta) y += cv.text(cv.wrap(meta.toUpperCase(), b.w, 1), b.x, y, 6.8, t.muted, { style: "bold", charSpace: 0.4, label: "meta" }) + s.gap;
  y += cv.text(cv.wrap(p.name, b.w, s.nameLines), b.x, y, s.name, t.ink, { style: "bold", leading: 1.15, label: "name" }) + s.gap + 0.5;

  // Rodapé do bloco: preço à esquerda, botão à direita.
  const hasPromo = ctx.showPrices && !!p.price.promotional;
  const priceH = ctx.showPrices ? s.price * 0.3528 + (hasPromo ? 4.2 : 0) : 0;
  const btnH = 8 * 0.3528 + 5;
  const footH = Math.max(priceH, p.publicUrl ? btnH : 0);
  const footY = b.y + b.h - footH;

  const desc = descriptionOf(p);
  const descLH = cv.lineH(s.desc, 1.35);
  const room = footY - s.gap * 1.5 - y;
  const maxDesc = Math.max(0, Math.floor((room - s.desc * 0.3528) / descLH) + 1);
  if (desc && room > s.desc * 0.3528) {
    cv.text(cv.wrap(desc, b.w, maxDesc), b.x, y, s.desc, [82, 82, 91], { leading: 1.35, label: "desc" });
  }

  if (ctx.showPrices) {
    let py = footY + (footH - priceH);
    if (hasPromo) {
      const old = formatBRL(p.price.regular.amount);
      cv.text([old], b.x, py, 8, t.muted, { label: "price-old" });
      cv.font(8);
      const ow = cv.pdf.getTextWidth(old);
      cv.line(b.x, py + 1.45, b.x + ow, py + 1.45, t.muted, 0.25);
      py += 4.2;
    }
    cv.text([formatBRL(p.price.effective.amount)], b.x, py, s.price, t.price, { style: "bold", label: "price" });
  }
  if (p.publicUrl) {
    cv.font(8, "bold");
    const bw = cv.pdf.getTextWidth("Ver produto") + 10;
    cv.button("Ver produto", b.x + b.w - bw, footY + footH - btnH, p.publicUrl, t.accent, t.onAccent, 8);
  }
};

const drawImage = (cv: EditorialCanvas, ctx: RenderContext, p: CatalogProduct, b: Box, pad: number) => {
  const t = ctx.theme;
  cv.rect(b, t.imageBg, 2);
  const img = ctx.image(p.primaryImage);
  if (img) cv.imageContain(img, b, pad);
  else {
    const initial = (p.name.trim()[0] || "?").toUpperCase();
    cv.text([initial], b.x, b.y + b.h / 2 - 9, 44, t.tint.map((c) => c - 22) as typeof t.tint, { style: "bold", align: "center", width: b.w, label: "noimg" });
  }
  if (ctx.showPrices && p.price.discountPercent) {
    const label = `-${p.price.discountPercent}%`;
    cv.font(7.5, "bold");
    const w = cv.pdf.getTextWidth(label) + 6;
    cv.rect({ x: b.x + 3, y: b.y + 3, w, h: 6 }, t.primary, 3);
    cv.text([label], b.x + 3, b.y + 4.4, 7.5, t.onPrimary, { style: "bold", align: "center", width: w, label: "badge" });
  }
};

const drawChrome = (cv: EditorialCanvas, ctx: RenderContext, sectionTitle: string, pageNo: number) => {
  const t = ctx.theme;
  const w = PAGE.w - M * 2;
  cv.text(cv.wrap(ctx.doc.identity.storeName.toUpperCase(), w / 2 - 4, 1), M, M + 2, 7.5, t.primary, { style: "bold", charSpace: 0.6, label: "hdr-store" });
  const sec = cv.wrap(sectionTitle, w / 2 - 4, 1);
  cv.text(sec, M + w / 2 + 4, M + 2, 7.5, t.muted, { align: "right", width: w / 2 - 4, label: "hdr-section" });
  cv.line(M, M + PAGE.headerH - 2, PAGE.w - M, M + PAGE.headerH - 2, t.hairline, 0.25);
  const fy = PAGE.h - M - 3;
  cv.line(M, fy - 3, PAGE.w - M, fy - 3, t.hairline, 0.25);
  if (ctx.doc.identity.publicUrl) cv.text([ctx.doc.identity.publicUrl.replace(/^https?:\/\//, "")], M, fy, 7, t.muted, { label: "ftr-url" });
  cv.text([String(pageNo).padStart(2, "0")], M + w - 20, fy, 7, t.muted, { style: "bold", align: "right", width: 20, label: "ftr-page" });
};

export const renderProductsPage = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "products" }>) => {
  const products = plan.productIds.map(ctx.product);
  const s = SCALES[plan.layout];
  const C = CONTENT;
  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, ctx.theme.paper);
  drawChrome(cv, ctx, plan.sectionTitle, cv.page);

  if (plan.layout === 1) {
    const p = products[0];
    const imgH = 168;
    drawImage(cv, ctx, p, { x: C.x, y: C.y, w: C.w, h: imgH }, 10);
    drawInfo(cv, ctx, p, { x: C.x + 4, y: C.y + imgH + 9, w: C.w - 8, h: C.h - imgH - 9 }, s);
  } else if (plan.layout === 2) {
    const gap = 8, w = (C.w - gap) / 2, imgH = 150;
    products.forEach((p, i) => {
      const x = C.x + i * (w + gap);
      drawImage(cv, ctx, p, { x, y: C.y, w, h: imgH }, 6);
      drawInfo(cv, ctx, p, { x: x + 1, y: C.y + imgH + 7, w: w - 2, h: C.h - imgH - 7 }, s);
    });
  } else if (plan.layout === 3) {
    const gap = 9, h = (C.h - gap * 2) / 3, imgW = 74;
    products.forEach((p, i) => {
      const y = C.y + i * (h + gap);
      drawImage(cv, ctx, p, { x: C.x, y, w: imgW, h }, 5);
      drawInfo(cv, ctx, p, { x: C.x + imgW + 8, y: y + 2, w: C.w - imgW - 8, h: h - 4 }, s);
      if (i < products.length - 1) cv.line(C.x + imgW + 8, y + h + gap / 2, C.x + C.w, y + h + gap / 2, ctx.theme.hairline, 0.25);
    });
  } else {
    const gap = 8, w = (C.w - gap) / 2, h = (C.h - gap) / 2, imgH = 68;
    products.forEach((p, i) => {
      const x = C.x + (i % 2) * (w + gap), y = C.y + Math.floor(i / 2) * (h + gap);
      drawImage(cv, ctx, p, { x, y, w, h: imgH }, 4);
      drawInfo(cv, ctx, p, { x: x + 1, y: y + imgH + 5, w: w - 2, h: h - imgH - 5 }, s);
    });
  }
};
