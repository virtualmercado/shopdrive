import type { jsPDF } from "jspdf";
import type { CatalogImage } from "@/lib/catalogPdfClassic";
import type { EditorialTheme, RGB } from "./theme";

/** Fontes padrão do jsPDF só codificam WinAnsi: emojis/símbolos fora dela viram lixo e quebram o espaçamento. */
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export const pdfSafe = (s: string) =>
  s.normalize("NFC").replace(/[^\u0000-\u00FF]/gu, (ch) => (WINANSI_EXTRA.includes(ch) ? ch : "")).replace(/[ \t]{2,}/g, " ");

export interface WrapReq { wrap: true; text: string; width: number; maxLines: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface DrawnRect extends Box { page: number; kind: "text" | "image" | "button" | "shape"; label?: string }

/**
 * Wrapper fino sobre jsPDF que registra cada elemento desenhado.
 * O registro permite testar sobreposição e limites sem inspeção manual.
 */
export class EditorialCanvas {
  readonly rects: DrawnRect[] = [];
  readonly links: { page: number; url: string; box: Box }[] = [];
  page = 1;

  constructor(readonly pdf: jsPDF, readonly theme: EditorialTheme) {}

  private record(kind: DrawnRect["kind"], b: Box, label?: string) {
    this.rects.push({ ...b, page: this.page, kind, label });
  }

  newPage() {
    this.pdf.addPage();
    this.page++;
  }

  fill(c: RGB) { this.pdf.setFillColor(c[0], c[1], c[2]); }
  color(c: RGB) { this.pdf.setTextColor(c[0], c[1], c[2]); }
  stroke(c: RGB) { this.pdf.setDrawColor(c[0], c[1], c[2]); }

  rect(b: Box, c: RGB, radius = 0) {
    this.fill(c);
    if (radius > 0) this.pdf.roundedRect(b.x, b.y, b.w, b.h, radius, radius, "F");
    else this.pdf.rect(b.x, b.y, b.w, b.h, "F");
  }

  line(x1: number, y1: number, x2: number, y2: number, c: RGB, width = 0.2) {
    this.stroke(c);
    this.pdf.setLineWidth(width);
    this.pdf.line(x1, y1, x2, y2);
  }

  font(size: number, style: "normal" | "bold" = "normal") {
    this.pdf.setFont(this.theme.font, style);
    this.pdf.setFontSize(size);
  }

  /** mm por linha para o tamanho de fonte atual. */
  lineH(size: number, leading = 1.25) { return (size * 0.3528) * leading; }

  /** Pedido de quebra resolvido em text(), já com a fonte/tamanho corretos. */
  wrap(text: string, width: number, maxLines: number): WrapReq {
    return { wrap: true, text, width, maxLines };
  }

  /** Quebra com a fonte ATUAL em no máximo maxLines, com reticências na última linha. */
  wrapNow(text: string, width: number, maxLines: number): string[] {
    if (!text || maxLines <= 0) return [];
    const lines = this.pdf.splitTextToSize(pdfSafe(text).replace(/\s+/g, " ").trim(), width) as string[];
    if (lines.length <= maxLines) return lines;
    const out = lines.slice(0, maxLines);
    // Corta por palavra inteira (nunca no meio) até caber com reticências.
    const words = out[maxLines - 1].split(" ");
    const fits = (ws: string[]) => this.pdf.getTextWidth(`${ws.join(" ").replace(/[\s,.;:–—-]+$/, "")}...`) <= width;
    while (words.length > 1 && !fits(words)) words.pop();
    let last = words.join(" ");
    while (last.length > 1 && !fits([last])) last = last.slice(0, -1);
    out[maxLines - 1] = `${last.replace(/[\s,.;:–—-]+$/, "")}...`;
    return out;
  }

  /** Mede um título: reduz o corpo (até minSize) para não partir palavras; não desenha. */
  fitTitle(text: string, width: number, size: number, minSize: number, maxLines: number, style: "normal" | "bold" = "bold") {
    this.font(size, style);
    const words = text.split(/\s+/).filter(Boolean);
    while (size > minSize && words.some((w) => this.pdf.getTextWidth(w) > width)) this.font(--size, style);
    return { lines: this.wrapNow(text, width, maxLines), size };
  }

