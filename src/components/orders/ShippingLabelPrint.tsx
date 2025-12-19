import jsPDF from "jspdf";

interface ShippingLabelParams {
  order: {
    id: string;
    order_number: string | null;
    created_at: string;
  };
  store: {
    store_name?: string;
    address?: string;
    address_number?: string;
    address_complement?: string;
    address_neighborhood?: string;
    address_city?: string;
    address_state?: string;
    address_zip_code?: string;
    primary_color?: string;
  };
  customer: {
    full_name: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
  };
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 138, g: 43, b: 226 }; // Default purple
};

export const printShippingLabel = ({ order, store, customer }: ShippingLabelParams) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const primaryColor = store.primary_color || "#8B5CF6";
  const rgb = hexToRgb(primaryColor);

  let yPos = margin;

  // ============ HEADER ============
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Date and time - top right
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`${dateStr} ${timeStr}`, pageWidth - margin, yPos + 5, { align: "right" });

  // Order number - centered, prominent
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  const orderNumber = order.order_number || `#${order.id.slice(0, 8)}`;
  doc.text(`Pedido: ${orderNumber.replace("#", "")}`, pageWidth / 2, yPos + 8, { align: "center" });

  // Volume info
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text("Volume: 1/1", pageWidth / 2, yPos + 14, { align: "center" });

  yPos += 25;

  // Divider line
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 10;

  // ============ SIGNATURE BLOCK ============
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, 35);

  // Inner content
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");

  const signatureY = yPos + 8;
  doc.text("Recebedor:", margin + 5, signatureY);
  doc.line(margin + 30, signatureY, margin + 85, signatureY);

  doc.text("Assinatura:", margin + 5, signatureY + 12);
  doc.line(margin + 30, signatureY + 12, margin + 85, signatureY + 12);

  doc.text("Documento:", margin + 95, signatureY);
  doc.line(margin + 120, signatureY, contentWidth + margin - 5, signatureY);

  doc.text("Data:", margin + 95, signatureY + 12);
  doc.line(margin + 110, signatureY + 12, margin + 140, signatureY + 12);

  yPos += 45;

  // ============ DESTINATÁRIO (MAIN BLOCK) ============
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(0.8);
  doc.rect(margin, yPos, contentWidth, 75);

  // Title
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(margin, yPos, contentWidth, 10, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("DESTINATÁRIO", pageWidth / 2, yPos + 7, { align: "center" });

  yPos += 15;

  // Customer name - prominent
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  const customerName = customer.full_name?.toUpperCase() || "CLIENTE";
  doc.text(customerName, margin + 5, yPos + 5);

  yPos += 12;

  // Address lines
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  const addressLine1 = [
    customer.street,
    customer.number ? `Nº ${customer.number}` : null,
    customer.complement,
  ]
    .filter(Boolean)
    .join(", ");

  if (addressLine1) {
    doc.text(addressLine1 || "Endereço não informado", margin + 5, yPos + 5);
    yPos += 7;
  }

  if (customer.neighborhood) {
    doc.text(customer.neighborhood, margin + 5, yPos + 5);
    yPos += 7;
  }

  // City / State / CEP - prominent
  const cityStateCep = [
    customer.city,
    customer.state,
    customer.cep ? `CEP: ${customer.cep}` : null,
  ]
    .filter(Boolean)
    .join(" - ");

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.text(cityStateCep || "Cidade não informada", margin + 5, yPos + 8);

  yPos += 18;

  // Barcode placeholder (simulated)
  const barcodeY = yPos;
  const barcodeWidth = 100;
  const barcodeHeight = 20;
  const barcodeX = pageWidth / 2 - barcodeWidth / 2;

  // Draw barcode lines (simulated)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  const barWidths = [2, 1, 3, 1, 2, 1, 3, 2, 1, 2, 3, 1, 2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2, 3];
  let barX = barcodeX;
  for (let i = 0; i < barWidths.length && barX < barcodeX + barcodeWidth; i++) {
    if (i % 2 === 0) {
      doc.setFillColor(0, 0, 0);
      doc.rect(barX, barcodeY, barWidths[i], barcodeHeight, "F");
    }
    barX += barWidths[i] + 1;
  }

  // Barcode number
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  const barcodeNumber = order.order_number?.replace("#", "") || order.id.slice(0, 12);
  doc.text(barcodeNumber.toUpperCase(), pageWidth / 2, barcodeY + barcodeHeight + 5, { align: "center" });

  yPos = 160;

  // Correios reference (visual only)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 51, 160);
  doc.text("CORREIOS", pageWidth / 2, yPos, { align: "center" });

  yPos += 15;

  // ============ REMETENTE ============
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, 50);

  // Title
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, contentWidth, 8, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.text("Remetente", margin + 5, yPos + 6);

  yPos += 12;

  // Store info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(store.store_name || "Loja", margin + 5, yPos + 5);

  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);

  const storeAddressLine1 = [
    store.address,
    store.address_number ? `Nº ${store.address_number}` : null,
    store.address_complement,
  ]
    .filter(Boolean)
    .join(", ");

  if (storeAddressLine1) {
    doc.text(storeAddressLine1, margin + 5, yPos + 5);
    yPos += 6;
  }

  if (store.address_neighborhood) {
    doc.text(store.address_neighborhood, margin + 5, yPos + 5);
    yPos += 6;
  }

  const storeCityStateCep = [
    store.address_city,
    store.address_state,
    store.address_zip_code ? `CEP: ${store.address_zip_code}` : null,
  ]
    .filter(Boolean)
    .join(" - ");

  if (storeCityStateCep) {
    doc.setFont("helvetica", "bold");
    doc.text(storeCityStateCep, margin + 5, yPos + 5);
  }

  // Save PDF
  const fileName = `etiqueta-envio-${order.order_number?.replace("#", "") || order.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
};
