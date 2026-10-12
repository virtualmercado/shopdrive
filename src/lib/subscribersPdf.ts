import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import {
  type SubscriberRow, NOT_INFORMED, planLabel, statusLabel, setupLabel, publicStoreUrl, primaryContactPhone,
} from "./subscriberContacts";

/** PDF A4 horizontal paginado da lista filtrada de assinantes (uso interno do Master). */
export const generateSubscribersPdf = (rows: SubscriberRow[], filtersText: string): Blob => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(14);
  doc.text("ShopDrive — Lista de Assinantes", 10, 12);
  doc.setFontSize(8);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} · Total: ${rows.length} registros`, 10, 18);
  doc.text(doc.splitTextToSize(`Filtros: ${filtersText}`, w - 20), 10, 22);

  autoTable(doc, {
    startY: 28,
    styles: { fontSize: 7, cellPadding: 1.2, overflow: "linebreak" },
    headStyles: { fillColor: [17, 24, 39] },
    head: [["Loja", "Responsável", "E-mail", "Telefone/WhatsApp", "Plano", "Status", "Produtos", "Cadastro", "Configuração", "Link público"]],
    body: rows.map((r) => [
      r.store_name || NOT_INFORMED,
      r.full_name || NOT_INFORMED,
      r.account_email || r.profile_email || NOT_INFORMED,
      primaryContactPhone(r) || NOT_INFORMED,
      planLabel(r.plan_code),
      statusLabel(r.filter_status),
      String(r.product_count),
      format(new Date(r.created_at), "dd/MM/yyyy"),
      setupLabel(r),
      publicStoreUrl(r.store_slug) || NOT_INFORMED,
    ]),
    margin: { left: 10, right: 10, bottom: 14 },
    didDrawPage: () => {
      doc.setFontSize(7);
      doc.text("Documento interno — dados de contato de lojistas ShopDrive", 10, h - 6);
      doc.text(`Página ${doc.getNumberOfPages()}`, w - 10, h - 6, { align: "right" });
    },
  });
  return doc.output("blob");
};
