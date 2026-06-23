import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportProduct {
  name: string;
  sku?: string | null;
  unit?: string | null;
  price: number;
  promotional_price?: number | null;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const today = () =>
  new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export function exportPriceListPDF(opts: {
  storeName: string;
  products: ExportProduct[];
}) {
  const { storeName, products } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFontSize(16);
  doc.text(storeName || "Loja", 40, 50);
  doc.setFontSize(12);
  doc.text("Tabela de Preços", 40, 70);
  doc.setFontSize(10);
  doc.text(`Emitido em: ${today()}`, 40, 86);
  doc.text(`Total de produtos: ${products.length}`, 40, 100);

  autoTable(doc, {
    startY: 120,
    head: [["Produto", "SKU / Código", "Unidade", "Preço"]],
    body: products.map((p) => [
      p.name,
      p.sku || "—",
      p.unit || "—",
      formatBRL(Number(p.promotional_price ?? p.price ?? 0)),
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 30] },
    didDrawPage: (data) => {
      const str = `Página ${doc.getNumberOfPages()}`;
      doc.setFontSize(9);
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      doc.text(str, pageSize.getWidth() - 80, pageHeight - 20);
    },
    margin: { top: 120, left: 40, right: 40, bottom: 40 },
  });

  doc.save(`tabela-precos-${Date.now()}.pdf`);
}

export function printPriceList(opts: {
  storeName: string;
  products: ExportProduct[];
}) {
  const { storeName, products } = opts;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;

  const rows = products
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.sku || "—")}</td>
        <td>${escapeHtml(p.unit || "—")}</td>
        <td style="text-align:right">${formatBRL(
          Number(p.promotional_price ?? p.price ?? 0)
        )}</td>
      </tr>`
    )
    .join("");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Tabela de Preços</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;color:#111}
      h1{margin:0 0 4px;font-size:20px}
      h2{margin:0 0 12px;font-size:14px;font-weight:500;color:#444}
      .meta{font-size:12px;color:#555;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border-bottom:1px solid #ddd;padding:8px 10px;text-align:left}
      th{background:#f4f4f4}
      @media print { .noprint{display:none} }
    </style></head><body>
    <h1>${escapeHtml(storeName || "Loja")}</h1>
    <h2>Tabela de Preços</h2>
    <div class="meta">Emitido em: ${today()} • Total de produtos: ${products.length}</div>
    <table>
      <thead><tr><th>Produto</th><th>SKU / Código</th><th>Unidade</th><th style="text-align:right">Preço</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="noprint" style="margin-top:16px"><button onclick="window.print()">Imprimir</button></div>
    </body></html>`);
  w.document.close();
  setTimeout(() => {
    try { w.focus(); w.print(); } catch {}
  }, 300);
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
