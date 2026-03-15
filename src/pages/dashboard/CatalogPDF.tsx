import { useState, useEffect, useMemo } from "react";
import { FileText, Download, Copy, RefreshCw, Printer, Check, Grid3X3, Grid2X2, LayoutList, MapPin, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import CatalogLayoutSelector, { type CatalogLayoutType } from "@/components/catalog/CatalogLayoutSelector";
import CatalogCoverPreview from "@/components/catalog/CatalogCoverPreview";
import CatalogBackCoverPreview from "@/components/catalog/CatalogBackCoverPreview";

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

type ProductsPerPage = 12 | 9 | 4 | 2;

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
  const [catalogLayout, setCatalogLayout] = useState<CatalogLayoutType>('layout_01');
  const [currentPreviewPage, setCurrentPreviewPage] = useState(0);
  const [showPrices, setShowPrices] = useState(true);
  const [coverMessage, setCoverMessage] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [campaignCopied, setCampaignCopied] = useState(false);
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

  // Generate Cover Page - Layout 01 (original)
  const generateCoverLayout01 = async (pdf: jsPDF) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");

    const stripe1Width = 40;
    const stripe2Width = stripe1Width / 2;
    const stripe3Width = stripe2Width / 2;
    const gap = 6;
    
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, stripe1Width, pageHeight, "F");
    const stripe2X = stripe1Width + gap;
    pdf.rect(stripe2X, 0, stripe2Width, pageHeight, "F");
    const stripe3X = stripe2X + stripe2Width + gap;
    pdf.rect(stripe3X, 0, stripe3Width, pageHeight, "F");

    const rectWidth = 100;
    const rectHeight = 160;
    const rectX = (pageWidth - rectWidth) / 2;
    const rectY = (pageHeight - rectHeight) / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(rectX, rectY, rectWidth, rectHeight, "F");

    const textCenterX = pageWidth / 2;
    
    let logoDimensions = { width: 0, height: 0 };
    let logoImage: { data: string; width: number; height: number; format: string } | null = null;
    
    if (storeProfile?.store_logo_url) {
      logoImage = await loadImageWithDimensions(storeProfile.store_logo_url, true);
      if (logoImage) {
        logoDimensions = calculateImageDimensions(logoImage.width, logoImage.height, 55, 45);
      }
    }
    
    const titleBlockHeight = 33;
    const gapAfterTitle = 10;
    const yearHeight = 7;
    const gapBeforeLogo = 12;
    const totalContentHeight = titleBlockHeight + gapAfterTitle + yearHeight + gapBeforeLogo + logoDimensions.height;
    
    const minBottomPadding = 25;
    const availableHeight = rectHeight - minBottomPadding;
    let startY = rectY + Math.max(25, (availableHeight - totalContentHeight) / 2 + 15);
    let currentY = startY;

    pdf.setFontSize(28);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    pdf.text("CATÁLOGO", textCenterX, currentY, { align: "center" });
    currentY += 12;
    pdf.setFontSize(16);
    pdf.text("de", textCenterX, currentY, { align: "center" });
    currentY += 12;
    pdf.setFontSize(28);
    pdf.text("PRODUTOS", textCenterX, currentY, { align: "center" });
    currentY += 10;

    if (coverMessage.trim()) {
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(80, 80, 80);
      pdf.text(coverMessage.trim(), textCenterX, currentY, { align: "center" });
      currentY += 10;
    }
    currentY += 10;

    const currentYear = new Date().getFullYear();
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(currentYear), textCenterX, currentY, { align: "center" });
    currentY += 18;

    if (logoImage) {
      const logoX = textCenterX - (logoDimensions.width / 2);
      const maxLogoY = rectY + rectHeight - logoDimensions.height - 20;
      const logoY = Math.min(currentY, maxLogoY);
      pdf.addImage(logoImage.data, logoImage.format, logoX, logoY, logoDimensions.width, logoDimensions.height);
    }
  };

  // Generate Cover Page - Layout 02 (Vertical bars minimalist)
  const generateCoverLayout02 = async (pdf: jsPDF) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);
    const lr = Math.min(255, r + 60), lg = Math.min(255, g + 60), lb = Math.min(255, b + 60);

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");

    // Left bars
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, 12, pageHeight, "F");
    pdf.setFillColor(lr, lg, lb);
    pdf.rect(16, 0, 6, pageHeight, "F");

    // Right bars
    pdf.setFillColor(r, g, b);
    pdf.rect(pageWidth - 12, 0, 12, pageHeight, "F");
    pdf.setFillColor(lr, lg, lb);
    pdf.rect(pageWidth - 22, 0, 6, pageHeight, "F");

    // Center white square
    const rectSize = 100;
    const rectX = (pageWidth - rectSize) / 2;
    const rectY = (pageHeight - rectSize) / 2 - 10;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(240, 240, 240);
    pdf.setLineWidth(0.5);
    pdf.rect(rectX, rectY, rectSize, rectSize, "FD");

    const textCenterX = pageWidth / 2;
    let currentY = rectY + 25;

    pdf.setFontSize(28);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    pdf.text("CATÁLOGO", textCenterX, currentY, { align: "center" });
    currentY += 12;
    pdf.setFontSize(16);
    pdf.text("de", textCenterX, currentY, { align: "center" });
    currentY += 12;
    pdf.setFontSize(28);
    pdf.text("PRODUTOS", textCenterX, currentY, { align: "center" });
    currentY += 8;

    if (coverMessage.trim()) {
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(80, 80, 80);
      pdf.text(coverMessage.trim(), textCenterX, currentY, { align: "center" });
      currentY += 8;
    }
    currentY += 8;

    pdf.setFontSize(18);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(new Date().getFullYear()), textCenterX, currentY, { align: "center" });
    currentY += 14;

    if (storeProfile?.store_logo_url) {
      const logoImage = await loadImageWithDimensions(storeProfile.store_logo_url, true);
      if (logoImage) {
        const dim = calculateImageDimensions(logoImage.width, logoImage.height, 45, 35);
        const logoX = textCenterX - (dim.width / 2);
        const maxLogoY = rectY + rectSize - dim.height - 8;
        pdf.addImage(logoImage.data, logoImage.format, logoX, Math.min(currentY, maxLogoY), dim.width, dim.height);
      }
    }
  };

  // Generate Cover Page - Layout 03 (Geometric modern)
  const generateCoverLayout03 = async (pdf: jsPDF) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);
    const lr = Math.min(255, r + 40), lg = Math.min(255, g + 40), lb = Math.min(255, b + 40);
    const llr = Math.min(255, r + 100), llg = Math.min(255, g + 100), llb = Math.min(255, b + 100);

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");

    // Top right triangle (lightest)
    pdf.setFillColor(llr, llg, llb);
    pdf.triangle(0, 0, pageWidth, 0, pageWidth, 90, "F");

    // Bottom left triangle (primary)
    pdf.setFillColor(r, g, b);
    pdf.triangle(0, pageHeight, 0, 180, 140, pageHeight, "F");

    // Bottom right triangle (lighter)
    pdf.setFillColor(lr, lg, lb);
    pdf.triangle(pageWidth, pageHeight, pageWidth, 210, 100, pageHeight, "F");

    // Center white square
    const rectSize = 100;
    const rectX = (pageWidth - rectSize) / 2;
    const rectY = (pageHeight - rectSize) / 2 - 10;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(240, 240, 240);
    pdf.setLineWidth(0.5);
    pdf.rect(rectX, rectY, rectSize, rectSize, "FD");

    const textCenterX = pageWidth / 2;
    let currentY = rectY + 25;

    pdf.setFontSize(28);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    pdf.text("CATÁLOGO", textCenterX, currentY, { align: "center" });
    currentY += 12;
    pdf.setFontSize(16);
    pdf.text("de", textCenterX, currentY, { align: "center" });
    currentY += 12;
    pdf.setFontSize(28);
    pdf.text("PRODUTOS", textCenterX, currentY, { align: "center" });
    currentY += 8;

    if (coverMessage.trim()) {
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(80, 80, 80);
      pdf.text(coverMessage.trim(), textCenterX, currentY, { align: "center" });
      currentY += 8;
    }
    currentY += 8;

    pdf.setFontSize(18);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(new Date().getFullYear()), textCenterX, currentY, { align: "center" });
    currentY += 14;

    if (storeProfile?.store_logo_url) {
      const logoImage = await loadImageWithDimensions(storeProfile.store_logo_url, true);
      if (logoImage) {
        const dim = calculateImageDimensions(logoImage.width, logoImage.height, 45, 35);
        const logoX = textCenterX - (dim.width / 2);
        const maxLogoY = rectY + rectSize - dim.height - 8;
        pdf.addImage(logoImage.data, logoImage.format, logoX, Math.min(currentY, maxLogoY), dim.width, dim.height);
      }
    }
  };

  // Generate Cover Page - Layout 04 (Diagonal premium)
  const generateCoverLayout04 = async (pdf: jsPDF) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");

    // Diagonal division: bottom part in primary color
    pdf.setFillColor(r, g, b);
    pdf.triangle(0, 148, pageWidth, 110, pageWidth, pageHeight, "F");
    pdf.triangle(0, 148, 0, pageHeight, pageWidth, pageHeight, "F");

    // Center white square
    const rectSize = 100;
    const rectX = (pageWidth - rectSize) / 2;
    const rectY = (pageHeight - rectSize) / 2 - 10;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(240, 240, 240);
    pdf.setLineWidth(0.5);
    pdf.rect(rectX, rectY, rectSize, rectSize, "FD");

    const textCenterX = pageWidth / 2;
    let currentY = rectY + 25;

    pdf.setFontSize(28);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    pdf.text("CATÁLOGO", textCenterX, currentY, { align: "center" });
    currentY += 12;
    pdf.setFontSize(16);
    pdf.text("de", textCenterX, currentY, { align: "center" });
    currentY += 12;
    pdf.setFontSize(28);
    pdf.text("PRODUTOS", textCenterX, currentY, { align: "center" });
    currentY += 8;

    if (coverMessage.trim()) {
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(80, 80, 80);
      pdf.text(coverMessage.trim(), textCenterX, currentY, { align: "center" });
      currentY += 8;
    }
    currentY += 8;

    pdf.setFontSize(18);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(new Date().getFullYear()), textCenterX, currentY, { align: "center" });
    currentY += 14;

    if (storeProfile?.store_logo_url) {
      const logoImage = await loadImageWithDimensions(storeProfile.store_logo_url, true);
      if (logoImage) {
        const dim = calculateImageDimensions(logoImage.width, logoImage.height, 45, 35);
        const logoX = textCenterX - (dim.width / 2);
        const maxLogoY = rectY + rectSize - dim.height - 8;
        pdf.addImage(logoImage.data, logoImage.format, logoX, Math.min(currentY, maxLogoY), dim.width, dim.height);
      }
    }
  };

  // Route cover generation based on selected layout
  const generateCoverPage = async (pdf: jsPDF) => {
    switch (catalogLayout) {
      case 'layout_02': return generateCoverLayout02(pdf);
      case 'layout_03': return generateCoverLayout03(pdf);
      case 'layout_04': return generateCoverLayout04(pdf);
      default: return generateCoverLayout01(pdf);
    }
  };

  // Shared back cover contact info rendering
  const renderBackCoverContactInfo = async (pdf: jsPDF, centerX: number, startInfoY: number) => {
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);
    let infoY = startInfoY;
    pdf.setFontSize(12);
    pdf.setTextColor(50, 50, 50);
    pdf.setFont("helvetica", "normal");

    if (storeProfile?.store_slug) {
      const storeUrl = `${window.location.origin}/loja/${storeProfile.store_slug}`;
      pdf.setTextColor(r, g, b);
      pdf.setFont("helvetica", "bold");
      pdf.text(storeUrl, centerX, infoY, { align: "center" });
      const urlWidth = pdf.getTextWidth(storeUrl);
      pdf.link(centerX - urlWidth / 2, infoY - 4, urlWidth, 6, { url: storeUrl });
      infoY += 18;
    }

    if (storeProfile?.whatsapp_number) {
      pdf.setTextColor(50, 50, 50);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      const rawNumber = storeProfile.whatsapp_number.replace(/\D/g, '');
      let displayNumber = rawNumber;
      if (rawNumber.startsWith('55') && rawNumber.length > 11) displayNumber = rawNumber.substring(2);
      if (displayNumber.length === 11) displayNumber = `(${displayNumber.substring(0, 2)}) ${displayNumber.substring(2, 7)}-${displayNumber.substring(7)}`;
      else if (displayNumber.length === 10) displayNumber = `(${displayNumber.substring(0, 2)}) ${displayNumber.substring(2, 6)}-${displayNumber.substring(6)}`;
      
      const iconSize = 6;
      const iconTextGap = 3;
      const textWidth = pdf.getTextWidth(displayNumber);
      const totalBlockWidth = iconSize + iconTextGap + textWidth;
      const blockStartX = centerX - (totalBlockWidth / 2);
      
      const whatsappIconData = await loadImageWithDimensions(iconWhatsAppOutline, false);
      if (whatsappIconData) {
        pdf.addImage(whatsappIconData.data, whatsappIconData.format, blockStartX, infoY - 4.5, iconSize, iconSize);
      }
      pdf.text(displayNumber, blockStartX + iconSize + iconTextGap, infoY);
      const whatsappUrl = `https://wa.me/${rawNumber}`;
      pdf.link(blockStartX - 2, infoY - 5, totalBlockWidth + 4, 8, { url: whatsappUrl });
      infoY += 18;
    }

    const fullAddress = getFullAddress();
    if (fullAddress) {
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      const iconSize = 5;
      const iconTextGap = 3;
      const maxAddressWidth = 140;
      const addressLines = pdf.splitTextToSize(fullAddress, maxAddressWidth);
      let maxLineWidth = 0;
      addressLines.forEach((line: string) => {
        const lineWidth = pdf.getTextWidth(line);
        if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
      });
      const totalBlockWidth = iconSize + iconTextGap + maxLineWidth;
      const blockStartX = centerX - (totalBlockWidth / 2);
      const mapPinIconData = await loadImageWithDimensions(iconMapPin, false);
      if (mapPinIconData) {
        pdf.addImage(mapPinIconData.data, mapPinIconData.format, blockStartX, infoY - 3.5, iconSize, iconSize);
      }
      const textStartX = blockStartX + iconSize + iconTextGap;
      let addressY = infoY;
      addressLines.forEach((line: string) => {
        pdf.text(line, textStartX, addressY);
        addressY += 5;
      });
      const mapsUrl = buildGoogleMapsSearchUrl(fullAddress);
      if (mapsUrl) {
        const totalHeight = addressLines.length * 5;
        pdf.link(blockStartX - 2, infoY - 4, totalBlockWidth + 4, totalHeight + 4, { url: mapsUrl });
      }
    }
  };

  // Back Cover Logo rendering
  const renderBackCoverLogo = async (pdf: jsPDF, centerX: number, centerY: number, circleRadius: number) => {
    pdf.setFillColor(255, 255, 255);
    pdf.circle(centerX, centerY, circleRadius, "F");
    if (storeProfile?.store_logo_url) {
      const logoImage = await loadImageWithDimensions(storeProfile.store_logo_url, true);
      if (logoImage) {
        const logoMaxSize = circleRadius * 1.5;
        const logoDimensions = calculateImageDimensions(logoImage.width, logoImage.height, logoMaxSize, logoMaxSize);
        const logoX = centerX - (logoDimensions.width / 2);
        const logoY = centerY - (logoDimensions.height / 2);
        pdf.addImage(logoImage.data, logoImage.format, logoX, logoY, logoDimensions.width, logoDimensions.height);
      }
    }
  };

  // Generate Back Cover (Contracapa) - routes to layout-specific version
  const generateBackCover = async (pdf: jsPDF) => {
    pdf.addPage();
    const pageWidth = 210;
    const pageHeight = 297;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);
    const centerX = pageWidth / 2;
    const centerY = pageHeight / 2;
    const circleRadius = 35;

    // Background based on layout
    switch (catalogLayout) {
      case 'layout_02': {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        const lr = Math.min(255, r + 60), lg2 = Math.min(255, g + 60), lb = Math.min(255, b + 60);
        pdf.setFillColor(r, g, b);
        pdf.rect(0, 0, 12, pageHeight, "F");
        pdf.setFillColor(lr, lg2, lb);
        pdf.rect(16, 0, 6, pageHeight, "F");
        pdf.setFillColor(r, g, b);
        pdf.rect(pageWidth - 12, 0, 12, pageHeight, "F");
        pdf.setFillColor(lr, lg2, lb);
        pdf.rect(pageWidth - 22, 0, 6, pageHeight, "F");
        break;
      }
      case 'layout_03': {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        const llr = Math.min(255, r + 100), llg = Math.min(255, g + 100), llb = Math.min(255, b + 100);
        const lr3 = Math.min(255, r + 40), lg3 = Math.min(255, g + 40), lb3 = Math.min(255, b + 40);
        pdf.setFillColor(llr, llg, llb);
        pdf.triangle(0, 0, pageWidth, 0, pageWidth, 90, "F");
        pdf.setFillColor(r, g, b);
        pdf.triangle(0, pageHeight, 0, 250, 80, pageHeight, "F");
        pdf.setFillColor(lr3, lg3, lb3);
        pdf.triangle(pageWidth, pageHeight, pageWidth, 260, 140, pageHeight, "F");
        break;
      }
      case 'layout_04': {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.setFillColor(r, g, b);
        pdf.triangle(0, 200, pageWidth, 170, pageWidth, pageHeight, "F");
        pdf.triangle(0, 200, 0, pageHeight, pageWidth, pageHeight, "F");
        break;
      }
      default: {
        // Layout 01 - original
        pdf.setFillColor(r, g, b);
        pdf.rect(0, 0, pageWidth, pageHeight / 2, "F");
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, pageHeight / 2, pageWidth, pageHeight / 2, "F");
        break;
      }
    }

    await renderBackCoverLogo(pdf, centerX, centerY, circleRadius);
    await renderBackCoverContactInfo(pdf, centerX, centerY + circleRadius + 25);
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
    if (showPrices) {
      const price = product.promotional_price || product.price;
      pdf.setFontSize(18);
      pdf.setTextColor(20, 20, 20);
      pdf.text(formatPrice(price), contentCenterX, currentY, { align: "center" });
      currentY += 12;
    }

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
      const productUrl = `${window.location.origin}/loja/${storeProfile.store_slug}/produto/${product.id}?src=catalogo_pdf`;
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
    const margin = productsPerPage === 12 ? 6 : 8;
    const hexColor = getHexColor();
    const { r, g, b } = parseHexColor(hexColor);

    // Calculate grid based on products per page
    let cols: number, rows: number;
    switch (productsPerPage) {
      case 12:
        cols = 4;
        rows = 3;
        break;
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
    
    const cardGap = productsPerPage === 12 ? 4 : 6;
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
        const fontSize = productsPerPage === 2 ? 12 : (productsPerPage === 4 ? 10 : (productsPerPage === 12 ? 7 : 8));
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
        if (showPrices) {
          const price = product.promotional_price || product.price;
          const priceSize = productsPerPage === 2 ? 14 : (productsPerPage === 4 ? 11 : (productsPerPage === 12 ? 7 : 9));
          pdf.setFontSize(priceSize);
          pdf.setTextColor(20, 20, 20);
          const priceY = y + cardHeight - 20;
          pdf.text(formatPrice(price), x + 4, priceY);
          pdf.setFont("helvetica", "normal");
        }

        // "Ver produto" button
        const btnHeight = productsPerPage === 2 ? 10 : (productsPerPage === 4 ? 8 : (productsPerPage === 12 ? 5.5 : 7));
        const btnY = y + cardHeight - btnHeight - 3;
        const btnWidth = cardWidth - 8;
        
        pdf.setFillColor(r, g, b);
        pdf.roundedRect(x + 4, btnY, btnWidth, btnHeight, 2, 2, "F");
        
        const btnFontSize = productsPerPage === 2 ? 10 : (productsPerPage === 4 ? 8 : (productsPerPage === 12 ? 6 : 7));
        pdf.setFontSize(btnFontSize);
        pdf.setTextColor(255, 255, 255);
        pdf.text("Ver produto", x + cardWidth / 2, btnY + btnHeight * 0.65, { align: "center" });

        if (storeProfile?.store_slug) {
          const productUrl = `${window.location.origin}/loja/${storeProfile.store_slug}/produto/${product.id}?src=catalogo_pdf`;
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
        if (showPrices) {
          const price = product.promotional_price || product.price;
          pdf.setFont("helvetica", "bold");
          pdf.text(formatPrice(price), contentStartX + contentWidth - 5, currentY, { align: "right" });
          pdf.setFont("helvetica", "normal");
        }

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
    setCatalogLayout('layout_01');
    setShowPrices(true);
    setCoverMessage('');
    setCampaignMessage('');
    setCampaignCopied(false);
  };

  const getStoreUrl = () => {
    if (!storeProfile?.store_slug) return '';
    return `${window.location.origin}/loja/${storeProfile.store_slug}`;
  };

  const getWhatsAppDisplay = () => {
    if (!storeProfile?.whatsapp_number) return '';
    const raw = storeProfile.whatsapp_number.replace(/\D/g, '');
    let d = raw;
    if (raw.startsWith('55') && raw.length > 11) d = raw.substring(2);
    if (d.length === 11) return `(${d.substring(0, 2)}) ${d.substring(2, 7)}-${d.substring(7)}`;
    if (d.length === 10) return `(${d.substring(0, 2)}) ${d.substring(2, 6)}-${d.substring(6)}`;
    return d;
  };

  const buildCampaignMessage = (url: string) => {
    const storeUrl = getStoreUrl();
    const whatsappDisplay = getWhatsAppDisplay();
    let msg = `Olá! 😊\n\nPreparamos nosso catálogo atualizado com vários produtos disponíveis.\n\n📄 Veja o catálogo completo:\n${url}`;
    if (storeUrl) msg += `\n\n🛒 Visite nossa loja:\n${storeUrl}`;
    if (whatsappDisplay) msg += `\n\n📲 Fale conosco no WhatsApp:\n${whatsappDisplay}`;
    msg += `\n\nEsperamos seu pedido!`;
    return msg;
  };

  const handleShareWhatsApp = () => {
    if (!catalogUrl) {
      toast.error("Aguarde a geração do link do catálogo");
      return;
    }
    const storeUrl = getStoreUrl();
    let msg = `Olá! 😊\n\nConfira nosso catálogo atualizado de produtos.\n\n📄 Catálogo completo:\n${catalogUrl}`;
    if (storeUrl) msg += `\n\n🛒 Visite nossa loja:\n${storeUrl}`;
    msg += `\n\nResponderemos com prazer!`;
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyCampaignMessage = async () => {
    try {
      await navigator.clipboard.writeText(campaignMessage);
      setCampaignCopied(true);
      toast.success("Mensagem copiada!");
      setTimeout(() => setCampaignCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar mensagem");
    }
  };

  // Build campaign message when catalog URL becomes available
  useEffect(() => {
    if (catalogUrl && pdfGenerated) {
      setCampaignMessage(buildCampaignMessage(catalogUrl));
    }
  }, [catalogUrl, pdfGenerated]);

  const canGenerate = filterType === "all" || 
    filterType === "list" ||
    (filterType === "category" && selectedCategory) || 
    (filterType === "single" && selectedProduct);

  const showProductsPerPageSelector = filterType === "all" || filterType === "category";

  // Get preview grid dimensions matching PDF exactly
  const getGridDimensions = (): { cols: number; rows: number } => {
    switch (productsPerPage) {
      case 12: return { cols: 4, rows: 3 };
      case 4: return { cols: 2, rows: 2 };
      case 2: return { cols: 1, rows: 2 };
      default: return { cols: 3, rows: 3 }; // 9
    }
  };

  // Compute total preview pages: cover + product pages + back cover
  const getProductPageCount = () => {
    if (filteredProducts.length === 0) return 0;
    if (filterType === 'single') return 1;
    if (filterType === 'list') return Math.ceil(filteredProducts.length / 20); // ~20 items per list page
    return Math.ceil(filteredProducts.length / productsPerPage);
  };

  const productPageCount = getProductPageCount();
  const totalPreviewPages = filteredProducts.length > 0 ? 1 + productPageCount + 1 : 0; // cover + pages + backcover

  // Reset to first page when filters/layout change
  useEffect(() => {
    setCurrentPreviewPage(0);
  }, [filterType, selectedCategory, selectedProduct, productsPerPage, catalogLayout, filteredProducts.length]);

  // Build page labels for filmstrip
  const pageLabels = useMemo(() => {
    if (totalPreviewPages === 0) return [];
    const labels: string[] = ['Capa'];
    for (let i = 1; i <= productPageCount; i++) {
      labels.push(`Pg ${i}`);
    }
    labels.push('Contracapa');
    return labels;
  }, [totalPreviewPages, productPageCount]);

  const TWO_PRODUCTS_PREVIEW = {
    topAreaPx: 16,
    footerAreaPx: 26,
    gridGapPx: 12,
    contentPaddingPx: 12,
    cardPaddingPx: 10,
  };

  const renderTwoProductsPreviewPage = (pageProducts: Product[], pageIndex: number, previewColor: string) => {
    const slots: (Product | null)[] = [pageProducts[0] ?? null, pageProducts[1] ?? null];
    const cardHeight = `calc((100% - ${TWO_PRODUCTS_PREVIEW.gridGapPx}px) / 2)`;

    return (
      <div className="relative rounded-lg bg-white border overflow-hidden box-border" style={{ aspectRatio: '210 / 297' }}>
        <div className="absolute inset-y-0 left-0 w-4 flex flex-col items-center justify-end py-2" style={{ backgroundColor: previewColor }}>
          <span className="text-[6px] text-primary-foreground font-bold leading-tight text-center">PG<br />{String(pageIndex + 1).padStart(2, '0')}</span>
        </div>

        <div
          className="absolute inset-y-0 right-0 box-border"
          style={{
            left: '1rem',
            padding: `${TWO_PRODUCTS_PREVIEW.contentPaddingPx}px`,
          }}
        >
          <div
            className="h-full min-h-0 grid"
            style={{
              gridTemplateRows: `${TWO_PRODUCTS_PREVIEW.topAreaPx}px minmax(0, 1fr) ${TWO_PRODUCTS_PREVIEW.footerAreaPx}px`,
            }}
          >
            <div aria-hidden="true" />

            <div
              className="min-h-0 grid"
              style={{
                gridTemplateRows: `${cardHeight} ${cardHeight}`,
                rowGap: `${TWO_PRODUCTS_PREVIEW.gridGapPx}px`,
              }}
            >
              {slots.map((product, idx) => (
                <div
                  key={product?.id || `two-preview-empty-${idx}`}
                  className="border border-border rounded-md bg-card overflow-hidden box-border"
                  style={{ height: cardHeight }}
                >
                  {product ? (
                    <div
                      className="h-full w-full grid box-border"
                      style={{
                        padding: `${TWO_PRODUCTS_PREVIEW.cardPaddingPx}px`,
                        gridTemplateRows: showPrices
                          ? 'minmax(0, 1fr) 2.4rem 1.4rem 1.9rem'
                          : 'minmax(0, 1fr) 2.6rem 1.9rem',
                        rowGap: '6px',
                      }}
                    >
                      <div className="min-h-0 rounded bg-muted/30 flex items-center justify-center overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            Sem imagem
                          </div>
                        )}
                      </div>

                      <p
                        className="text-sm font-semibold text-foreground text-center leading-tight overflow-hidden"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {product.name}
                      </p>

                      {showPrices && (
                        <p className="text-base font-bold text-foreground text-center leading-none truncate">
                          {formatPrice(product.promotional_price || product.price)}
                        </p>
                      )}

                      <div
                        className="rounded text-primary-foreground text-xs font-medium w-full flex items-center justify-center"
                        style={{ backgroundColor: previewColor }}
                      >
                        Ver produto
                      </div>
                    </div>
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-end justify-center pb-1">
              <span className="text-[10px] text-muted-foreground">Página {pageIndex + 1}</span>
            </div>
          </div>
        </div>
      </div>
    );
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
                  onClick={handleShareWhatsApp}
                  disabled={!catalogUrl}
                  className="gap-2 bg-green-600 text-white hover:bg-green-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  Enviar pelo WhatsApp
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

              {/* Campaign message card */}
              {campaignMessage && (
                <div className="mt-8 max-w-xl mx-auto">
                  <div className="bg-muted/50 border border-border rounded-lg p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">Mensagem pronta de divulgação</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyCampaignMessage}
                        className="gap-1.5"
                        style={{ borderColor: primaryColor, color: primaryColor }}
                      >
                        {campaignCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {campaignCopied ? 'Copiada!' : 'Copiar mensagem'}
                      </Button>
                    </div>
                    <Textarea
                      value={campaignMessage}
                      onChange={(e) => setCampaignMessage(e.target.value)}
                      rows={10}
                      className="text-sm bg-background"
                    />
                    <p className="text-xs text-muted-foreground">Edite a mensagem acima antes de compartilhar, se desejar.</p>
                  </div>
                </div>
              )}
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

                {/* Layout selector */}
                <CatalogLayoutSelector
                  selected={catalogLayout}
                  onChange={setCatalogLayout}
                  primaryColor={buttonBgColor}
                />

                {/* Cover message field */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Mensagem na capa (opcional)</Label>
                  <Input
                    value={coverMessage}
                    onChange={(e) => setCoverMessage(e.target.value.slice(0, 60))}
                    placeholder="Ex: Catálogo 2026, Promoções do mês..."
                    maxLength={60}
                    merchantStyled
                  />
                  <p className="text-xs text-muted-foreground">{coverMessage.length}/60 caracteres</p>
                </div>

                {showProductsPerPageSelector && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Produtos por página</Label>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setProductsPerPage(12)}
                        className={`flex-1 min-w-[70px] flex flex-col items-center gap-2 p-3 rounded-lg border-2 products-per-page-btn ${productsPerPage === 12 ? 'selected' : ''}`}
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="4.5" height="5" rx="0.5" />
                          <rect x="7.25" y="3" width="4.5" height="5" rx="0.5" />
                          <rect x="13.5" y="3" width="4.5" height="5" rx="0.5" />
                          <rect x="1" y="10" width="4.5" height="5" rx="0.5" />
                          <rect x="7.25" y="10" width="4.5" height="5" rx="0.5" />
                          <rect x="13.5" y="10" width="4.5" height="5" rx="0.5" />
                          <rect x="1" y="17" width="4.5" height="5" rx="0.5" />
                          <rect x="7.25" y="17" width="4.5" height="5" rx="0.5" />
                          <rect x="13.5" y="17" width="4.5" height="5" rx="0.5" />
                          <rect x="19.5" y="3" width="3.5" height="5" rx="0.5" />
                          <rect x="19.5" y="10" width="3.5" height="5" rx="0.5" />
                          <rect x="19.5" y="17" width="3.5" height="5" rx="0.5" />
                        </svg>
                        <span className="text-xs font-medium">12 produtos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductsPerPage(9)}
                        className={`flex-1 min-w-[70px] flex flex-col items-center gap-2 p-3 rounded-lg border-2 products-per-page-btn ${productsPerPage === 9 ? 'selected' : ''}`}
                      >
                        <Grid3X3 className="h-5 w-5" />
                        <span className="text-xs font-medium">9 produtos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductsPerPage(4)}
                        className={`flex-1 min-w-[70px] flex flex-col items-center gap-2 p-3 rounded-lg border-2 products-per-page-btn ${productsPerPage === 4 ? 'selected' : ''}`}
                      >
                        <Grid2X2 className="h-5 w-5" />
                        <span className="text-xs font-medium">4 produtos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductsPerPage(2)}
                        className={`flex-1 min-w-[70px] flex flex-col items-center gap-2 p-3 rounded-lg border-2 products-per-page-btn ${productsPerPage === 2 ? 'selected' : ''}`}
                      >
                        <LayoutList className="h-5 w-5" />
                        <span className="text-xs font-medium">2 produtos</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Price toggle */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Incluir preços no catálogo</Label>
                  <RadioGroup value={showPrices ? 'show' : 'hide'} onValueChange={(v) => setShowPrices(v === 'show')}>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem 
                        value="show" 
                        id="price-show"
                        className="catalog-merchant-radio border-2"
                        style={{ borderColor: buttonBgColor, backgroundColor: '#FFFFFF', color: buttonBgColor }}
                      />
                      <Label htmlFor="price-show" className="cursor-pointer">Mostrar preços</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem 
                        value="hide" 
                        id="price-hide"
                        className="catalog-merchant-radio border-2"
                        style={{ borderColor: buttonBgColor, backgroundColor: '#FFFFFF', color: buttonBgColor }}
                      />
                      <Label htmlFor="price-hide" className="cursor-pointer">Ocultar preços</Label>
                    </div>
                  </RadioGroup>
                </div>

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
                    {/* Structure bar */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs text-muted-foreground">
                      {pageLabels.map((label, idx) => (
                        <span key={idx} className="flex items-center gap-1 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded ${idx === currentPreviewPage ? 'bg-muted font-semibold text-foreground' : ''}`}
                          >
                            {label}
                          </span>
                          {idx < pageLabels.length - 1 && <span className="text-muted-foreground/50">|</span>}
                        </span>
                      ))}
                    </div>

                    {/* Page indicator */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setCurrentPreviewPage(Math.max(0, currentPreviewPage - 1))}
                        disabled={currentPreviewPage === 0}
                        className="p-1 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <span className="text-sm font-medium text-muted-foreground">
                        Página {currentPreviewPage + 1} de {totalPreviewPages}
                      </span>
                      <button
                        onClick={() => setCurrentPreviewPage(Math.min(totalPreviewPages - 1, currentPreviewPage + 1))}
                        disabled={currentPreviewPage >= totalPreviewPages - 1}
                        className="p-1 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Workspace area with "real page" effect */}
                    <div className="rounded-lg p-6" style={{ backgroundColor: '#ECEFF1' }}>
                      <div style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.08)', borderRadius: '6px', overflow: 'hidden' }}>

                    {/* Main preview area */}
                    {currentPreviewPage === 0 && (
                      <CatalogCoverPreview
                        layoutType={catalogLayout}
                        primaryColor={storeProfile?.primary_color || primaryColor}
                        logoUrl={storeProfile?.store_logo_url}
                        coverMessage={coverMessage}
                      />
                    )}

                    {currentPreviewPage === totalPreviewPages - 1 && (
                      <CatalogBackCoverPreview
                        layoutType={catalogLayout}
                        primaryColor={storeProfile?.primary_color || primaryColor}
                        logoUrl={storeProfile?.store_logo_url}
                        storeSlug={storeProfile?.store_slug}
                        whatsappNumber={storeProfile?.whatsapp_number}
                        fullAddress={getFullAddress()}
                      />
                    )}

                    {currentPreviewPage > 0 && currentPreviewPage < totalPreviewPages - 1 && (() => {
                      const pageIndex = currentPreviewPage - 1; // 0-based product page index
                      const previewColor = storeProfile?.primary_color || primaryColor;

                      if (filterType === "single" && filteredProducts.length === 1) {
                        return (
                          <div className="relative rounded-lg overflow-hidden bg-white border aspect-[210/297]">
                            <div className="absolute left-0 top-0 bottom-0 w-4 flex flex-col items-center justify-end py-2" style={{ backgroundColor: previewColor }}>
                              <span className="text-[6px] text-white font-bold leading-tight text-center">PG<br/>{String(pageIndex + 1).padStart(2, '0')}</span>
                            </div>
                            <div className="ml-5 p-2 flex flex-col items-center text-center space-y-2 py-4">
                              <div className="w-20 h-20 flex items-center justify-center">
                                {filteredProducts[0].image_url ? (
                                  <img src={filteredProducts[0].image_url} alt={filteredProducts[0].name} className="max-w-full max-h-full object-contain" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-muted rounded">Sem imagem</div>
                                )}
                              </div>
                              <h3 className="text-xs font-bold text-foreground px-2">{filteredProducts[0].name}</h3>
                              {showPrices && <p className="text-sm font-bold text-foreground">{formatPrice(filteredProducts[0].promotional_price || filteredProducts[0].price)}</p>}
                              <div className="text-[8px] text-white rounded py-1 px-4" style={{ backgroundColor: previewColor }}>Ver produto</div>
                            </div>
                          </div>
                        );
                      }

                      if (filterType === "list") {
                        const itemsPerListPage = 20;
                        const startIdx = pageIndex * itemsPerListPage;
                        const pageItems = filteredProducts.slice(startIdx, startIdx + itemsPerListPage);
                        return (
                          <div className="relative rounded-lg overflow-hidden bg-white border aspect-[210/297]">
                            <div className="absolute left-0 top-0 bottom-0 w-4 flex flex-col items-center justify-end py-2" style={{ backgroundColor: previewColor }}>
                              <span className="text-[6px] text-white font-bold leading-tight text-center">PG<br/>{String(pageIndex + 1).padStart(2, '0')}</span>
                            </div>
                            <div className="ml-5 p-2 space-y-1">
                              <div className="rounded p-1 mb-1 flex items-center text-white text-[8px]" style={{ backgroundColor: previewColor }}>
                                <span className="font-semibold w-6 text-center">Item</span>
                                <span className="font-semibold flex-1 pl-2">Produto</span>
                                {showPrices && <span className="font-semibold pr-1">Valor</span>}
                              </div>
                              {pageItems.slice(0, 8).map((product, index) => (
                                <div key={product.id} className="flex items-center py-1 px-1 text-[7px]" style={{ backgroundColor: index % 2 === 0 ? 'rgb(245, 245, 245)' : 'rgb(255, 255, 255)' }}>
                                  <span className="w-5 text-center text-muted-foreground">{startIdx + index + 1}</span>
                                  <div className="w-4 h-4 flex-shrink-0 mx-1 flex items-center justify-center overflow-hidden rounded-sm bg-white">
                                    {product.image_url ? (
                                      <img src={product.image_url} alt={product.name} className="max-w-full max-h-full object-contain" />
                                    ) : (
                                      <div className="w-full h-full bg-muted" />
                                    )}
                                  </div>
                                  <span className="flex-1 truncate pl-1">{product.name}</span>
                                  {showPrices && <span className="font-semibold">{formatPrice(product.promotional_price || product.price)}</span>}
                                </div>
                              ))}
                              {pageItems.length > 8 && (
                                <p className="text-[8px] text-center text-muted-foreground mt-1">+{pageItems.length - 8} itens nesta página</p>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Grid layout (all / category) - Fixed grid matching PDF exactly
                      const perPage = productsPerPage;
                      const startIdx = pageIndex * perPage;
                      const pageProducts = filteredProducts.slice(startIdx, startIdx + perPage);

                      if (productsPerPage === 2) {
                        return renderTwoProductsPreviewPage(pageProducts, pageIndex, previewColor);
                      }

                      const { cols, rows } = getGridDimensions();
                      // Build a fixed grid: rows x cols, fill with products or empty
                      const gridSlots: (typeof pageProducts[0] | null)[] = [];
                      for (let i = 0; i < rows * cols; i++) {
                        gridSlots.push(i < pageProducts.length ? pageProducts[i] : null);
                      }

                      return (
                        <div className="relative rounded-lg overflow-hidden bg-white border" style={{ aspectRatio: '210 / 297' }}>
                          <div className="absolute left-0 top-0 bottom-0 w-4 flex flex-col items-center justify-end py-2" style={{ backgroundColor: previewColor }}>
                            <span className="text-[6px] text-primary-foreground font-bold leading-tight text-center">PG<br />{String(pageIndex + 1).padStart(2, '0')}</span>
                          </div>
                          <div className="ml-5 h-full flex flex-col box-border p-2">
                            <div
                              className="flex-1 grid"
                              style={{
                                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                gridTemplateRows: `repeat(${rows}, 1fr)`,
                                gap: '4px',
                              }}
                            >
                              {gridSlots.map((product, idx) => (
                                <div
                                  key={product?.id || `empty-${idx}`}
                                  className="bg-white border border-border rounded flex flex-col items-center overflow-hidden box-border p-1"
                                  style={{ minHeight: 0 }}
                                >
                                  {product ? (
                                    <>
                                      <div className="flex-1 w-full flex items-center justify-center overflow-hidden min-h-0">
                                        {product.image_url ? (
                                          <img src={product.image_url} alt={product.name} className="max-w-full max-h-full object-contain" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-[6px] text-muted-foreground bg-muted rounded">Sem imagem</div>
                                        )}
                                      </div>
                                      <p className={`${productsPerPage === 12 ? 'text-[5px]' : 'text-[7px]'} font-medium w-full text-center truncate mt-0.5`}>{product.name}</p>
                                      {showPrices && <p className={`${productsPerPage === 12 ? 'text-[6px]' : 'text-[8px]'} font-bold`}>{formatPrice(product.promotional_price || product.price)}</p>}
                                      <div className={`${productsPerPage === 12 ? 'text-[5px]' : 'text-[6px]'} text-primary-foreground rounded py-0.5 px-2 mt-0.5 w-full text-center`} style={{ backgroundColor: previewColor }}>Ver produto</div>
                                    </>
                                  ) : (
                                    <div className="w-full h-full" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                      </div>
                    </div>

                    {/* Filmstrip thumbnails */}
                    <div className="flex gap-2 overflow-x-auto pb-2 pt-1 px-1">
                      {pageLabels.map((label, idx) => {
                        const isActive = idx === currentPreviewPage;
                        const previewColor = storeProfile?.primary_color || primaryColor;
                        return (
                          <button
                            key={idx}
                            onClick={() => setCurrentPreviewPage(idx)}
                            className={`flex-shrink-0 rounded-md border-2 transition-all duration-200 flex flex-col items-center justify-center bg-white hover:shadow-md`}
                            style={{
                              width: 56,
                              height: 76,
                              borderColor: isActive ? previewColor : 'hsl(var(--border))',
                              boxShadow: isActive ? `0 0 0 2px ${previewColor}33` : '0 1px 3px rgba(0,0,0,0.08)',
                              outline: isActive ? `2px solid ${previewColor}` : 'none',
                              outlineOffset: '1px',
                            }}
                          >
                            {/* Mini thumbnail content */}
                            {idx === 0 && (
                              <div className="w-full h-full rounded overflow-hidden relative">
                                <div className="absolute inset-0" style={{ backgroundColor: `${previewColor}15` }} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-white rounded-sm shadow-sm px-1 py-0.5">
                                    <span className="text-[5px] font-bold text-foreground">CATÁLOGO</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {idx === totalPreviewPages - 1 && (
                              <div className="w-full h-full rounded overflow-hidden relative">
                                <div className="absolute inset-0 bg-muted/30" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                                    <span className="text-[4px] text-muted-foreground">Logo</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {idx > 0 && idx < totalPreviewPages - 1 && (
                              <div className="w-full h-full rounded overflow-hidden relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: previewColor }} />
                                <div className="ml-2 mt-1 space-y-0.5">
                                  {[...Array(Math.min(3, productsPerPage))].map((_, i) => (
                                    <div key={i} className="h-1 bg-muted rounded-sm" style={{ width: `${60 - i * 10}%` }} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Page label under filmstrip */}
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {pageLabels[currentPreviewPage]} — Total: {filteredProducts.length} produto(s)
                      </span>
                    </div>
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
