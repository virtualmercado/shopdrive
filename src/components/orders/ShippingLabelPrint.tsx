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

export const printShippingLabel = ({ order, store, customer }: ShippingLabelParams) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 10;
  const labelWidth = 100;
  
  let yPos = margin;

  // ============ HEADER ============
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Date and time - top left
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`${dateStr}, ${timeStr}`, margin, yPos + 5);

  yPos += 15;

  // Order number and Volume - aligned left
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  const orderNumber = order.order_number || `#${order.id.slice(0, 8)}`;
  doc.text(`Pedido: ${orderNumber.replace("#", "")}`, margin, yPos);
  doc.text("Volume: 1/0", margin + labelWidth - 20, yPos, { align: "right" });

  yPos += 8;

  // ============ SIGNATURE LINES ============
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);

  doc.text("Recebedor:", margin, yPos);
  doc.line(margin + 20, yPos, margin + labelWidth, yPos);

  yPos += 6;

  doc.text("Assinatura:", margin, yPos);
  doc.line(margin + 20, yPos, margin + 55, yPos);
  doc.text("Documento:", margin + 58, yPos);
  doc.line(margin + 78, yPos, margin + labelWidth, yPos);

  yPos += 8;

  // ============ DESTINATÁRIO BLOCK ============
  // Title bar with black background
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, yPos, 70, 6, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("DESTINATÁRIO", margin + 2, yPos + 4.5);

  // Correios logo - blue color
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 51, 160); // Correios blue
  doc.text("Correios", margin + labelWidth - 5, yPos + 4.5, { align: "right" });

  yPos += 10;

  // Customer name - prominent, black
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  const customerName = customer.full_name?.toUpperCase() || "CLIENTE";
  doc.text(customerName, margin, yPos);

  yPos += 5;

  // Address lines - black
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);

  const addressLine1 = [
    customer.street?.toUpperCase(),
    customer.complement?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(", ");

  if (addressLine1) {
    doc.text(addressLine1 || "ENDEREÇO NÃO INFORMADO", margin, yPos);
    yPos += 4;
  }

  if (customer.number) {
    doc.text(`PREF: ${customer.number}`, margin, yPos);
    yPos += 4;
  }

  if (customer.neighborhood) {
    doc.text(customer.neighborhood.toUpperCase(), margin, yPos);
    yPos += 5;
  }

  // CEP and City/State - prominent, red for CEP
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 0, 0); // Red for CEP
  if (customer.cep) {
    doc.text(customer.cep, margin, yPos);
  }
  
  doc.setTextColor(0, 0, 0); // Black for city/state
  const cityState = [customer.city, customer.state].filter(Boolean).join("/");
  if (cityState) {
    const cepWidth = customer.cep ? doc.getTextWidth(customer.cep) + 3 : 0;
    doc.text(cityState, margin + cepWidth, yPos);
  }

  yPos += 10;

  // ============ BARCODE ============
  const barcodeWidth = 80;
  const barcodeHeight = 15;
  const barcodeX = margin;

  // Draw barcode lines (simulated)
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(0, 0, 0);
  const barWidths = [2, 1, 3, 1, 2, 1, 3, 2, 1, 2, 3, 1, 2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2];
  let barX = barcodeX;
  for (let i = 0; i < barWidths.length && barX < barcodeX + barcodeWidth; i++) {
    if (i % 2 === 0) {
      doc.rect(barX, yPos, barWidths[i], barcodeHeight, "F");
    }
    barX += barWidths[i] + 0.5;
  }

  yPos += barcodeHeight + 8;

  // ============ REMETENTE ============
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Remetente:", margin, yPos);

  doc.setFont("helvetica", "normal");
  const storeName = store.store_name?.toUpperCase() || "LOJA";
  doc.text(` ${storeName}`, margin + doc.getTextWidth("Remetente:"), yPos);

  yPos += 4;

  // Store address
  doc.setFontSize(8);
  const storeAddressLine = [
    store.address,
    store.address_number,
  ]
    .filter(Boolean)
    .join(", ");

  if (storeAddressLine) {
    doc.text(storeAddressLine, margin, yPos);
    yPos += 4;
  }

  if (store.address_neighborhood) {
    doc.text(`${store.address_neighborhood} - ${store.address_complement || ""}`.trim(), margin, yPos);
    yPos += 4;
  }

  // Store CEP and City/State
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 0, 0); // Red for CEP
  if (store.address_zip_code) {
    doc.text(store.address_zip_code, margin, yPos);
  }
  
  doc.setTextColor(0, 0, 0); // Black for city/state
  const storeCityState = [store.address_city, store.address_state].filter(Boolean).join("-");
  if (storeCityState) {
    const storeCepWidth = store.address_zip_code ? doc.getTextWidth(store.address_zip_code) + 3 : 0;
    doc.text(storeCityState, margin + storeCepWidth, yPos);
  }

  // Save PDF
  const fileName = `etiqueta-envio-${order.order_number?.replace("#", "") || order.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
};
