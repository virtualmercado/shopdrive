import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QuoteItem {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface QuoteData {
  id: string;
  quote_number?: string | null;
  issued_at: string;
  valid_until: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  delivery_address?: string | null;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total: number;
  payment_method_hint?: string | null;
  notes?: string | null;
  quote_items?: QuoteItem[];
}

interface StoreData {
  store_name?: string | null;
  store_logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  address?: string | null;
  address_city?: string | null;
  address_state?: string | null;
}

export const printQuoteA4 = async ({ quote, store }: { quote: QuoteData; store: StoreData }) => {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;
  const rgb = { r: 0, g: 0, b: 0 };

  // HEADER - Store logo
  if (store.store_logo_url) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = store.store_logo_url!;
      });
      pdf.addImage(img, "PNG", margin, yPos, 30, 30);
    } catch {}
  }

  const storeInfoX = store.store_logo_url ? margin + 35 : margin;
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text(store.store_name || "Minha Loja", storeInfoX, yPos + 7);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(60, 60, 60);
  let infoY = yPos + 13;
  if (store.address) { pdf.text(store.address, storeInfoX, infoY); infoY += 4; }
  if (store.address_city && store.address_state) { pdf.text(`${store.address_city} / ${store.address_state}`, storeInfoX, infoY); infoY += 4; }
  if (store.phone || store.whatsapp_number) { pdf.text(`Tel: ${[store.phone, store.whatsapp_number].filter(Boolean).join(" | ")}`, storeInfoX, infoY); infoY += 4; }
  if (store.email) { pdf.text(`Email: ${store.email}`, storeInfoX, infoY); }

  // Quote number and dates
  const quoteNumber = quote.quote_number || `ORC-${quote.id.slice(0, 8)}`;
  const issuedDate = format(new Date(quote.issued_at), "dd/MM/yyyy", { locale: ptBR });
  const validDate = format(new Date(quote.valid_until + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text(`ORÇAMENTO ${quoteNumber}`, pageWidth - margin, yPos + 7, { align: "right" });

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(60, 60, 60);
  pdf.text(`Emissão: ${issuedDate}`, pageWidth - margin, yPos + 13, { align: "right" });
  pdf.text(`Validade: ${validDate}`, pageWidth - margin, yPos + 18, { align: "right" });

  yPos += 38;

  pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // CUSTOMER
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text("DADOS DO CLIENTE", margin, yPos);
  yPos += 6;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(40, 40, 40);

  pdf.setFont("helvetica", "bold"); pdf.text("Nome:", margin, yPos);
  pdf.setFont("helvetica", "normal"); pdf.text(quote.customer_name, margin + 15, yPos); yPos += 5;

  if (quote.customer_phone) { pdf.text(`Tel: ${quote.customer_phone}`, margin, yPos); yPos += 5; }
  if (quote.customer_email) { pdf.text(`Email: ${quote.customer_email}`, margin, yPos); yPos += 5; }
  if (quote.delivery_address) {
    const lines = pdf.splitTextToSize(`Endereço: ${quote.delivery_address}`, contentWidth);
    pdf.text(lines, margin, yPos); yPos += lines.length * 4;
  }

  yPos += 8;

  // ITEMS TABLE
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text("ITENS DO ORÇAMENTO", margin, yPos);
  yPos += 6;

  const colWidths = { item: 12, desc: 85, qty: 25, unit: 28, total: 30 };
  const headerY = yPos;

  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
  pdf.rect(margin, headerY - 4, contentWidth, 8, "F");

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);

  let colX = margin + 2;
  pdf.text("ITEM", colX, headerY); colX += colWidths.item;
  pdf.text("DESCRIÇÃO", colX, headerY); colX += colWidths.desc;
  pdf.text("QTD", colX + 5, headerY); colX += colWidths.qty;
  pdf.text("VL. UNIT.", colX, headerY); colX += colWidths.unit;
  pdf.text("VL. TOTAL", colX, headerY);

  yPos = headerY + 6;
  pdf.setTextColor(40, 40, 40);
  pdf.setFont("helvetica", "normal");

  (quote.quote_items || []).forEach((item, index) => {
    if (index % 2 === 0) { pdf.setFillColor(248, 248, 248); pdf.rect(margin, yPos - 4, contentWidth, 7, "F"); }
    colX = margin + 2;
    pdf.text(String(index + 1).padStart(2, "0"), colX, yPos); colX += colWidths.item;
    const desc = item.name.length > 40 ? item.name.substring(0, 40) + "..." : item.name;
    pdf.text(desc, colX, yPos); colX += colWidths.desc;
    pdf.text(String(item.quantity), colX + 8, yPos); colX += colWidths.qty;
    pdf.text(`R$ ${Number(item.unit_price).toFixed(2)}`, colX, yPos); colX += colWidths.unit;
    pdf.text(`R$ ${Number(item.line_total).toFixed(2)}`, colX, yPos);
    yPos += 7;
  });

  yPos += 5;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // TOTALS
  const totalsX = pageWidth - margin - 60;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 80);

  pdf.text("Subtotal:", totalsX, yPos);
  pdf.setFont("helvetica", "bold"); pdf.text(`R$ ${Number(quote.subtotal).toFixed(2)}`, pageWidth - margin, yPos, { align: "right" }); yPos += 5;

  if (quote.discount > 0) {
    pdf.setFont("helvetica", "normal"); pdf.text("Desconto:", totalsX, yPos);
    pdf.text(`- R$ ${Number(quote.discount).toFixed(2)}`, pageWidth - margin, yPos, { align: "right" }); yPos += 5;
  }
  if (quote.shipping_fee > 0) {
    pdf.setFont("helvetica", "normal"); pdf.text("Frete:", totalsX, yPos);
    pdf.text(`R$ ${Number(quote.shipping_fee).toFixed(2)}`, pageWidth - margin, yPos, { align: "right" }); yPos += 5;
  }

  pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
  pdf.setLineWidth(0.5);
  pdf.line(totalsX - 5, yPos, pageWidth - margin, yPos);
  yPos += 6;

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text("TOTAL:", totalsX, yPos);
  pdf.text(`R$ ${Number(quote.total).toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 5;

  if (quote.payment_method_hint) {
    yPos += 3;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Forma de pagamento sugerida: ${quote.payment_method_hint}`, margin, yPos);
  }

  yPos += 12;

  if (quote.notes) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(rgb.r, rgb.g, rgb.b);
    pdf.text("OBSERVAÇÕES", margin, yPos); yPos += 5;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(60, 60, 60);
    const notesLines = pdf.splitTextToSize(quote.notes, contentWidth);
    pdf.text(notesLines, margin, yPos);
    yPos += notesLines.length * 4 + 8;
  }

  // Validity notice
  yPos += 5;
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Este orçamento é válido até ${validDate}. Após esta data, os valores poderão ser alterados.`, margin, yPos);

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text("Documento gerado automaticamente pela VirtualMercado", pageWidth / 2, pageHeight - 10, { align: "center" });

  const fileName = `orcamento_${quoteNumber}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  pdf.save(fileName);
};
