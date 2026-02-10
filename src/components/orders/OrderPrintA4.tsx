import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

interface CustomerData {
  full_name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  customer_code?: string;
}

interface OrderData {
  id: string;
  order_number?: string | null;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  customer_address?: string | null;
  total_amount: number;
  subtotal?: number | null;
  delivery_fee?: number | null;
  payment_method?: string | null;
  notes?: string | null;
  order_items?: OrderItem[];
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
  primary_color?: string | null;
}

interface PrintOrderParams {
  order: OrderData;
  store: StoreData;
  customer?: CustomerData;
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 106, g: 27, b: 154 }; // Default purple
};

export const printOrderA4 = async ({ order, store, customer }: PrintOrderParams) => {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Fixed black color for professional print output (ERP standard)
  const rgb = { r: 0, g: 0, b: 0 };

  // ==================== HEADER ====================
  
  // Store Logo
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
    } catch (e) {
      // Skip logo if can't load
    }
  }

  // Store Info (right side of logo)
  const storeInfoX = store.store_logo_url ? margin + 35 : margin;
  
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text(store.store_name || "Minha Loja", storeInfoX, yPos + 7);
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(60, 60, 60);
  
  let infoY = yPos + 13;
  if (store.address) {
    pdf.text(store.address, storeInfoX, infoY);
    infoY += 4;
  }
  if (store.address_city && store.address_state) {
    pdf.text(`${store.address_city} / ${store.address_state}`, storeInfoX, infoY);
    infoY += 4;
  }
  if (store.phone || store.whatsapp_number) {
    const phones = [store.phone, store.whatsapp_number].filter(Boolean).join(" | ");
    pdf.text(`Tel: ${phones}`, storeInfoX, infoY);
    infoY += 4;
  }
  if (store.email) {
    pdf.text(`Email: ${store.email}`, storeInfoX, infoY);
  }

  // Order number and date (right side)
  const orderDate = format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const orderNumber = order.order_number || `#${order.id.slice(0, 8)}`;
  
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text(`PEDIDO ${orderNumber}`, pageWidth - margin, yPos + 7, { align: "right" });
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(60, 60, 60);
  pdf.text(`Emissão: ${orderDate}`, pageWidth - margin, yPos + 13, { align: "right" });

  yPos += 38;

  // Divider line
  pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // ==================== CUSTOMER INFO ====================
  
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text("DADOS DO CLIENTE", margin, yPos);
  yPos += 6;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(40, 40, 40);

  // Customer name
  pdf.setFont("helvetica", "bold");
  pdf.text("Nome:", margin, yPos);
  pdf.setFont("helvetica", "normal");
  pdf.text(order.customer_name, margin + 15, yPos);
  yPos += 5;

  // Customer code (if available)
  if (customer?.customer_code) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Código:", margin, yPos);
    pdf.setFont("helvetica", "normal");
    pdf.text(customer.customer_code, margin + 18, yPos);
    yPos += 5;
  }

  // CPF/CNPJ
  if (customer?.cpf) {
    pdf.setFont("helvetica", "bold");
    pdf.text("CPF/CNPJ:", margin, yPos);
    pdf.setFont("helvetica", "normal");
    pdf.text(customer.cpf, margin + 22, yPos);
    yPos += 5;
  }

  // Address
  if (order.customer_address) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Endereço:", margin, yPos);
    pdf.setFont("helvetica", "normal");
    const addressLines = pdf.splitTextToSize(order.customer_address, contentWidth - 25);
    pdf.text(addressLines, margin + 22, yPos);
    yPos += addressLines.length * 4;
  }

  // Phone and Email
  const contactInfo = [];
  if (order.customer_phone) contactInfo.push(`Tel: ${order.customer_phone}`);
  if (order.customer_email) contactInfo.push(`Email: ${order.customer_email}`);
  
  if (contactInfo.length > 0) {
    yPos += 1;
    pdf.text(contactInfo.join("  |  "), margin, yPos);
  }

  yPos += 10;

  // ==================== ITEMS TABLE ====================
  
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text("ITENS DO PEDIDO", margin, yPos);
  yPos += 6;

  // Table header
  const colWidths = { item: 12, desc: 85, qty: 25, unit: 28, total: 30 };
  const headerY = yPos;
  
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
  pdf.rect(margin, headerY - 4, contentWidth, 8, "F");
  
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  
  let colX = margin + 2;
  pdf.text("ITEM", colX, headerY);
  colX += colWidths.item;
  pdf.text("DESCRIÇÃO", colX, headerY);
  colX += colWidths.desc;
  pdf.text("QTD", colX + 5, headerY);
  colX += colWidths.qty;
  pdf.text("VL. UNIT.", colX, headerY);
  colX += colWidths.unit;
  pdf.text("VL. TOTAL", colX, headerY);

  yPos = headerY + 6;

  // Table rows
  pdf.setTextColor(40, 40, 40);
  pdf.setFont("helvetica", "normal");
  
  let totalItems = 0;
  let totalUnits = 0;
  let productsTotal = 0;

  (order.order_items || []).forEach((item, index) => {
    const rowY = yPos;
    
    // Alternate row background
    if (index % 2 === 0) {
      pdf.setFillColor(248, 248, 248);
      pdf.rect(margin, rowY - 4, contentWidth, 7, "F");
    }

    colX = margin + 2;
    pdf.text(String(index + 1).padStart(2, "0"), colX, rowY);
    colX += colWidths.item;
    
    // Truncate description if too long
    const descText = item.product_name.length > 40 
      ? item.product_name.substring(0, 40) + "..." 
      : item.product_name;
    pdf.text(descText, colX, rowY);
    colX += colWidths.desc;
    
    pdf.text(String(item.quantity), colX + 8, rowY);
    colX += colWidths.qty;
    
    pdf.text(`R$ ${item.product_price.toFixed(2)}`, colX, rowY);
    colX += colWidths.unit;
    
    pdf.text(`R$ ${item.subtotal.toFixed(2)}`, colX, rowY);

    yPos += 7;
    totalItems++;
    totalUnits += item.quantity;
    productsTotal += item.subtotal;
  });

  yPos += 5;

  // ==================== TOTALS ====================
  
  // Divider
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  const totalsX = pageWidth - margin - 60;
  pdf.setFontSize(9);
  
  // Items count
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 80);
  pdf.text(`Nº de Itens: ${totalItems}`, margin, yPos);
  pdf.text(`Total de Unidades: ${totalUnits}`, margin + 40, yPos);
  yPos += 6;

  // Products subtotal
  pdf.text("Total de Produtos:", totalsX, yPos);
  pdf.setFont("helvetica", "bold");
  pdf.text(`R$ ${productsTotal.toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 5;

  // Shipping
  if (order.delivery_fee && order.delivery_fee > 0) {
    pdf.setFont("helvetica", "normal");
    pdf.text("Frete:", totalsX, yPos);
    pdf.text(`R$ ${order.delivery_fee.toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });
    yPos += 5;
  }

  // Order total
  pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
  pdf.setLineWidth(0.5);
  pdf.line(totalsX - 5, yPos, pageWidth - margin, yPos);
  yPos += 6;
  
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text("TOTAL DO PEDIDO:", totalsX, yPos);
  pdf.text(`R$ ${order.total_amount.toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 5;

  // Payment method
  if (order.payment_method) {
    yPos += 3;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(80, 80, 80);
    const paymentLabel = {
      pix: "PIX",
      dinheiro: "Dinheiro",
      credito: "Cartão de Crédito",
      debito: "Cartão de Débito",
    }[order.payment_method] || order.payment_method;
    pdf.text(`Forma de Pagamento: ${paymentLabel}`, margin, yPos);
  }

  yPos += 12;

  // ==================== OBSERVATIONS ====================
  
  if (order.notes) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(rgb.r, rgb.g, rgb.b);
    pdf.text("OBSERVAÇÕES", margin, yPos);
    yPos += 5;
    
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(60, 60, 60);
    const notesLines = pdf.splitTextToSize(order.notes, contentWidth);
    pdf.text(notesLines, margin, yPos);
    yPos += notesLines.length * 4 + 8;
  }

  // ==================== SIGNATURE AREA ====================
  
  // Check if we need a new page
  if (yPos > pageHeight - 60) {
    pdf.addPage();
    yPos = margin;
  }

  yPos = Math.max(yPos, pageHeight - 55);

  pdf.setDrawColor(150, 150, 150);
  pdf.setLineWidth(0.3);

  // Date received
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 80);
  pdf.text("Data de Recebimento:", margin, yPos);
  pdf.line(margin + 45, yPos, margin + 90, yPos);
  yPos += 12;

  // Signature line
  pdf.text("Assinatura do Recebedor:", margin, yPos);
  pdf.line(margin + 50, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text("Documento gerado automaticamente pela VirtualMercado", pageWidth / 2, pageHeight - 10, { align: "center" });

  // Save PDF
  const fileName = `pedido_${order.order_number || order.id.slice(0, 8)}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  pdf.save(fileName);
};
