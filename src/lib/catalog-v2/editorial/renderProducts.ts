import { formatBRL, type Box, type EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { CompactHeader, PagePlan } from "./composer";
import type { CatalogProduct } from "../types";
import { PAGE, mix, type EditorialTheme } from "./theme";

const M = PAGE.margin;
export const CONTENT: Box = { x: M, y: M + PAGE.headerH + 4, w: PAGE.w - M * 2, h: PAGE.h - M * 2 - PAGE.headerH - PAGE.footerH - 4 };

/**
 * flow: preço/CTA logo após o texto (faixas horizontais, sem vazio artificial).
 * bottom: preço/CTA ancorados no pé do bloco (grade, alinhando os vizinhos).
 */
interface InfoScale { name: number; nameMin: number; nameLines: number; desc: number; descLines: number; price: number; meta: number; gap: number; anchor: "flow" | "bottom" }

const SCALES: Record<1 | 2 | 3 | 4, InfoScale> = {
  1: { name: 22, nameMin: 16, nameLines: 3, desc: 10.5, descLines: 6, price: 21, meta: 7.5, gap: 3, anchor: "flow" },
  2: { name: 16, nameMin: 12, nameLines: 3, desc: 9.5, descLines: 7, price: 17, meta: 7.2, gap: 2.6, anchor: "flow" },
  3: { name: 13.5, nameMin: 11, nameLines: 3, desc: 9, descLines: 4, price: 15, meta: 7, gap: 2.2, anchor: "flow" },
  4: { name: 11.5, nameMin: 10, nameLines: 3, desc: 8.5, descLines: 3, price: 13, meta: 7, gap: 1.8, anchor: "bottom" },
};

const BODY: [number, number, number] = [63, 63, 70];
const descriptionOf = (p: CatalogProduct) => p.description.plainText.replace(/\n+/g, " ").trim();

const drawInfo = (cv: EditorialCanvas, ctx: RenderContext, p: CatalogProduct, b: Box, s: InfoScale) => {
  const t = ctx.theme;
  let y = b.y;
  const meta = [ctx.categoryName(p.categoryId), ctx.brandName(p.brandId)].filter(Boolean).join("  ·  ");
  if (meta) y += cv.text(cv.wrap(meta.toUpperCase(), b.w, 1), b.x, y, s.meta, t.muted, { style: "bold", charSpace: 0.35, label: "meta" }) + s.gap;
  const name = cv.fitTitle(p.name, b.w, s.name, s.nameMin, s.nameLines);
  y += cv.text(name.lines, b.x, y, name.size, t.ink, { style: "bold", leading: 1.15, label: "name" }) + s.gap + 0.6;

  // Reserva do rodapé (preço + botão) antes da descrição: o texto nunca invade.
  const hasPromo = ctx.showPrices && !!p.price.promotional;
  const oldH = 3.6;
  const priceH = ctx.showPrices ? s.price * 0.3528 + (hasPromo ? oldH + 1.2 : 0) : 0;
  const btnH = 8.5 * 0.3528 + 5;
  const footH = Math.max(priceH, p.publicUrl ? btnH : 0);
  const bottomFoot = b.y + b.h - footH;

  const desc = descriptionOf(p);
  const descLH = cv.lineH(s.desc, 1.4);
  const room = bottomFoot - s.gap * 2 - y;
  const maxDesc = Math.min(s.descLines, Math.max(0, Math.floor((room - s.desc * 0.3528) / descLH) + 1));
  let descH = 0;
  if (desc && maxDesc > 0 && room > s.desc * 0.3528) {
    cv.font(s.desc);
    descH = cv.text(cv.wrapNow(desc, b.w, maxDesc), b.x, y, s.desc, BODY, { leading: 1.4, label: "desc" });
  }
  const flowFoot = y + descH + s.gap * 2.6;
  const footY = s.anchor === "flow" ? Math.min(bottomFoot, Math.max(flowFoot, y)) : bottomFoot;

  if (ctx.showPrices) {
    let py = footY + (footH - priceH);
    if (hasPromo) {
      const old = formatBRL(p.price.regular.amount);
      cv.text([old], b.x, py, 8.5, t.muted, { label: "price-old" });
      cv.font(8.5);
      cv.line(b.x, py + 1.5, b.x + cv.pdf.getTextWidth(old), py + 1.5, t.muted, 0.3);
      py += oldH + 1.2;
    }
    cv.text([formatBRL(p.price.effective.amount)], b.x, py, s.price, t.price, { style: "bold", label: "price" });
  }
  if (p.publicUrl) {
    cv.font(8.5, "bold");
    const bw = cv.pdf.getTextWidth("Ver produto") + 12;
    cv.button("Ver produto", b.x + b.w - bw, footY + footH - btnH, p.publicUrl, t.accent, t.onAccent, 8.5, bw);
  }
};

/** Sem imagem válida: bloco neutro com ícone de foto e aviso discreto, no mesmo espaço. */
export const drawNoImage = (cv: EditorialCanvas, t: EditorialTheme, b: Box) => {
  const s = Math.max(9, Math.min(24, Math.min(b.w, b.h) * 0.2));
  const iconC = mix(t.primary, [255, 255, 255], 0.6);
  const textSize = s < 12 ? 7 : 8;
  const blockH = s * 0.78 + 4 + textSize * 0.3528;
  const x = b.x + (b.w - s) / 2, y = b.y + (b.h - blockH) / 2;
  const h = s * 0.78;
  cv.stroke(iconC);
  cv.pdf.setLineWidth(0.6);
  cv.pdf.roundedRect(x, y, s, h, s * 0.08, s * 0.08, "S");
  cv.fill(iconC);
  cv.pdf.circle(x + s * 0.7, y + h * 0.3, s * 0.08, "F");
  cv.pdf.triangle(x + s * 0.12, y + h * 0.85, x + s * 0.4, y + h * 0.42, x + s * 0.64, y + h * 0.85, "F");
  cv.pdf.triangle(x + s * 0.48, y + h * 0.85, x + s * 0.66, y + h * 0.58, x + s * 0.88, y + h * 0.85, "F");
  cv.rects.push({ x, y, w: s, h, page: cv.page, kind: "shape", label: "noimg-icon" });
  cv.text(["Imagem indisponível"], b.x, y + h + 4, textSize, t.muted, { align: "center", width: b.w, label: "noimg" });
};

const drawImage = (cv: EditorialCanvas, ctx: RenderContext, p: CatalogProduct, b: Box, pad: number) => {
  const t = ctx.theme;
  cv.rect(b, t.imageBg, 2);
  const img = ctx.image(p.primaryImage) ?? ctx.image(p.additionalImages[0]);
  if (img) cv.imageContain(img, b, pad);
  else drawNoImage(cv, t, b);
  if (ctx.showPrices && p.price.discountPercent) {
    const label = `-${p.price.discountPercent}%`;
    cv.font(8, "bold");
    const w = cv.pdf.getTextWidth(label) + 6;
    cv.rect({ x: b.x + 3, y: b.y + 3, w, h: 6.2 }, t.primary, 3.1);
    cv.text([label], b.x + 3, b.y + 4.45, 8, t.onPrimary, { style: "bold", align: "center", width: w, label: "badge" });
  }
};

export const drawChrome = (cv: EditorialCanvas, ctx: RenderContext, sectionTitle: string, pageNo: number, header = true) => {
  const w = PAGE.w - M * 2;
  if (header) drawChromeHeader(cv, ctx, sectionTitle, w);
  drawChromeFooter(cv, ctx, pageNo, w);
};

const drawChromeHeader = (cv: EditorialCanvas, ctx: RenderContext, sectionTitle: string, w: number) => {
  const t = ctx.theme;
  cv.text(cv.wrap(ctx.doc.identity.storeName.toUpperCase(), w / 2 - 4, 1), M, M + 2, 7.5, t.primary, { style: "bold", charSpace: 0.6, label: "hdr-store" });
  cv.text(cv.wrap(sectionTitle, w / 2 - 4, 1), M + w / 2 + 4, M + 2, 7.5, t.muted, { align: "right", width: w / 2 - 4, label: "hdr-section" });
  cv.line(M, M + PAGE.headerH - 2, PAGE.w - M, M + PAGE.headerH - 2, t.hairline, 0.25);
};

const drawChromeFooter = (cv: EditorialCanvas, ctx: RenderContext, pageNo: number, w: number) => {
  const t = ctx.theme;
  const fy = PAGE.h - M - 3;
  cv.line(M, fy - 3, PAGE.w - M, fy - 3, t.hairline, 0.25);
  if (ctx.doc.identity.publicUrl) cv.text([ctx.doc.identity.publicUrl.replace(/^https?:\/\//, "")], M, fy, 7, t.muted, { label: "ftr-url" });
  cv.text([String(pageNo).padStart(2, "0")], M + w - 20, fy, 7, t.muted, { style: "bold", align: "right", width: 20, label: "ftr-page" });
};

/** Faixa horizontal: imagem à esquerda, informações à direita. */
const drawBand = (cv: EditorialCanvas, ctx: RenderContext, p: CatalogProduct, C: Box, y: number, h: number, imgW: number, pad: number, s: InfoScale, inner: number) => {
  drawImage(cv, ctx, p, { x: C.x, y, w: imgW, h }, pad);
  const ix = C.x + imgW + inner;
  drawInfo(cv, ctx, p, { x: ix, y: y + 3, w: C.x + C.w - ix, h: h - 6 }, s);
};

export const COMPACT_HEADER_H = 22;
const COMPACT_GAP = 7;

/** Separador compacto: faixa de seção no topo da área útil; o conteúdo começa abaixo dela. */
const drawCompactHeader = (cv: EditorialCanvas, ctx: RenderContext, h: CompactHeader) => {
  const t = ctx.theme;
  const C = CONTENT;
  const box = { x: C.x, y: C.y, w: C.w, h: COMPACT_HEADER_H };
  cv.rect(box, t.tint, 2);
  cv.rect({ x: C.x, y: C.y, w: 2.4, h: COMPACT_HEADER_H }, t.primary);
  cv.rects.push({ ...box, page: cv.page, kind: "shape", label: "compact-header" });
  const idx = String(h.index).padStart(2, "0");
  cv.text([idx], C.x + 8, C.y + 6, 20, t.primary, { style: "bold", label: "compact-index" });
  const tx = C.x + 26, tw = C.w - 26 - 6;
  const title = cv.fitTitle(h.title, tw, 15, 11, 1);
  cv.text(title.lines, tx, C.y + 4.6, title.size, t.ink, { style: "bold", label: "compact-title" });
  const label = `${h.productCount} ${h.productCount === 1 ? "produto" : "produtos"}`;
  cv.text([label.toUpperCase()], tx, C.y + 13.4, 7.5, t.muted, { style: "bold", charSpace: 0.6, label: "compact-count" });
};

/** Layout de produto único (reutilizado pela página de destaque). */
const drawSingle = (cv: EditorialCanvas, ctx: RenderContext, p: CatalogProduct, C: Box, s: InfoScale) => {
  const imgH = Math.min(160, C.h - 83);
  drawImage(cv, ctx, p, { x: C.x, y: C.y, w: C.w, h: imgH }, 10);
  drawInfo(cv, ctx, p, { x: C.x + 4, y: C.y + imgH + 9, w: C.w - 8, h: C.h - imgH - 9 }, s);
};

export const renderProductsPage = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "products" }>) => {
  const products = plan.productIds.map(ctx.product);
  const s = SCALES[plan.layout];
  const off = plan.header ? COMPACT_HEADER_H + COMPACT_GAP : 0;
  const C: Box = { x: CONTENT.x, y: CONTENT.y + off, w: CONTENT.w, h: CONTENT.h - off };
  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, ctx.theme.paper);
  drawChrome(cv, ctx, plan.sectionTitle, cv.page);
  if (plan.header) drawCompactHeader(cv, ctx, plan.header);

  if (plan.layout === 1) {
    drawSingle(cv, ctx, products[0], C, s);
  } else if (plan.layout === 2) {
    const gap = 12, h = (C.h - gap) / 2, imgW = 96;
    products.forEach((p, i) => {
      const y = C.y + i * (h + gap);
      drawBand(cv, ctx, p, C, y, h, imgW, 7, s, 9);
      if (i === 0) cv.line(C.x, y + h + gap / 2, C.x + C.w, y + h + gap / 2, ctx.theme.hairline, 0.25);
    });
  } else if (plan.layout === 3) {
    const gap = 9, h = (C.h - gap * 2) / 3, imgW = 74;
    products.forEach((p, i) => {
      const y = C.y + i * (h + gap);
      drawBand(cv, ctx, p, C, y, h, imgW, 5, s, 8);
      if (i < products.length - 1) cv.line(C.x + imgW + 8, y + h + gap / 2, C.x + C.w, y + h + gap / 2, ctx.theme.hairline, 0.25);
    });
  } else {
    const gap = 8, w = (C.w - gap) / 2, h = (C.h - gap) / 2, imgH = Math.min(68, h * 0.58);
    products.forEach((p, i) => {
      const x = C.x + (i % 2) * (w + gap), y = C.y + Math.floor(i / 2) * (h + gap);
      drawImage(cv, ctx, p, { x, y, w, h: imgH }, 4);
      drawInfo(cv, ctx, p, { x: x + 1, y: y + imgH + 5, w: w - 2, h: h - imgH - 5 }, s);
    });
  }
};

/** Página de destaque: mesmo layout do produto único + selo "Destaque". */
export const renderFeaturedPage = (cv: EditorialCanvas, ctx: RenderContext, plan: Extract<PagePlan, { kind: "featured" }>) => {
  const t = ctx.theme;
  const p = ctx.product(plan.productId);
  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, t.paper);
  drawChrome(cv, ctx, "Destaque", cv.page);
  drawSingle(cv, ctx, p, CONTENT, SCALES[1]);
  const label = "PRODUTO EM DESTAQUE";
  cv.font(7.5, "bold");
  const w = cv.pdf.getTextWidth(label) + 0.6 * label.length + 8;
  const x = CONTENT.x + CONTENT.w - w - 4, y = CONTENT.y + 4;
  cv.rect({ x, y, w, h: 6.6 }, t.accent, 3.3);
  cv.text([label], x, y + 1.75, 7.5, t.onAccent, { style: "bold", align: "center", width: w, charSpace: 0.6, label: "featured-badge" });
};
