import { useState, useEffect } from "react";
import { FileText, Download, Copy, RefreshCw, Printer, Check, Grid3X3, Grid2X2, LayoutList, MapPin } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { buildGoogleMapsSearchUrl } from "@/lib/maps";
import iconWhatsAppOutline from "@/assets/icon-whatsapp-outline.jpg";
import iconMapPin from "@/assets/icon-map-pin.jpg";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
  category_id: string | null;
  variations: unknown;
}

interface Category {
  id: string;
  name: string;
}

interface StoreProfile {
  store_slug: string;
  store_logo_url: string | null;
  address: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
  email: string | null;
  whatsapp_number: string | null;
  primary_color: string | null;
}

type ProductsPerPage = 9 | 4 | 2;

const DEFAULT_PRIMARY_COLOR = "#6a1b9a";

const CatalogPDF = () => {
  const { user } = useAuth();
  const { primaryColor, buttonBgColor, buttonTextColor } = useTheme();
  
  const [filterType, setFilterType] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [productsPerPage, setProductsPerPage] = useState<ProductsPerPage>(9);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [catalogUrl, setCatalogUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    applyFilter();
  }, [filterType, selectedCategory, selectedProduct, products]);

  const fetchData = async () => {
    if (!user) return;

    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, description, price, promotional_price, image_url, category_id, variations")
      .eq("user_id", user.id)
      .order("name");

    if (productsData) {
      setProducts(productsData);
    }

    const { data: categoriesData } = await supabase
      .from("product_categories")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name");

    if (categoriesData) {
      setCategories(categoriesData);
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("store_slug, store_logo_url, address, address_number, address_neighborhood, address_city, address_state, address_zip_code, email, whatsapp_number, primary_color")
      .eq("id", user.id)
      .single();

    if (profileData) {
      setStoreProfile(profileData);
    }
  };

  const applyFilter = () => {
    if (!filterType) {
      setFilteredProducts([]);
      return;
    }

    if (filterType === "all") {
      setFilteredProducts(products);
    } else if (filterType === "list") {
      const sortedProducts = [...products].sort((a, b) => 
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      );
      setFilteredProducts(sortedProducts);
    } else if (filterType === "category" && selectedCategory) {
      setFilteredProducts(products.filter(p => p.category_id === selectedCategory));
    } else if (filterType === "single" && selectedProduct) {
      setFilteredProducts(products.filter(p => p.id === selectedProduct));
    } else {
      setFilteredProducts([]);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getFullAddress = () => {
    if (!storeProfile) return "";
    const parts = [
      storeProfile.address,
      storeProfile.address_number,
      storeProfile.address_neighborhood,
      storeProfile.address_city,
      storeProfile.address_state,
      storeProfile.address_zip_code
    ].filter(Boolean);
    return parts.join(", ");
  };

  const getHexColor = () => {
    return storeProfile?.primary_color || primaryColor || DEFAULT_PRIMARY_COLOR;
  };

  const parseHexColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) || 106;
    const g = parseInt(hex.slice(3, 5), 16) || 27;
    const b = parseInt(hex.slice(5, 7), 16) || 154;
    return { r, g, b };
  };

  // Helper function to load image and get dimensions
  const loadImageWithDimensions = (url: string, preserveTransparency: boolean = false): Promise<{ data: string; width: number; height: number; format: string } | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          if (!preserveTransparency) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0);
          const format = preserveTransparency ? "image/png" : "image/jpeg";
          const data = canvas.toDataURL(format, 0.9);
          resolve({ data, width: img.naturalWidth, height: img.naturalHeight, format: preserveTransparency ? "PNG" : "JPEG" });
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const calculateImageDimensions = (
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ) => {
    const aspectRatio = originalWidth / originalHeight;
    let finalWidth = maxWidth;
    let finalHeight = maxWidth / aspectRatio;

    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = maxHeight * aspectRatio;
    }

    return { width: finalWidth, height: finalHeight };
  };

  // Find best product image for cover
  const selectBestCoverImage = (): string | null => {
    const productsWithImages = filteredProducts.filter(p => p.image_url);
    if (productsWithImages.length === 0) return null;
    // Select first product with image (could be improved with AI selection)
    return productsWithImages[0].image_url;
  };

  // Generate Cover Page
  const generateCoverPage = async (pdf: jsPDF) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);

    // White background
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");

    // 3 vertical stripes on the left side (reaching middle of page)
    // Stripe 1: widest, starts at left edge
    const stripe1Width = 40;
    // Stripe 2: half the width of stripe 1
    const stripe2Width = stripe1Width / 2;
    // Stripe 3: half the width of stripe 2
    const stripe3Width = stripe2Width / 2;
    
    const gap = 6; // Gap between stripes
    
    // Draw stripe 1 (leftmost, full width)
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, stripe1Width, pageHeight, "F");
    
    // Draw stripe 2 
    const stripe2X = stripe1Width + gap;
    pdf.rect(stripe2X, 0, stripe2Width, pageHeight, "F");
    
    // Draw stripe 3 (reaches approximately middle of page)
    const stripe3X = stripe2X + stripe2Width + gap;
    pdf.rect(stripe3X, 0, stripe3Width, pageHeight, "F");

    // White rectangle overlay in center
    const rectWidth = 100;
    const rectHeight = 160;
    const rectX = (pageWidth - rectWidth) / 2;
    const rectY = (pageHeight - rectHeight) / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(rectX, rectY, rectWidth, rectHeight, "F");

    // Title text
    const textCenterX = pageWidth / 2;
    let currentY = rectY + 40;

    pdf.setFontSize(28);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    pdf.text("CATÁLOGO", textCenterX, currentY, { align: "center" });
    currentY += 12;
    // "de" in lowercase with smaller font
    pdf.setFontSize(16);
    pdf.text("de", textCenterX, currentY, { align: "center" });
    currentY += 12;
    pdf.setFontSize(28);
    pdf.text("PRODUTOS", textCenterX, currentY, { align: "center" });
    currentY += 25;

    // Year
    const currentYear = new Date().getFullYear();
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(currentYear), textCenterX, currentY, { align: "center" });
    currentY += 30;

    // Logo
    if (storeProfile?.store_logo_url) {
      const logoImage = await loadImageWithDimensions(storeProfile.store_logo_url, true);
      if (logoImage) {
        const logoMaxWidth = 60;
        const logoMaxHeight = 40;
        const logoDimensions = calculateImageDimensions(
          logoImage.width,
          logoImage.height,
          logoMaxWidth,
          logoMaxHeight
        );
        const logoX = textCenterX - (logoDimensions.width / 2);
        pdf.addImage(logoImage.data, logoImage.format, logoX, currentY, logoDimensions.width, logoDimensions.height);
      }
    }
  };

  // Generate Back Cover (Contracapa)
  const generateBackCover = async (pdf: jsPDF) => {
    pdf.addPage();
    const pageWidth = 210;
    const pageHeight = 297;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);

    // Top half with primary color
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, pageWidth, pageHeight / 2, "F");

    // Bottom half white
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, pageHeight / 2, pageWidth, pageHeight / 2, "F");

    // Logo in center with white background circle
    const centerX = pageWidth / 2;
    const centerY = pageHeight / 2;
    const circleRadius = 35;

    // White circle background for logo
    pdf.setFillColor(255, 255, 255);
    pdf.circle(centerX, centerY, circleRadius, "F");

    // Logo
    if (storeProfile?.store_logo_url) {
      const logoImage = await loadImageWithDimensions(storeProfile.store_logo_url, true);
      if (logoImage) {
        const logoMaxSize = circleRadius * 1.5;
        const logoDimensions = calculateImageDimensions(
          logoImage.width,
          logoImage.height,
          logoMaxSize,
          logoMaxSize
        );
        const logoX = centerX - (logoDimensions.width / 2);
        const logoY = centerY - (logoDimensions.height / 2);
        pdf.addImage(logoImage.data, logoImage.format, logoX, logoY, logoDimensions.width, logoDimensions.height);
      }
    }

    // Contact info below logo
    let infoY = centerY + circleRadius + 25;
    pdf.setFontSize(12);
    pdf.setTextColor(50, 50, 50);
    pdf.setFont("helvetica", "normal");

    // Store URL (clickable)
    if (storeProfile?.store_slug) {
      const storeUrl = `${window.location.origin}/loja/${storeProfile.store_slug}`;
      pdf.setTextColor(r, g, b);
      pdf.setFont("helvetica", "bold");
      pdf.text(storeUrl, centerX, infoY, { align: "center" });
      const urlWidth = pdf.getTextWidth(storeUrl);
      pdf.link(centerX - urlWidth / 2, infoY - 4, urlWidth, 6, { url: storeUrl });
      infoY += 15;
    }

    // WhatsApp (clickable) with icon
    if (storeProfile?.whatsapp_number) {
      pdf.setTextColor(50, 50, 50);
      pdf.setFont("helvetica", "normal");
      
      // Format phone number: remove country code (+55) and format as (DDD) XXXXX-XXXX
      const rawNumber = storeProfile.whatsapp_number.replace(/\D/g, '');
      let displayNumber = rawNumber;
      
      // Remove country code (55) if present
      if (rawNumber.startsWith('55') && rawNumber.length > 11) {
        displayNumber = rawNumber.substring(2);
      }
      
      // Format: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
      if (displayNumber.length === 11) {
        displayNumber = `(${displayNumber.substring(0, 2)}) ${displayNumber.substring(2, 7)}-${displayNumber.substring(7)}`;
      } else if (displayNumber.length === 10) {
        displayNumber = `(${displayNumber.substring(0, 2)}) ${displayNumber.substring(2, 6)}-${displayNumber.substring(6)}`;
      }
      
      // Load and draw WhatsApp outline icon
      const whatsappIconData = await loadImageWithDimensions(iconWhatsAppOutline, false);
      if (whatsappIconData) {
        const iconSize = 6;
        const iconX = centerX - 32;
        const iconY = infoY - 4;
        pdf.addImage(whatsappIconData.data, whatsappIconData.format, iconX, iconY, iconSize, iconSize);
      }
      
      // Phone number text
      const whatsappText = displayNumber;
      pdf.text(whatsappText, centerX - 22, infoY, { align: "left" });
      
      const whatsappUrl = `https://wa.me/${rawNumber}`;
      const totalWidth = 60;
      pdf.link(centerX - 35, infoY - 4, totalWidth, 6, { url: whatsappUrl });
      infoY += 15;
    }

    // Physical address (clickable to Google Maps) with map pin icon
    const fullAddress = getFullAddress();
    if (fullAddress) {
      // Load and draw map pin icon
      const mapPinIconData = await loadImageWithDimensions(iconMapPin, false);
      const iconSize = 5;
      const iconX = centerX - 80;
      
      if (mapPinIconData) {
        pdf.addImage(mapPinIconData.data, mapPinIconData.format, iconX, infoY - 3.5, iconSize, iconSize);
      }
      
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      const addressLines = pdf.splitTextToSize(fullAddress, 140);
      const addressStartX = iconX + iconSize + 3;
      let addressY = infoY;
      addressLines.forEach((line: string) => {
        pdf.text(line, addressStartX, addressY, { align: "left" });
        addressY += 5;
      });
      
      const mapsUrl = buildGoogleMapsSearchUrl(fullAddress);
      if (mapsUrl) {
        const totalHeight = addressLines.length * 5;
        pdf.link(iconX - 2, infoY - 4, 155, totalHeight + 4, { url: mapsUrl });
      }
      infoY = addressY;
    }
  };

  // Generate Sidebar with page number only (logo removed from product pages)
  const drawSidebar = async (pdf: jsPDF, pageNumber: number) => {
    const pageHeight = 297;
    const sidebarWidth = 12;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);

    // Sidebar rectangle
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, sidebarWidth, pageHeight, "F");

    // Page number at bottom of sidebar with line break
    // PG on first line, number on second line
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    
    const pageNum = String(pageNumber).padStart(2, '0');
    // "PG" on top line
    pdf.text("PG", sidebarWidth / 2, pageHeight - 22, { align: "center" });
    // Number below
    pdf.text(pageNum, sidebarWidth / 2, pageHeight - 12, { align: "center" });
  };

  // Generate PDF for single product
  const generateSingleProductPDF = async (product: Product) => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Generate cover page first
    await generateCoverPage(pdf);
    
    // Add product page
    pdf.addPage();
    
    const pageWidth = 210;
    const pageHeight = 297;
    const sidebarWidth = 12;
    const margin = 20;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);

    // Draw sidebar (without logo)
    await drawSidebar(pdf, 1);

    // Content area
    const contentStartX = sidebarWidth + margin;
    const contentWidth = pageWidth - sidebarWidth - (margin * 2);
    const contentCenterX = sidebarWidth + (pageWidth - sidebarWidth) / 2;

    let currentY = margin + 10;

    // Product image
    if (product.image_url) {
      const productImageData = await loadImageWithDimensions(product.image_url, false);
      if (productImageData) {
        const imgMaxWidth = 80;
        const imgMaxHeight = 80;
        const imgDimensions = calculateImageDimensions(
          productImageData.width,
          productImageData.height,
          imgMaxWidth,
          imgMaxHeight
        );
        const imgX = contentCenterX - (imgDimensions.width / 2);
        pdf.addImage(productImageData.data, productImageData.format, imgX, currentY, imgDimensions.width, imgDimensions.height);
        currentY += imgDimensions.height + 15;
      }
    }

    // Product title
    pdf.setFontSize(16);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    const titleLines = pdf.splitTextToSize(product.name, contentWidth);
    titleLines.forEach((line: string) => {
      pdf.text(line, contentCenterX, currentY, { align: "center" });
      currentY += 7;
    });
    currentY += 5;

    // Price
    const price = product.promotional_price || product.price;
    pdf.setFontSize(18);
    pdf.setTextColor(20, 20, 20);
    pdf.text(formatPrice(price), contentCenterX, currentY, { align: "center" });
    currentY += 12;

    // "Ver produto" button
    const btnWidth = 50;
    const btnHeight = 10;
    const btnX = contentCenterX - (btnWidth / 2);
    
    pdf.setFillColor(r, g, b);
    pdf.roundedRect(btnX, currentY, btnWidth, btnHeight, 2, 2, "F");
    
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text("Ver produto", contentCenterX, currentY + 6.5, { align: "center" });

    if (storeProfile?.store_slug) {
      const productUrl = `${window.location.origin}/loja/${storeProfile.store_slug}/produto/${product.id}`;
      pdf.link(btnX, currentY, btnWidth, btnHeight, { url: productUrl });
    }
    currentY += btnHeight + 15;

    // Description
    if (product.description) {
      pdf.setFontSize(11);
      pdf.setTextColor(60, 60, 60);
      pdf.setFont("helvetica", "normal");
      const descLines = pdf.splitTextToSize(product.description, contentWidth);
      const maxLines = Math.min(descLines.length, 20);
      for (let i = 0; i < maxLines; i++) {
        pdf.text(descLines[i], contentStartX, currentY);
        currentY += 5;
      }
    }

    // Generate back cover
    await generateBackCover(pdf);

    return pdf;
  };

  // Generate PDF for multiple products with grid layout
  const generateMultipleProductsPDF = async () => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Generate cover page first
    await generateCoverPage(pdf);

    const pageWidth = 210;
    const pageHeight = 297;
    const sidebarWidth = 12;
    const margin = 8;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);

    // Calculate grid based on products per page
    let cols: number, rows: number;
    switch (productsPerPage) {
      case 4:
        cols = 2;
        rows = 2;
        break;
      case 2:
        cols = 1;
        rows = 2;
        break;
      default: // 9
        cols = 3;
        rows = 3;
    }

    const contentStartX = sidebarWidth + margin;
    const contentWidth = pageWidth - sidebarWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);
    
    const cardGap = 6;
    const cardWidth = (contentWidth - (cardGap * (cols - 1))) / cols;
    const cardHeight = (contentHeight - (cardGap * (rows - 1))) / rows;

    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

    for (let page = 0; page < totalPages; page++) {
      pdf.addPage();

      // Draw sidebar (without logo)
      await drawSidebar(pdf, page + 1);

      const startIndex = page * productsPerPage;
      const endIndex = Math.min(startIndex + productsPerPage, filteredProducts.length);
      const pageProducts = filteredProducts.slice(startIndex, endIndex);

      for (let i = 0; i < pageProducts.length; i++) {
        const product = pageProducts[i];
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        const x = contentStartX + col * (cardWidth + cardGap);
        const y = margin + row * (cardHeight + cardGap);

        // Card background
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");

        // Image area
        const imageAreaHeight = cardHeight * 0.5;
        const imageAreaWidth = cardWidth - 8;
        const imageAreaX = x + 4;
        const imageAreaY = y + 4;

        if (product.image_url) {
          const productImageData = await loadImageWithDimensions(product.image_url, false);
          if (productImageData) {
            const imgDimensions = calculateImageDimensions(
              productImageData.width,
              productImageData.height,
              imageAreaWidth - 4,
              imageAreaHeight - 4
            );
            const imgX = imageAreaX + (imageAreaWidth - imgDimensions.width) / 2;
            const imgY = imageAreaY + (imageAreaHeight - imgDimensions.height) / 2;
            pdf.addImage(productImageData.data, productImageData.format, imgX, imgY, imgDimensions.width, imgDimensions.height);
          }
        }

        // Product name
        const nameY = y + imageAreaHeight + 10;
        const fontSize = productsPerPage === 2 ? 12 : (productsPerPage === 4 ? 10 : 8);
        pdf.setFontSize(fontSize);
        pdf.setTextColor(40, 40, 40);
        pdf.setFont("helvetica", "bold");
        const maxNameWidth = cardWidth - 8;
        const nameLines = pdf.splitTextToSize(product.name, maxNameWidth);
        const maxNameLines = productsPerPage === 2 ? 4 : (productsPerPage === 4 ? 3 : 2);
        const displayNameLines = nameLines.slice(0, maxNameLines);
        
        let textY = nameY;
        displayNameLines.forEach((line: string) => {
          pdf.text(line, x + 4, textY);
          textY += fontSize * 0.45;
        });

        // Price
        const price = product.promotional_price || product.price;
        const priceSize = productsPerPage === 2 ? 14 : (productsPerPage === 4 ? 11 : 9);
        pdf.setFontSize(priceSize);
        pdf.setTextColor(20, 20, 20);
        const priceY = y + cardHeight - 20;
        pdf.text(formatPrice(price), x + 4, priceY);
        pdf.setFont("helvetica", "normal");

        // "Ver produto" button
        const btnHeight = productsPerPage === 2 ? 10 : (productsPerPage === 4 ? 8 : 7);
        const btnY = y + cardHeight - btnHeight - 3;
        const btnWidth = cardWidth - 8;
        
        pdf.setFillColor(r, g, b);
        pdf.roundedRect(x + 4, btnY, btnWidth, btnHeight, 2, 2, "F");
        
        const btnFontSize = productsPerPage === 2 ? 10 : (productsPerPage === 4 ? 8 : 7);
        pdf.setFontSize(btnFontSize);
        pdf.setTextColor(255, 255, 255);
        pdf.text("Ver produto", x + cardWidth / 2, btnY + btnHeight * 0.65, { align: "center" });

        if (storeProfile?.store_slug) {
          const productUrl = `${window.location.origin}/loja/${storeProfile.store_slug}/produto/${product.id}`;
          pdf.link(x, y, cardWidth, cardHeight, { url: productUrl });
        }
      }
    }

    // Generate back cover
    await generateBackCover(pdf);

    return pdf;
  };

  // Generate PDF in list format
  const generateListPDF = async () => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Generate cover page first
    await generateCoverPage(pdf);

    const pageWidth = 210;
    const pageHeight = 297;
    const sidebarWidth = 12;
    const margin = 10;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);

    const contentStartX = sidebarWidth + margin;
    const contentWidth = pageWidth - sidebarWidth - (margin * 2);
    const rowHeight = 12; // Increased for thumbnail
    const thumbnailSize = 10; // Thumbnail image size
    const contentStartY = margin + 10;
    const contentEndY = pageHeight - margin;
    const availableHeight = contentEndY - contentStartY;
    const rowsPerPage = Math.floor(availableHeight / rowHeight) - 1; // -1 for header

    const totalPages = Math.ceil(filteredProducts.length / rowsPerPage);

    for (let page = 0; page < totalPages; page++) {
      pdf.addPage();

      // Draw sidebar (without logo)
      await drawSidebar(pdf, page + 1);

      // Column headers with thumbnail space
      const headerY = contentStartY;
      const thumbnailWidth = 12; // Width for thumbnail column
      pdf.setFillColor(r, g, b);
      pdf.rect(contentStartX, headerY - 5, contentWidth, 7, "F");
      
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.text("Item", contentStartX + 5, headerY);
      pdf.text("Produto", contentStartX + 20 + thumbnailWidth, headerY);
      pdf.text("Valor", contentStartX + contentWidth - 25, headerY);
      pdf.setFont("helvetica", "normal");

      const startIndex = page * rowsPerPage;
      const endIndex = Math.min(startIndex + rowsPerPage, filteredProducts.length);
      const pageProducts = filteredProducts.slice(startIndex, endIndex);

      let currentY = contentStartY + 10;

      for (let i = 0; i < pageProducts.length; i++) {
        const product = pageProducts[i];
        const productNumber = startIndex + i + 1;

        // Zebra striping
        if (i % 2 === 0) {
          pdf.setFillColor(245, 245, 245);
        } else {
          pdf.setFillColor(255, 255, 255);
        }
        pdf.rect(contentStartX, currentY - 7, contentWidth, rowHeight, "F");

        // Item number
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(String(productNumber), contentStartX + 5, currentY);

        // Thumbnail image
        const thumbX = contentStartX + 15;
        const thumbY = currentY - 6;
        if (product.image_url) {
          try {
            const thumbData = await loadImageWithDimensions(product.image_url, false);
            if (thumbData) {
              const thumbDimensions = calculateImageDimensions(
                thumbData.width,
                thumbData.height,
                thumbnailSize,
                thumbnailSize
              );
              pdf.addImage(thumbData.data, thumbData.format, thumbX, thumbY, thumbDimensions.width, thumbDimensions.height);
            }
          } catch {
            // Skip if image fails to load
          }
        }

        // Product name (truncated) - positioned after thumbnail
        pdf.setTextColor(40, 40, 40);
        const maxNameLength = 45;
        let displayName = product.name;
        if (displayName.length > maxNameLength) {
          displayName = displayName.substring(0, maxNameLength - 3) + "...";
        }
        pdf.text(displayName, contentStartX + 28, currentY);

        // Price
        const price = product.promotional_price || product.price;
        pdf.setFont("helvetica", "bold");
        pdf.text(formatPrice(price), contentStartX + contentWidth - 5, currentY, { align: "right" });
        pdf.setFont("helvetica", "normal");

        // Make row clickable
        if (storeProfile?.store_slug) {
          const productUrl = `${window.location.origin}/loja/${storeProfile.store_slug}/produto/${product.id}`;
          pdf.link(contentStartX, currentY - 7, contentWidth, rowHeight, { url: productUrl });
        }

        currentY += rowHeight;
      }
    }

    // Generate back cover
    await generateBackCover(pdf);

    return pdf;
  };

  const generatePDF = async () => {
    if (filteredProducts.length === 0) {
      toast.error("Selecione pelo menos um produto para gerar o catálogo");
      return;
    }

    setIsGenerating(true);

    try {
      let pdf: jsPDF;

      if (filterType === "single" && filteredProducts.length === 1) {
        pdf = await generateSingleProductPDF(filteredProducts[0]);
      } else if (filterType === "list") {
        pdf = await generateListPDF();
      } else {
        pdf = await generateMultipleProductsPDF();
      }

      const blob = pdf.output("blob");
      setPdfBlob(blob);
      
      try {
        if (user?.id) {
          const fileName = `${user.id}/catalogs/${Date.now()}-catalogo.pdf`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(fileName, blob, { contentType: "application/pdf", upsert: true });

          if (uploadError) throw uploadError;

          const publicUrl = supabase.storage
            .from("product-images")
            .getPublicUrl(uploadData.path).data.publicUrl;

          if (publicUrl) {
            setCatalogUrl(publicUrl);
          }
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error("Error uploading PDF:", e);
      }
      
      setPdfGenerated(true);
      toast.success("Catálogo gerado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar catálogo");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfBlob) return;
    
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `catalogo-${new Date().toISOString().split("T")[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyUrl = async () => {
    try {
      setIsCopyingLink(true);

      let url = catalogUrl;

      if (!url && pdfBlob && user?.id) {
        const fileName = `${user.id}/catalogs/${Date.now()}-catalogo.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: true });

        if (uploadError) throw uploadError;

        const publicUrl = supabase.storage
          .from("product-images")
          .getPublicUrl(uploadData.path).data.publicUrl;

        if (publicUrl) {
          url = publicUrl;
          setCatalogUrl(publicUrl);
        }
      }

      if (url) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success("Link copiado!");
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error("Erro ao gerar link do catálogo");
      }
    } catch (error) {
      console.error("Error copying URL:", error);
      toast.error("Erro ao copiar link");
    } finally {
      setIsCopyingLink(false);
    }
  };

  const handleNewCatalog = () => {
    setPdfGenerated(false);
    setPdfBlob(null);
    setCatalogUrl(null);
    setFilterType("");
    setSelectedCategory("");
    setSelectedProduct("");
    setFilteredProducts([]);
    setProductsPerPage(9);
  };

  const canGenerate = filterType === "all" || 
    filterType === "list" ||
    (filterType === "category" && selectedCategory) || 
    (filterType === "single" && selectedProduct);

  const showProductsPerPageSelector = filterType === "all" || filterType === "category";

  // Get preview grid cols based on products per page
  const getPreviewGridCols = () => {
    switch (productsPerPage) {
      case 2: return 'grid-cols-1';
      case 4: return 'grid-cols-2';
      default: return 'grid-cols-3';
    }
  };

  const getPreviewProductCount = () => {
    switch (productsPerPage) {
      case 2: return 2;
      case 4: return 4;
      default: return 9;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Success State */}
        {pdfGenerated && (
          <Card className="border-2" style={{ borderColor: primaryColor }}>
            <CardContent className="py-12 text-center">
              <div 
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: primaryColor }}
              >
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Seu catálogo está pronto!</h2>
              <p className="text-muted-foreground mb-6">
                {filteredProducts.length} produto(s) incluído(s)
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button 
                  onClick={handleDownload}
                  className="gap-2"
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                >
                  <Download className="h-4 w-4" />
                  Baixar PDF
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCopyUrl}
                  disabled={isCopyingLink}
                  className="gap-2"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  {isCopyingLink ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copiar Link
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleNewCatalog}
                  className="gap-2"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Gerar Novo Catálogo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {!pdfGenerated && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Filter Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" style={{ color: primaryColor }} />
                  Conteúdo do Catálogo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <style>{`
                  .catalog-merchant-radio {
                    border-color: ${buttonBgColor} !important;
                    background-color: #FFFFFF !important;
                    transition: all 0.2s ease !important;
                  }
                  .catalog-merchant-radio[data-state="checked"] span svg {
                    fill: ${buttonBgColor} !important;
                    color: ${buttonBgColor} !important;
                  }
                  .single-product-select-item[data-highlighted] {
                    background-color: ${buttonBgColor} !important;
                    color: #FFFFFF !important;
                  }
                  .products-per-page-btn {
                    border-color: ${buttonBgColor}40;
                    transition: all 0.2s ease;
                  }
                  .products-per-page-btn:hover {
                    border-color: ${buttonBgColor};
                    background-color: ${buttonBgColor}10;
                  }
                  .products-per-page-btn.selected {
                    border-color: ${buttonBgColor};
                    background-color: ${buttonBgColor};
                    color: white;
                  }
                `}</style>

                <RadioGroup value={filterType} onValueChange={setFilterType}>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      value="all" 
                      id="all"
                      className="catalog-merchant-radio border-2"
                      style={{ borderColor: buttonBgColor, backgroundColor: '#FFFFFF', color: buttonBgColor }}
                    />
                    <Label htmlFor="all" className="cursor-pointer">
                      Gerar catálogo de todos os produtos
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      value="list" 
                      id="list"
                      className="catalog-merchant-radio border-2"
                      style={{ borderColor: buttonBgColor, backgroundColor: '#FFFFFF', color: buttonBgColor }}
                    />
                    <Label htmlFor="list" className="cursor-pointer">
                      Gerar catálogo em lista
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      value="category" 
                      id="category"
                      className="catalog-merchant-radio border-2"
                      style={{ borderColor: buttonBgColor, backgroundColor: '#FFFFFF', color: buttonBgColor }}
                    />
                    <Label htmlFor="category" className="cursor-pointer">
                      Gerar catálogo de uma categoria específica
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      value="single" 
                      id="single"
                      className="catalog-merchant-radio border-2"
                      style={{ borderColor: buttonBgColor, backgroundColor: '#FFFFFF', color: buttonBgColor }}
                    />
                    <Label htmlFor="single" className="cursor-pointer">
                      Gerar catálogo de um único produto
                    </Label>
                  </div>
                </RadioGroup>

                {/* Products per page selector */}
                {showProductsPerPageSelector && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Produtos por página</Label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setProductsPerPage(9)}
                        className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 products-per-page-btn ${productsPerPage === 9 ? 'selected' : ''}`}
                      >
                        <Grid3X3 className="h-5 w-5" />
                        <span className="text-xs font-medium">9 produtos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductsPerPage(4)}
                        className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 products-per-page-btn ${productsPerPage === 4 ? 'selected' : ''}`}
                      >
                        <Grid2X2 className="h-5 w-5" />
                        <span className="text-xs font-medium">4 produtos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductsPerPage(2)}
                        className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 products-per-page-btn ${productsPerPage === 2 ? 'selected' : ''}`}
                      >
                        <LayoutList className="h-5 w-5" />
                        <span className="text-xs font-medium">2 produtos</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Category Selector */}
                {filterType === "category" && (
                  <div className="space-y-2">
                    <Label>Selecione a categoria</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger 
                        className="w-full"
                        style={{ borderColor: primaryColor }}
                      >
                        <SelectValue placeholder="Escolha uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Product Selector */}
                {filterType === "single" && (
                  <div className="space-y-2">
                    <Label>Selecione o produto</Label>
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger 
                        className="w-full"
                        style={{ borderColor: primaryColor }}
                      >
                        <SelectValue placeholder="Escolha um produto">
                          {selectedProduct && products.find(p => p.id === selectedProduct)?.name && (
                            <span className="truncate block max-w-[200px]" title={products.find(p => p.id === selectedProduct)?.name}>
                              {products.find(p => p.id === selectedProduct)!.name.length > 35
                                ? products.find(p => p.id === selectedProduct)!.name.slice(0, 35) + "..."
                                : products.find(p => p.id === selectedProduct)!.name}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-w-[300px]">
                        {products.map((product) => (
                          <SelectItem 
                            key={product.id} 
                            value={product.id}
                            className="single-product-select-item cursor-pointer transition-colors"
                            title={product.name}
                          >
                            <span className="truncate block max-w-[250px]">
                              {product.name.length > 40 
                                ? product.name.slice(0, 40) + "..." 
                                : product.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Generate Button */}
                <Button 
                  onClick={generatePDF}
                  disabled={!canGenerate || isGenerating}
                  className="w-full gap-2"
                  style={{ 
                    backgroundColor: buttonBgColor, 
                    color: buttonTextColor,
                    opacity: (!canGenerate && !isGenerating) ? 0.5 : 1
                  }}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4" />
                      Gerar PDF Agora
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Pré-visualização</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">
                      Escolha uma opção para visualizar o catálogo
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Cover Preview */}
                    <div className="relative rounded-lg overflow-hidden aspect-[210/297] bg-white">
                      {/* 3 vertical stripes on the left */}
                      <div 
                        className="absolute left-0 top-0 bottom-0"
                        style={{ 
                          width: '19%',
                          backgroundColor: storeProfile?.primary_color || primaryColor 
                        }}
                      />
                      <div 
                        className="absolute top-0 bottom-0"
                        style={{ 
                          left: '22%',
                          width: '9.5%',
                          backgroundColor: storeProfile?.primary_color || primaryColor 
                        }}
                      />
                      <div 
                        className="absolute top-0 bottom-0"
                        style={{ 
                          left: '34%',
                          width: '4.75%',
                          backgroundColor: storeProfile?.primary_color || primaryColor 
                        }}
                      />
                      {/* White overlay rectangle */}
                      <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white p-6 text-center shadow-lg" style={{ width: '60%', maxWidth: '200px' }}>
                          <p className="text-lg font-bold text-gray-800">CATÁLOGO</p>
                          <p className="text-sm text-gray-800">de</p>
                          <p className="text-lg font-bold text-gray-800">PRODUTOS</p>
                          <p className="text-sm text-gray-600 mt-2">{new Date().getFullYear()}</p>
                          {storeProfile?.store_logo_url && (
                            <img 
                              src={storeProfile.store_logo_url} 
                              alt="Logo" 
                              className="h-8 w-auto mx-auto mt-3 object-contain"
                            />
                          )}
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Capa
                      </div>
                    </div>

                    {/* Content page preview with sidebar */}
                    <div className="relative rounded-lg overflow-hidden bg-white border">
                      {/* Sidebar preview (without logo) */}
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-4 flex flex-col items-center justify-end py-2"
                        style={{ backgroundColor: storeProfile?.primary_color || primaryColor }}
                      >
                        <span className="text-[6px] text-white font-bold leading-tight text-center">PG<br/>01</span>
                      </div>

                      {/* Content area */}
                      <div className="ml-5 p-2">
                        {filterType === "single" && filteredProducts.length === 1 ? (
                          <div className="flex flex-col items-center text-center space-y-2 py-4">
                            <div className="w-20 h-20 flex items-center justify-center">
                              {filteredProducts[0].image_url ? (
                                <img 
                                  src={filteredProducts[0].image_url} 
                                  alt={filteredProducts[0].name}
                                  className="max-w-full max-h-full object-contain"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-gray-50 rounded">
                                  Sem imagem
                                </div>
                              )}
                            </div>
                            <h3 className="text-xs font-bold text-foreground px-2">
                              {filteredProducts[0].name}
                            </h3>
                            <p className="text-sm font-bold text-foreground">
                              {formatPrice(filteredProducts[0].promotional_price || filteredProducts[0].price)}
                            </p>
                            <div 
                              className="text-[8px] text-white rounded py-1 px-4"
                              style={{ backgroundColor: storeProfile?.primary_color || primaryColor }}
                            >
                              Ver produto
                            </div>
                          </div>
                        ) : filterType === "list" ? (
                          <div className="space-y-1">
                            <div 
                              className="rounded p-1 mb-1 flex items-center text-white text-[8px]"
                              style={{ backgroundColor: storeProfile?.primary_color || primaryColor }}
                            >
                              <span className="font-semibold w-6 text-center">Item</span>
                              <span className="font-semibold flex-1 pl-2">Produto</span>
                              <span className="font-semibold pr-1">Valor</span>
                            </div>
                            {filteredProducts.slice(0, 6).map((product, index) => (
                              <div 
                                key={product.id} 
                                className="flex items-center py-1 px-1 text-[7px]"
                                style={{ backgroundColor: index % 2 === 0 ? 'rgb(245, 245, 245)' : 'rgb(255, 255, 255)' }}
                              >
                                <span className="w-5 text-center text-gray-500">{index + 1}</span>
                                {/* Thumbnail */}
                                <div className="w-4 h-4 flex-shrink-0 mx-1 flex items-center justify-center overflow-hidden rounded-sm bg-white">
                                  {product.image_url ? (
                                    <img 
                                      src={product.image_url} 
                                      alt={product.name}
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-100" />
                                  )}
                                </div>
                                <span className="flex-1 truncate pl-1">{product.name}</span>
                                <span className="font-semibold">{formatPrice(product.promotional_price || product.price)}</span>
                              </div>
                            ))}
                            {filteredProducts.length > 6 && (
                              <p className="text-[8px] text-center text-muted-foreground mt-1">
                                +{filteredProducts.length - 6} produtos
                              </p>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className={`grid ${getPreviewGridCols()} gap-1`}>
                              {filteredProducts.slice(0, getPreviewProductCount()).map((product) => (
                                <div 
                                  key={product.id} 
                                  className="bg-white border border-gray-200 rounded p-1 text-center"
                                >
                                  <div className="aspect-square rounded mb-1 overflow-hidden flex items-center justify-center bg-white">
                                    {product.image_url ? (
                                      <img 
                                        src={product.image_url} 
                                        alt={product.name}
                                        className="max-w-full max-h-full object-contain"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[6px] text-muted-foreground bg-gray-50">
                                        Sem imagem
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-[7px] font-medium truncate">{product.name}</p>
                                  <p className="text-[8px] font-bold">
                                    {formatPrice(product.promotional_price || product.price)}
                                  </p>
                                  <div 
                                    className="text-[6px] text-white rounded py-0.5 mt-0.5"
                                    style={{ backgroundColor: storeProfile?.primary_color || primaryColor }}
                                  >
                                    Ver produto
                                  </div>
                                </div>
                              ))}
                            </div>
                            {filteredProducts.length > getPreviewProductCount() && (
                              <p className="text-[8px] text-muted-foreground text-center mt-1">
                                +{filteredProducts.length - getPreviewProductCount()} produtos adicionais
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Página 1
                      </div>
                    </div>

                    {/* Back cover preview */}
                    <div className="relative rounded-lg overflow-hidden aspect-[210/297]">
                      {/* Top half with primary color */}
                      <div 
                        className="absolute top-0 left-0 right-0 h-1/2"
                        style={{ backgroundColor: storeProfile?.primary_color || primaryColor }}
                      />
                      {/* Bottom half white */}
                      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-white" />
                      {/* Logo circle in center */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden">
                          {storeProfile?.store_logo_url ? (
                            <img 
                              src={storeProfile.store_logo_url} 
                              alt="Logo" 
                              className="w-12 h-12 object-contain"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">Logo</span>
                          )}
                        </div>
                        <div className="mt-4 text-center text-xs text-gray-600 max-w-[80%] space-y-2">
                          {storeProfile?.store_slug && (
                            <p 
                              className="font-semibold cursor-pointer transition-all duration-200 hover:underline hover:scale-105" 
                              style={{ color: storeProfile?.primary_color || primaryColor }}
                            >
                              {window.location.origin}/loja/{storeProfile.store_slug}
                            </p>
                          )}
                          {storeProfile?.whatsapp_number && (
                            <div className="flex items-center justify-center gap-1 cursor-pointer transition-all duration-200 hover:underline hover:scale-105">
                              <img 
                                src={iconWhatsAppOutline} 
                                alt="WhatsApp" 
                                className="w-3 h-3 object-contain"
                              />
                              <span className="text-[10px]">
                                {(() => {
                                  const rawNumber = storeProfile.whatsapp_number.replace(/\D/g, '');
                                  let displayNumber = rawNumber;
                                  if (rawNumber.startsWith('55') && rawNumber.length > 11) {
                                    displayNumber = rawNumber.substring(2);
                                  }
                                  if (displayNumber.length === 11) {
                                    return `(${displayNumber.substring(0, 2)}) ${displayNumber.substring(2, 7)}-${displayNumber.substring(7)}`;
                                  } else if (displayNumber.length === 10) {
                                    return `(${displayNumber.substring(0, 2)}) ${displayNumber.substring(2, 6)}-${displayNumber.substring(6)}`;
                                  }
                                  return displayNumber;
                                })()}
                              </span>
                            </div>
                          )}
                          {getFullAddress() && (
                            <div className="flex items-center justify-center gap-1 cursor-pointer transition-all duration-200 hover:underline hover:scale-105">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="text-[8px] truncate">{getFullAddress()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Contracapa
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground text-center">
                      Total: {filteredProducts.length} produto(s)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CatalogPDF;
