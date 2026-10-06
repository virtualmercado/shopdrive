import { formatWhatsapp, whatsappUrl, type EditorialCanvas } from "./canvas";
import type { RenderContext } from "./context";
import { PAGE, mix } from "./theme";

/** Contracapa: só mostra os canais que a loja realmente tem. */
export const renderBackCover = (cv: EditorialCanvas, ctx: RenderContext) => {
  const t = ctx.theme;
  const id = ctx.doc.identity;
  const M = PAGE.margin;
  const fg = t.onPrimary;
  const soft = mix(t.primary, fg, 0.62);
  const w = PAGE.w - M * 2;

  cv.rect({ x: 0, y: 0, w: PAGE.w, h: PAGE.h }, t.primary);

  let y = 56;
  if (ctx.logo) {
    const box = { x: (PAGE.w - 48) / 2, y, w: 48, h: 28 };
    cv.rect(box, t.paper, 3);
    cv.imageContain(ctx.logo, box, 3);
    y += 40;
  }
  y += cv.text(cv.wrap(id.storeName, w, 2), M, y, 24, fg, { style: "bold", align: "center", width: w, label: "back-store" }) + 6;
  cv.line(PAGE.w / 2 - 9, y, PAGE.w / 2 + 9, y, fg, 0.8);
  y += 10;

  if (id.about?.text) {
    y += cv.text(cv.wrap(id.about.text, 140, 6), (PAGE.w - 140) / 2, y, 10, soft, { align: "center", width: 140, leading: 1.45, label: "back-about" }) + 12;
  }

  const rows: { label: string; value: string; url: string | null }[] = [];
  if (id.whatsapp) rows.push({ label: "WHATSAPP", value: formatWhatsapp(id.whatsapp), url: whatsappUrl(id.whatsapp) });
  if (id.publicUrl) rows.push({ label: "LOJA ONLINE", value: id.publicUrl.replace(/^https?:\/\//, ""), url: id.publicUrl });
  if (id.email) rows.push({ label: "E-MAIL", value: id.email, url: `mailto:${id.email}` });
  const social: [string, string | null][] = [["INSTAGRAM", id.social.instagram], ["FACEBOOK", id.social.facebook], ["YOUTUBE", id.social.youtube], ["X", id.social.x]];
  social.forEach(([label, url]) => {
    if (url && /^https?:\/\//i.test(url)) rows.push({ label, value: url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""), url });
  });
  if (id.address) rows.push({ label: "ENDEREÇO", value: id.address, url: null });

  const maxRows = Math.max(0, Math.floor((PAGE.h - M - 20 - y) / 15));
  rows.slice(0, maxRows).forEach((r) => {
    cv.text([r.label], M, y, 7.5, soft, { style: "bold", align: "center", width: w, charSpace: 0.8 });
    cv.font(11, "bold");
    const lines = cv.wrapNow(r.value, w - 20, 1);
    const h = cv.text(lines, M, y + 4.5, 11, fg, { style: "bold", align: "center", width: w, label: `back-${r.label}` });
    if (r.url) {
      cv.font(11, "bold");
      const tw = cv.pdf.getTextWidth(lines[0]);
      cv.link({ x: (PAGE.w - tw) / 2, y: y + 4, w: tw, h: h + 1.5 }, r.url);
    }
    y += 15;
  });

  cv.text(["Catálogo gerado com ShopDrive"], M, PAGE.h - M - 3, 7, soft, { align: "center", width: w, label: "back-credit" });
};
