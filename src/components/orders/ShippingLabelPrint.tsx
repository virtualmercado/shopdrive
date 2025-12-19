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

// Code 128 encoding patterns (Start B, characters, checksum, stop)
const CODE128_PATTERNS: { [key: string]: string } = {
  ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
  '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
  '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000100100',
  ',': '10110011100', '-': '10011011100', '.': '10011001110', '/': '10111001100',
  '0': '10011101100', '1': '11001110010', '2': '11001011100', '3': '11001001110',
  '4': '11011100100', '5': '11001110100', '6': '11101101110', '7': '11101001100',
  '8': '11100101100', '9': '11100100110', ':': '11101100100', ';': '11100110100',
  '<': '11100110010', '=': '11011011000', '>': '11011000110', '?': '11000110110',
  '@': '10100011000', 'A': '10001011000', 'B': '10001000110', 'C': '10110001000',
  'D': '10001101000', 'E': '10001100010', 'F': '11010001000', 'G': '11000101000',
  'H': '11000100010', 'I': '10110111000', 'J': '10110001110', 'K': '10001101110',
  'L': '10111011000', 'M': '10111000110', 'N': '10001110110', 'O': '11101110110',
  'P': '11010001110', 'Q': '11000101110', 'R': '11011101000', 'S': '11011100010',
  'T': '11011101110', 'U': '11101011000', 'V': '11101000110', 'W': '11100010110',
  'X': '11101101000', 'Y': '11101100010', 'Z': '11100011010', '[': '11101111010',
  '\\': '11001000010', ']': '11110001010', '^': '10100110000', '_': '10100001100',
  'START_B': '11010010000',
  'STOP': '1100011101011'
};

const CODE128_VALUES: { [key: string]: number } = {
  ' ': 0, '!': 1, '"': 2, '#': 3, '$': 4, '%': 5, '&': 6, "'": 7, '(': 8, ')': 9,
  '*': 10, '+': 11, ',': 12, '-': 13, '.': 14, '/': 15, '0': 16, '1': 17, '2': 18,
  '3': 19, '4': 20, '5': 21, '6': 22, '7': 23, '8': 24, '9': 25, ':': 26, ';': 27,
  '<': 28, '=': 29, '>': 30, '?': 31, '@': 32, 'A': 33, 'B': 34, 'C': 35, 'D': 36,
  'E': 37, 'F': 38, 'G': 39, 'H': 40, 'I': 41, 'J': 42, 'K': 43, 'L': 44, 'M': 45,
  'N': 46, 'O': 47, 'P': 48, 'Q': 49, 'R': 50, 'S': 51, 'T': 52, 'U': 53, 'V': 54,
  'W': 55, 'X': 56, 'Y': 57, 'Z': 58, '[': 59, '\\': 60, ']': 61, '^': 62, '_': 63
};

// Generate Code 128 barcode binary string
const generateCode128 = (text: string): string => {
  let binary = CODE128_PATTERNS['START_B'];
  let checksum = 104; // Start B value
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (CODE128_PATTERNS[char]) {
      binary += CODE128_PATTERNS[char];
      checksum += CODE128_VALUES[char] * (i + 1);
    }
  }
  
  // Calculate checksum character
  const checksumValue = checksum % 103;
  const checksumChars = Object.keys(CODE128_VALUES);
  const checksumChar = checksumChars.find(c => CODE128_VALUES[c] === checksumValue) || ' ';
  if (CODE128_PATTERNS[checksumChar]) {
    binary += CODE128_PATTERNS[checksumChar];
  }
  
  binary += CODE128_PATTERNS['STOP'];
  return binary;
};

// Draw Code 128 barcode on PDF
const drawBarcode = (
  doc: jsPDF, 
  text: string, 
  x: number, 
  y: number, 
  width: number, 
  height: number
) => {
  const binary = generateCode128(text);
  const moduleWidth = width / binary.length;
  
  doc.setFillColor(0, 0, 0);
  
  let currentX = x;
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      doc.rect(currentX, y, moduleWidth, height, 'F');
    }
    currentX += moduleWidth;
  }
  
  // Draw text below barcode
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  const textWidth = doc.getTextWidth(text);
  doc.text(text, x + (width - textWidth) / 2, y + height + 4);
};

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
  doc.text("Volume: 1/1", margin + labelWidth - 20, yPos, { align: "right" });

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
  doc.rect(margin, yPos, labelWidth, 6, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("DESTINATÁRIO", margin + 2, yPos + 4.5);

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
    customer.number ? `Nº ${customer.number}` : null,
    customer.complement?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(", ");

  if (addressLine1) {
    doc.text(addressLine1 || "ENDEREÇO NÃO INFORMADO", margin, yPos);
    yPos += 4;
  }

  if (customer.neighborhood) {
    doc.text(customer.neighborhood.toUpperCase(), margin, yPos);
    yPos += 5;
  }

  // CEP and City/State - prominent
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
  const cepForBarcode = (customer.cep || "00000000").replace(/\D/g, '');
  const barcodeWidth = 70;
  const barcodeHeight = 18;
  
  drawBarcode(doc, cepForBarcode, margin, yPos, barcodeWidth, barcodeHeight);

  yPos += barcodeHeight + 12;

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
    store.address_number ? `Nº ${store.address_number}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  if (storeAddressLine) {
    doc.text(storeAddressLine, margin, yPos);
    yPos += 4;
  }

  if (store.address_neighborhood) {
    doc.text(`${store.address_neighborhood} ${store.address_complement ? `- ${store.address_complement}` : ""}`.trim(), margin, yPos);
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
