import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_FOOTER = "Documento gerado automaticamente pela ShopDrive";

/**
 * Rodapé dinâmico: nome da loja apenas quando o plano pago estiver
 * efetivamente ativo (fonte autoritativa: RPC get_effective_store_plan).
 * Sem cache global — resolvido por pedido/loja a cada geração.
 */
const resolveFooterText = async (order: { store_owner_id?: string | null }): Promise<string> => {
  const storeOwnerId = order?.store_owner_id;
  if (!storeOwnerId) return DEFAULT_FOOTER;

  try {
    const { data: planData, error: planError } = await supabase.rpc("get_effective_store_plan", {
      p_store_id: storeOwnerId,
    });
    if (planError || !planData) return DEFAULT_FOOTER;

    const plan = planData as {
      plan?: string;
      subscriptionStatus?: string;
      resolved?: boolean;
    };

    const effectivePlan = (plan.plan || "free").toLowerCase();
    const status = (plan.subscriptionStatus || "none").toLowerCase();
    const hasActivePaidPlan =
      plan.resolved === true && effectivePlan !== "free" && effectivePlan !== "unknown" && status === "active";

    if (!hasActivePaidPlan) return DEFAULT_FOOTER;

    const { data: profile } = await supabase
      .from("profiles")
      .select("store_name")
      .eq("id", storeOwnerId)
      .maybeSingle();

    const storeName = (profile?.store_name || "").trim();
    return storeName ? `Documento gerado automaticamente por ${storeName}` : DEFAULT_FOOTER;
  } catch {
    return DEFAULT_FOOTER;
  }
};