  /** Desenha linhas a partir do topo `y`; retorna a altura usada. */
  text(input: string[] | WrapReq, x: number, y: number, size: number, c: RGB, opts: { style?: "normal" | "bold"; align?: "left" | "center" | "right"; width?: number; leading?: number; label?: string; charSpace?: number; minSize?: number } = {}) {
    this.font(size, opts.style);
    let lines: string[];
    if (Array.isArray(input)) lines = input.map(pdfSafe);
    else {
      // Títulos: reduz o corpo até nenhuma palavra precisar ser partida.
      if (opts.minSize) {
        const words = input.text.split(/\s+/).filter(Boolean);
        while (size > opts.minSize && words.some((w) => this.pdf.getTextWidth(w) > input.width)) this.font(--size, opts.style);
      }
      lines = this.wrapNow(input.text, input.width, input.maxLines);
    }
    if (!lines.length) return 0;
    this.color(c);
    const lh = this.lineH(size, opts.leading);
    const ascent = size * 0.3528 * 0.78;
    lines.forEach((l, i) => {
      const tx = opts.align === "center" ? x + (opts.width ?? 0) / 2 : opts.align === "right" ? x + (opts.width ?? 0) : x;
      this.pdf.text(l, tx, y + ascent + i * lh, { align: opts.align ?? "left", charSpace: opts.charSpace });
    });
    const h = lh * (lines.length - 1) + size * 0.3528;
    const w = opts.width ?? Math.max(...lines.map((l) => this.pdf.getTextWidth(l)));
    this.record("text", { x, y, w, h }, opts.label);
    return h;
  }

  /** Imagem inteira dentro da caixa (proporção preservada). */
  imageContain(img: CatalogImage, b: Box, pad = 0) {
    const iw = b.w - pad * 2, ih = b.h - pad * 2;
    const s = Math.min(iw / img.width, ih / img.height);
    const w = img.width * s, h = img.height * s;
    const x = b.x + pad + (iw - w) / 2, y = b.y + pad + (ih - h) / 2;
    this.pdf.addImage(img.data, img.format, x, y, w, h, img.alias, "FAST");
    this.record("image", { x, y, w, h });
  }

  /** Imagem preenchendo a caixa, recortada ao centro (proporção preservada). */
  imageCover(img: CatalogImage, b: Box) {
    const s = Math.max(b.w / img.width, b.h / img.height);
    const w = img.width * s, h = img.height * s;
    this.pdf.saveGraphicsState();
    this.pdf.rect(b.x, b.y, b.w, b.h, null);
    this.pdf.clip();
    this.pdf.discardPath();
    this.pdf.addImage(img.data, img.format, b.x + (b.w - w) / 2, b.y + (b.h - h) / 2, w, h, img.alias, "FAST");
    this.pdf.restoreGraphicsState();
    this.record("image", b);
  }

  /** Botão com link real; sem URL válida, nada é desenhado. */
  button(label: string, x: number, y: number, url: string | null, bg: RGB, fg: RGB, size = 8, minW = 0) {
    if (!url) return null;
    this.font(size, "bold");
    const w = Math.max(minW, this.pdf.getTextWidth(label) + 10);
    const h = size * 0.3528 + 5;
    this.rect({ x, y, w, h }, bg, h / 2);
    this.color(fg);
    this.pdf.text(label, x + w / 2, y + h / 2 + size * 0.3528 * 0.36, { align: "center" });
    this.pdf.link(x, y, w, h, { url });
    this.links.push({ page: this.page, url, box: { x, y, w, h } });
    this.record("button", { x, y, w, h }, label);
    return { w, h };
  }

  link(box: Box, url: string) {
    this.pdf.link(box.x, box.y, box.w, box.h, { url });
    this.links.push({ page: this.page, url, box });
  }
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** Formatação só na apresentação; espaço não separável normalizado para o PDF. */
export const formatBRL = (amount: number) => BRL.format(amount).replace(/\u00a0|\u202f/g, " ");

export const formatWhatsapp = (raw: string) => {
  const d = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

export const whatsappUrl = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
};
