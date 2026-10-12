// @ts-expect-error — pacote sem tipos; usamos só QRCode.create (síncrono).
import QRCode from "qrcode";
import { formatWhatsapp, whatsappUrl, type EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import type { PagePlan } from "./composer";
import type { BackTextKey } from "./coverTypography";
import { PAGE, type RGB } from "./theme";

/** Posições fixas do template da contracapa (mm). Não editáveis pelo lojista. */
export const BACK_LAYOUT = {
  logo: { y: 30, maxW: 56, maxH: 30 },
  nameY: 72,
  contactsTop: 100,
  contactsBottom: 192,
  qr: { size: 36, y: 206 },
  footerY: PAGE.h - PAGE.margin - 8,
} as const;

/** Matriz do QR Code (true = módulo escuro). Exportado para teste. */
export const qrMatrix = (text: string): boolean[][] => {
  const q = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n: number = q.modules.size;
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => !!q.modules.get(r, c)));
};

/**
 * Contracapa em dois modos, template fixo:
 * - Padrão: página branca; cor da loja só em detalhes (divisor e rótulos).
 * - Personalizada: imagem da própria loja cobrindo a A4 inteira; mesmos elementos por cima.
 * Mostra só WhatsApp, loja online, e-mail e endereço cadastrados + QR Code automático da loja pública.
 */
export const renderBackCover = (cv: EditorialCanvas, ctx: RenderContext, plan?: Extract<PagePlan, { kind: "back" }>) => {
  const t = ctx.theme;
  const id = ctx.doc.identity;
  const M = PAGE.margin;
  const w = PAGE.w - M * 2;
  const WHITE: RGB = [255, 255, 255];
  const QR_INK: RGB = [17, 24, 39];
  const custom = ctx.image(plan?.image ?? null);
  const L = BACK_LAYOUT;

  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, WHITE);
  if (custom) cv.imageCover(custom, { x: 0, y: 0, w: PAGE.w, h: PAGE.h });

  const typo = ctx.backTypography;
  const use = (key: BackTextKey, fallback: RGB): RGB => { cv.fontOverride = typo?.[key].font ?? null; return typo?.[key].color ?? fallback; };
  const fg: RGB = custom ? WHITE : t.ink;
  const soft: RGB = custom ? WHITE : t.muted;
  const accent: RGB = custom ? WHITE : t.primary;

  // Logo centralizada no topo (sobre imagem, numa placa branca para leitura).
  if (ctx.logo) {
    const s = Math.min(L.logo.maxW / ctx.logo.width, L.logo.maxH / ctx.logo.height);
    const lw = ctx.logo.width * s, lh = ctx.logo.height * s;
    const box = { x: (PAGE.w - lw) / 2, y: L.logo.y + (L.logo.maxH - lh) / 2, w: lw, h: lh };
    if (custom) cv.rect({ x: box.x - 4, y: box.y - 3, w: lw + 8, h: lh + 6 }, WHITE, 3);
    cv.imageContain(ctx.logo, box);
  }

  // Nome da loja + divisor discreto.
  const nameColor = use("storeName", fg);
  const nameH = cv.text(cv.wrap(id.storeName, w, 2), M, L.nameY, 22, nameColor, { style: "bold", align: "center", width: w, label: "back-store", minSize: 16 });
  cv.fontOverride = null;
  const divY = L.nameY + nameH + 6;
  cv.line(PAGE.w / 2 - 10, divY, PAGE.w / 2 + 10, divY, accent, 0.8);

  // Bloco central de contatos (só o que existe).
  const rows: { label: string; value: string; url: string | null; lines: number }[] = [];
  if (id.whatsapp) rows.push({ label: "WHATSAPP", value: formatWhatsapp(id.whatsapp), url: whatsappUrl(id.whatsapp), lines: 1 });
  if (id.publicUrl) rows.push({ label: "LOJA ONLINE", value: id.publicUrl.replace(/^https?:\/\//, ""), url: id.publicUrl, lines: 1 });
  if (id.email) rows.push({ label: "E-MAIL", value: id.email, url: `mailto:${id.email}`, lines: 1 });
  if (id.address) rows.push({ label: "ENDEREÇO", value: id.address, url: null, lines: 2 });

  const rowH = (r: (typeof rows)[number]) => 10 + (r.lines - 1) * 5;
  const total = rows.reduce((a, r) => a + rowH(r) + 5, 0) - 5;
  let y = Math.max(L.contactsTop, L.contactsTop + (L.contactsBottom - L.contactsTop - total) / 2);
  const valueColor = use("contacts", fg);
  rows.forEach((r) => {
    cv.text([r.label], M, y, 7.5, typo?.contacts.color ?? accent, { style: "bold", align: "center", width: w, charSpace: 0.8 });
    cv.font(11, "bold");
    const lines = cv.wrapNow(r.value, w - 30, r.lines);
    const h = cv.text(lines, M, y + 4.5, 11, valueColor, { style: "bold", align: "center", width: w, label: `back-${r.label}` });
    if (r.url) {
      cv.font(11, "bold");
      const tw = cv.pdf.getTextWidth(lines[0]);
      cv.link({ x: (PAGE.w - tw) / 2, y: y + 4, w: tw, h: h + 1.5 }, r.url);
    }
    y += rowH(r) + 5;
  });
  cv.fontOverride = null;

  // QR Code automático da loja pública + rodapé com o link.
  const footColor = use("footer", soft);
  if (id.publicUrl) {
    const size = L.qr.size, x = (PAGE.w - size) / 2;
    cv.rect({ x: x - 3, y: L.qr.y - 3, w: size + 6, h: size + 6 }, WHITE, 2);
    const m = qrMatrix(id.publicUrl);
    const cell = size / m.length;
    m.forEach((row, r) => row.forEach((on, c) => { if (on) cv.rect({ x: x + c * cell, y: L.qr.y + r * cell, w: cell + 0.02, h: cell + 0.02 }, QR_INK); }));
    cv.rects.push({ page: cv.page, kind: "image", x, y: L.qr.y, w: size, h: size, label: "back-qr" });
    cv.link({ x, y: L.qr.y, w: size, h: size }, id.publicUrl);
    cv.text(["Acesse nossa loja"], M, L.qr.y + size + 6, 9, footColor, { align: "center", width: w, label: "back-qr-caption" });
    const host = id.publicUrl.replace(/^https?:\/\//, "");
    cv.text([host], M, L.footerY, 8.5, footColor, { align: "center", width: w, label: "back-footer" });
    cv.font(8.5);
    const tw = cv.pdf.getTextWidth(host);
    cv.link({ x: (PAGE.w - tw) / 2, y: L.footerY - 0.5, w: tw, h: 4 }, id.publicUrl);
  }
  cv.fontOverride = null;
  cv.text(["Catálogo gerado com ShopDrive"], M, PAGE.h - M - 2, 6.5, soft, { align: "center", width: w, label: "back-credit" });
};