interface OrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
  variations?: any;
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
  store_owner_id?: string | null;

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

  // ==================== PAGINATION HELPERS ====================

  const FOOTER_RESERVED = 14; // altura reservada ao rodapé em todas as páginas
  const contentBottom = pageHeight - margin - FOOTER_RESERVED;
  const usableHeight = contentBottom - margin;

  const colWidths = { item: 12, desc: 85, qty: 25, unit: 28, total: 30 };

  const drawTableHeader = () => {
    const headerY = yPos + 4;
    pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    pdf.rect(margin, headerY - 4, contentWidth, 8, "F");

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);

    let hx = margin + 2;
    pdf.text("ITEM", hx, headerY);
    hx += colWidths.item;
    pdf.text("DESCRIÇÃO", hx, headerY);
    hx += colWidths.desc;
    pdf.text("QTD", hx + 5, headerY);
    hx += colWidths.qty;
    pdf.text("VL. UNIT.", hx, headerY);
    hx += colWidths.unit;
    pdf.text("VL. TOTAL", hx, headerY);

    yPos = headerY + 6;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(40, 40, 40);
  };

  // Cria nova página apenas quando existe conteúdo pendente que não cabe
  const ensureSpace = (needed: number, repeatTableHeader = false) => {
    if (yPos + needed <= contentBottom) return false;
    pdf.addPage();
    yPos = margin;
    if (repeatTableHeader) drawTableHeader();
    return true;
  };

  // ==================== ITEMS TABLE ====================

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
  pdf.text("ITENS DO PEDIDO", margin, yPos);
  yPos += 6;

  drawTableHeader();

  // Table rows
  pdf.setTextColor(40, 40, 40);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);

  const items = order.order_items || [];
  let totalItems = 0;
  let totalUnits = 0;
  let productsTotal = 0;
  let renderedRows = 0;

  const DESC_LINE_H = 4;
  const VAR_LINE_H = 3.5;

  items.forEach((item, index) => {
    const variationsText =
      item.variations && typeof item.variations === "object" && !Array.isArray(item.variations)
        ? Object.entries(item.variations as Record<string, unknown>)
            .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
            .map(([k, v]) => `${k}: ${v}`)
            .join(" • ")
        : "";

    pdf.setFontSize(8);
    const nameLines: string[] = pdf.splitTextToSize(
      String(item.product_name || "Produto"),
      colWidths.desc - 3
    );
    pdf.setFontSize(7);
    const varLines: string[] = variationsText
      ? pdf.splitTextToSize(variationsText, colWidths.desc - 3)
      : [];
    pdf.setFontSize(8);

    // blocos de texto da descrição (nome + variações), com altura de linha própria
    const blocks: { text: string; h: number; variation: boolean }[] = [
      ...nameLines.map((t) => ({ text: t, h: DESC_LINE_H, variation: false })),
      ...varLines.map((t) => ({ text: t, h: VAR_LINE_H, variation: true })),
    ];

    let cursor = 0;
    let firstChunk = true;

    // Renderiza a linha em blocos; linhas maiores que a página são
    // continuadas na página seguinte sem perda de conteúdo.
    while (cursor < blocks.length) {
      // altura mínima para renderizar pelo menos um bloco
      const minChunk = 3 + blocks[cursor].h;
      ensureSpace(minChunk, true);

      // quantos blocos cabem no espaço restante desta página
      const available = contentBottom - yPos - 3;
      let used = 0;
      let end = cursor;
      while (end < blocks.length && used + blocks[end].h <= Math.max(available, blocks[cursor].h)) {
        used += blocks[end].h;
        end += 1;
      }
      if (end === cursor) {
        used = blocks[cursor].h;
        end = cursor + 1;
      }

      // Se a linha inteira cabe, mantém o bloco íntegro (break-inside: avoid)
      if (firstChunk && end < blocks.length) {
        const fullHeight = 3 + blocks.reduce((acc, b) => acc + b.h, 0);
        if (fullHeight <= usableHeight) {
          ensureSpace(fullHeight, true);
          used = fullHeight - 3;
          end = blocks.length;
        }
      }

      const rowHeight = used + 3;
      const rowY = yPos;

      if (index % 2 === 0) {
        pdf.setFillColor(248, 248, 248);
        pdf.rect(margin, rowY - 4, contentWidth, rowHeight, "F");
      }

      let colX = margin + 2;
      pdf.setTextColor(40, 40, 40);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);

      if (firstChunk) {
        pdf.text(String(index + 1).padStart(2, "0"), colX, rowY);
      }
      colX += colWidths.item;

      let textY = rowY;
      for (let b = cursor; b < end; b += 1) {
        const block = blocks[b];
        if (block.variation) {
          pdf.setFontSize(7);
          pdf.setTextColor(110, 110, 110);
        } else {
          pdf.setFontSize(8);
          pdf.setTextColor(40, 40, 40);
        }
        pdf.text(block.text, colX, textY);
        textY += block.h;
      }
      pdf.setFontSize(8);
      pdf.setTextColor(40, 40, 40);
      colX += colWidths.desc;

      if (firstChunk) {
        pdf.text(String(item.quantity), colX + 8, rowY);
        colX += colWidths.qty;
        pdf.text(`R$ ${Number(item.product_price || 0).toFixed(2)}`, colX, rowY);
        colX += colWidths.unit;
        pdf.text(`R$ ${Number(item.subtotal || 0).toFixed(2)}`, colX, rowY);
      }

      yPos += rowHeight;
      cursor = end;
      firstChunk = false;
    }

    renderedRows += 1;
    totalItems += 1;
    totalUnits += Number(item.quantity || 0);
    productsTotal += Number(item.subtotal || 0);
  });

  // Invariante de integridade: nenhum item pode ser perdido
  if (renderedRows !== items.length) {
    throw new Error(
      `PDF incompleto: ${renderedRows} de ${items.length} itens renderizados (pedido ${order.id}).`
    );
  }

  yPos += 5;

  // ==================== TOTALS ====================

  // Bloco de totais precisa caber íntegro; caso contrário vai para a próxima página
  const totalsBlockHeight =
    8 + 6 + 5 + (order.delivery_fee && order.delivery_fee > 0 ? 5 : 0) + 6 + 5 + (order.payment_method ? 8 : 0);
  ensureSpace(totalsBlockHeight);

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
    yPos += 5;
  }

  yPos += 7;

  // ==================== OBSERVATIONS ====================

  if (order.notes) {
    pdf.setFontSize(9);
    const notesLines: string[] = pdf.splitTextToSize(order.notes, contentWidth);

    ensureSpace(5 + 4 + 4); // título + primeira linha

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(rgb.r, rgb.g, rgb.b);
    pdf.text("OBSERVAÇÕES", margin, yPos);
    yPos += 5;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(60, 60, 60);

    // Observações longas quebram entre páginas sem perda de texto
    notesLines.forEach((line) => {
      ensureSpace(4);
      pdf.text(line, margin, yPos);
      yPos += 4;
    });
    yPos += 8;
  }

  // ==================== SIGNATURE AREA ====================

  const SIGNATURE_BLOCK = 27;
  yPos += 12; // respiro após os totais/observações
  if (yPos + SIGNATURE_BLOCK > contentBottom) {
    pdf.addPage();
    yPos = margin;
  }


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

  // ==================== FOOTER (todas as páginas) ====================

  const footerText = await resolveFooterText(order);
  const totalPages = pdf.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(150, 150, 150);

    const footerLines: string[] = pdf.splitTextToSize(footerText, contentWidth - 40).slice(0, 2);
    const footerStartY = pageHeight - 10 - (footerLines.length - 1) * 4;
    footerLines.forEach((line: string, i: number) => {
      pdf.text(line, pageWidth / 2, footerStartY + i * 4, { align: "center" });
    });

    if (totalPages > 1) {
      pdf.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 10, {
        align: "right",
      });
    }
  }

  // Save PDF
  const fileName = `pedido_${order.order_number || order.id.slice(0, 8)}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  pdf.save(fileName);
};
