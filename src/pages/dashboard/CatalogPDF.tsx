import { useState, useEffect } from "react";
import { FileText, Download, Copy, RefreshCw, Printer, Check } from "lucide-react";
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

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
  category_id: string | null;
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

const CatalogPDF = () => {
  const { user } = useAuth();
  const { primaryColor, buttonBgColor, buttonTextColor } = useTheme();
  
  const [filterType, setFilterType] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
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

    // Fetch products
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, description, price, promotional_price, image_url, category_id")
      .eq("user_id", user.id)
      .order("name");

    if (productsData) {
      setProducts(productsData);
    }

    // Fetch categories
    const { data: categoriesData } = await supabase
      .from("product_categories")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name");

    if (categoriesData) {
      setCategories(categoriesData);
    }

    // Fetch store profile
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

  // Helper function to load image and get dimensions (preserves transparency with PNG)
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
          // For transparent images (like logos), don't fill background
          if (!preserveTransparency) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0);
          // Use PNG for logos to preserve transparency, JPEG for products
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

  // Helper function to calculate image dimensions maintaining aspect ratio
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

  // Generate PDF for single product with exclusive layout
  const generateSingleProductPDF = async (product: Product) => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const headerHeight = 28;
    const footerHeight = 18;
    const currentDate = new Date().toLocaleDateString("pt-BR");

    // Parse primary color
    const hexColor = storeProfile?.primary_color || primaryColor || "#6a1b9a";
    const r = parseInt(hexColor.slice(1, 3), 16) || 106;
    const g = parseInt(hexColor.slice(3, 5), 16) || 27;
    const b = parseInt(hexColor.slice(5, 7), 16) || 154;

    // Load logo if available with proper dimensions (preserve transparency)
    let logoImageData: { data: string; width: number; height: number; format: string } | null = null;
    if (storeProfile?.store_logo_url) {
      logoImageData = await loadImageWithDimensions(storeProfile.store_logo_url, true);
    }

    // Header background
    pdf.setFillColor(240, 240, 240);
    pdf.rect(0, 0, pageWidth, headerHeight, "F");

    // Logo with proper aspect ratio (no background/border)
    if (logoImageData) {
      try {
        const logoMaxWidth = 40;
        const logoMaxHeight = 20;
        const logoDimensions = calculateImageDimensions(
          logoImageData.width,
          logoImageData.height,
          logoMaxWidth,
          logoMaxHeight
        );
        const logoX = margin;
        const logoY = (headerHeight - logoDimensions.height) / 2;
        pdf.addImage(logoImageData.data, logoImageData.format, logoX, logoY, logoDimensions.width, logoDimensions.height);
      } catch (e) {
        pdf.setFontSize(12);
        pdf.setTextColor(80, 80, 80);
        pdf.text("Logo", margin, 16);
      }
    }

    // Header title
    pdf.setFontSize(16);
    pdf.setTextColor(50, 50, 50);
    pdf.text("Catálogo de Produtos", pageWidth - margin, 12, { align: "right" });
    
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Gerado em: ${currentDate}`, pageWidth - margin, 22, { align: "right" });

    // Content area calculations
    const contentStartY = headerHeight + margin;
    const contentEndY = pageHeight - footerHeight - margin;
    const contentHeight = contentEndY - contentStartY;
    const contentCenterX = pageWidth / 2;

    // Image dimensions for single product (compact size to maximize description space)
    const imageMaxWidth = 35;
    const imageMaxHeight = 35;
    
    let currentY = contentStartY + 3;

    // Load and add product image centered
    if (product.image_url) {
      const productImageData = await loadImageWithDimensions(product.image_url, false);
      if (productImageData) {
        try {
          const imgDimensions = calculateImageDimensions(
            productImageData.width,
            productImageData.height,
            imageMaxWidth,
            imageMaxHeight
          );
          const imgX = contentCenterX - (imgDimensions.width / 2);
          pdf.addImage(productImageData.data, productImageData.format, imgX, currentY, imgDimensions.width, imgDimensions.height);
          currentY += imgDimensions.height + 4;
        } catch (e) {
          currentY += 4;
        }
      }
    } else {
      currentY += 4;
    }

    // Product title (full name, justified, compact size)
    pdf.setFontSize(10);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont("helvetica", "bold");
    const titleMaxWidth = pageWidth - (margin * 4);
    const titleLines = pdf.splitTextToSize(product.name, titleMaxWidth);
    const titleStartX = margin * 2;
    titleLines.forEach((line: string, index: number) => {
      const isLastLine = index === titleLines.length - 1;
      const lineWidth = pdf.getTextWidth(line);
      
      // Justify text for multi-line titles (except last line)
      if (!isLastLine && titleLines.length > 1 && lineWidth >= titleMaxWidth * 0.7) {
        const words = line.split(' ');
        if (words.length > 1) {
          const totalWordsWidth = words.reduce((sum, word) => sum + pdf.getTextWidth(word), 0);
          const extraSpace = (titleMaxWidth - totalWordsWidth) / (words.length - 1);
          let xPos = titleStartX;
          words.forEach((word, wordIndex) => {
            pdf.text(word, xPos, currentY);
            xPos += pdf.getTextWidth(word) + (wordIndex < words.length - 1 ? extraSpace : 0);
          });
        } else {
          pdf.text(line, contentCenterX, currentY, { align: "center" });
        }
      } else {
        // Center align for single-line titles or last line
        pdf.text(line, contentCenterX, currentY, { align: "center" });
      }
      currentY += 4;
    });
    pdf.setFont("helvetica", "normal");
    currentY += 2;

    // Product price (centered, compact size)
    const price = product.promotional_price || product.price;
    pdf.setFontSize(11);
    pdf.setTextColor(20, 20, 20);
    pdf.setFont("helvetica", "bold");
    pdf.text(formatPrice(price), contentCenterX, currentY, { align: "center" });
    pdf.setFont("helvetica", "normal");
    currentY += 5;

    // "Ver produto" button (centered, compact size, with merchant's primary color)
    const btnWidth = 32;
    const btnHeight = 6;
    const btnX = contentCenterX - (btnWidth / 2);
    const btnY = currentY;
    
    pdf.setFillColor(r, g, b);
    pdf.roundedRect(btnX, btnY, btnWidth, btnHeight, 1.5, 1.5, "F");
    
    pdf.setFontSize(7);
    pdf.setTextColor(255, 255, 255);
    pdf.text("Ver produto", contentCenterX, btnY + 4, { align: "center" });

    // Add clickable link to the button area
    if (storeProfile?.store_slug) {
      const productUrl = `${window.location.origin}/loja/${storeProfile.store_slug}/produto/${product.id}`;
      pdf.link(btnX, btnY, btnWidth, btnHeight, { url: productUrl });
    }
    currentY += btnHeight + 6;

    // Product description (justified text, full width, prioritized for complete display)
    if (product.description) {
      pdf.setFontSize(9);
      pdf.setTextColor(50, 50, 50);
      const descMargin = margin * 2;
      const descMaxWidth = pageWidth - (descMargin * 2);
      const descStartX = descMargin;
      const descLines = pdf.splitTextToSize(product.description, descMaxWidth);
      
      // Calculate available space for description
      const availableHeight = contentEndY - currentY - 3;
      const lineHeight = 4;
      const maxDescLines = Math.floor(availableHeight / lineHeight);
      const displayDescLines = descLines.slice(0, maxDescLines);
      
      // Render description with justified alignment
      displayDescLines.forEach((line: string, index: number) => {
        // Last line or short lines should be left-aligned, others justified
        const isLastLine = index === displayDescLines.length - 1;
        const lineWidth = pdf.getTextWidth(line);
        
        if (isLastLine || lineWidth < descMaxWidth * 0.7) {
          // Left align for last line or short lines
          pdf.text(line, descStartX, currentY);
        } else {
          // Justify text by distributing extra space between words
          const words = line.split(' ');
          if (words.length > 1) {
            const totalWordsWidth = words.reduce((sum, word) => sum + pdf.getTextWidth(word), 0);
            const extraSpace = (descMaxWidth - totalWordsWidth) / (words.length - 1);
            let xPos = descStartX;
            words.forEach((word, wordIndex) => {
              pdf.text(word, xPos, currentY);
              xPos += pdf.getTextWidth(word) + (wordIndex < words.length - 1 ? extraSpace : 0);
            });
          } else {
            pdf.text(line, descStartX, currentY);
          }
        }
        currentY += lineHeight;
      });
    }

    // Footer
    const footerY = pageHeight - footerHeight;
    pdf.setFillColor(r, g, b);
    pdf.rect(0, footerY, pageWidth, footerHeight, "F");

    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    
    const footerInfo = [
      getFullAddress(),
      storeProfile?.email,
      storeProfile?.whatsapp_number ? `WhatsApp: ${storeProfile.whatsapp_number}` : ""
    ].filter(Boolean).join(" | ");
    
    pdf.text(footerInfo, pageWidth / 2, footerY + 12, { align: "center" });

    return pdf;
  };

  // Generate PDF for multiple products (grid layout)
  const generateMultipleProductsPDF = async () => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const headerHeight = 28;
    const footerHeight = 18;
    const contentHeight = pageHeight - headerHeight - footerHeight - (margin * 2);
    
    const cardWidth = (pageWidth - (margin * 2) - 16) / 3;
    const cardHeight = (contentHeight - 12) / 3;
    const cardGap = 6;
    const productsPerPage = 9;

    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    const currentDate = new Date().toLocaleDateString("pt-BR");

    // Parse primary color
    const hexColor = storeProfile?.primary_color || primaryColor || "#6a1b9a";
    const r = parseInt(hexColor.slice(1, 3), 16) || 106;
    const g = parseInt(hexColor.slice(3, 5), 16) || 27;
    const b = parseInt(hexColor.slice(5, 7), 16) || 154;

    // Load logo if available with proper dimensions (preserve transparency)
    let logoImageData: { data: string; width: number; height: number; format: string } | null = null;
    if (storeProfile?.store_logo_url) {
      logoImageData = await loadImageWithDimensions(storeProfile.store_logo_url, true);
    }

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }

      // Header background
      pdf.setFillColor(240, 240, 240);
      pdf.rect(0, 0, pageWidth, headerHeight, "F");

      // Logo with proper aspect ratio (no background/border)
      if (logoImageData) {
        try {
          const logoMaxWidth = 40;
          const logoMaxHeight = 20;
          const logoDimensions = calculateImageDimensions(
            logoImageData.width,
            logoImageData.height,
            logoMaxWidth,
            logoMaxHeight
          );
          const logoX = margin;
          const logoY = (headerHeight - logoDimensions.height) / 2;
          pdf.addImage(logoImageData.data, logoImageData.format, logoX, logoY, logoDimensions.width, logoDimensions.height);
        } catch (e) {
          pdf.setFontSize(12);
          pdf.setTextColor(80, 80, 80);
          pdf.text("Logo", margin, 16);
        }
      }

      // Header title
      pdf.setFontSize(16);
      pdf.setTextColor(50, 50, 50);
      pdf.text("Catálogo de Produtos", pageWidth - margin, 12, { align: "right" });
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Gerado em: ${currentDate}`, pageWidth - margin, 22, { align: "right" });

      // Products
      const startIndex = page * productsPerPage;
      const endIndex = Math.min(startIndex + productsPerPage, filteredProducts.length);
      const pageProducts = filteredProducts.slice(startIndex, endIndex);

      for (let i = 0; i < pageProducts.length; i++) {
        const product = pageProducts[i];
        const row = Math.floor(i / 3);
        const col = i % 3;
        
        const x = margin + col * (cardWidth + 8);
        const y = headerHeight + margin + row * (cardHeight + cardGap);

        // Card background (pure white) with subtle border
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");

        // Product image area - NO gray background, pure white
        const imageAreaWidth = cardWidth - 6;
        const imageAreaHeight = cardHeight * 0.48;
        const imageAreaX = x + 3;
        const imageAreaY = y + 3;

        // Load and add product image with proper aspect ratio
        if (product.image_url) {
          const productImageData = await loadImageWithDimensions(product.image_url, false);
          if (productImageData) {
            try {
              const imgDimensions = calculateImageDimensions(
                productImageData.width,
                productImageData.height,
                imageAreaWidth - 4,
                imageAreaHeight - 4
              );
              const imgX = imageAreaX + (imageAreaWidth - imgDimensions.width) / 2;
              const imgY = imageAreaY + (imageAreaHeight - imgDimensions.height) / 2;
              pdf.addImage(productImageData.data, productImageData.format, imgX, imgY, imgDimensions.width, imgDimensions.height);
            } catch (e) {
              pdf.setFontSize(7);
              pdf.setTextColor(150, 150, 150);
              pdf.text("Sem imagem", x + cardWidth / 2, imageAreaY + imageAreaHeight / 2, { align: "center" });
            }
          } else {
            pdf.setFontSize(7);
            pdf.setTextColor(150, 150, 150);
            pdf.text("Sem imagem", x + cardWidth / 2, imageAreaY + imageAreaHeight / 2, { align: "center" });
          }
        } else {
          pdf.setFontSize(7);
          pdf.setTextColor(150, 150, 150);
          pdf.text("Sem imagem", x + cardWidth / 2, imageAreaY + imageAreaHeight / 2, { align: "center" });
        }

        // Product name with word wrap (justified alignment) - FULL title without truncation
        pdf.setFontSize(7);
        pdf.setTextColor(40, 40, 40);
        const nameY = y + imageAreaHeight + 8;
        const maxNameWidth = cardWidth - 8;
        const nameLines = pdf.splitTextToSize(product.name, maxNameWidth);
        // Display ALL lines without truncation
        const lineHeight = 3;
        const nameStartX = x + 4;
        
        nameLines.forEach((line: string, lineIndex: number) => {
          const isLastLine = lineIndex === nameLines.length - 1;
          const lineWidth = pdf.getTextWidth(line);
          
          // Justify text for multi-line names (except last line)
          if (!isLastLine && nameLines.length > 1 && lineWidth >= maxNameWidth * 0.7) {
            const words = line.split(' ');
            if (words.length > 1) {
              const totalWordsWidth = words.reduce((sum, word) => sum + pdf.getTextWidth(word), 0);
              const extraSpace = (maxNameWidth - totalWordsWidth) / (words.length - 1);
              let xPos = nameStartX;
              words.forEach((word, wordIndex) => {
                pdf.text(word, xPos, nameY + (lineIndex * lineHeight));
                xPos += pdf.getTextWidth(word) + (wordIndex < words.length - 1 ? extraSpace : 0);
              });
            } else {
              pdf.text(line, nameStartX, nameY + (lineIndex * lineHeight));
            }
          } else {
            pdf.text(line, nameStartX, nameY + (lineIndex * lineHeight));
          }
        });
        
        // Calculate dynamic price position based on title height
        const titleHeight = nameLines.length * lineHeight;

        // "Ver produto" button - calculate position first
        const btnHeight = 7;
        const btnY = y + cardHeight - btnHeight - 3;
        const btnWidth = cardWidth - 8;

        // Price - positioned between title and button, with max limit
        const price = product.promotional_price || product.price;
        pdf.setFontSize(9);
        pdf.setTextColor(20, 20, 20);
        pdf.setFont("helvetica", "bold");
        
        // Calculate ideal price position and ensure it's above the button
        const idealPriceY = nameY + titleHeight + 5;
        const maxPriceY = btnY - 4; // Minimum 4mm above button
        const priceY = Math.min(idealPriceY, maxPriceY);
        
        pdf.text(formatPrice(price), x + 4, priceY);
        pdf.setFont("helvetica", "normal");

        // Draw button
        pdf.setFillColor(r, g, b);
        pdf.roundedRect(x + 4, btnY, btnWidth, btnHeight, 2, 2, "F");
        
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.text("Ver produto", x + cardWidth / 2, btnY + 4.5, { align: "center" });

        // Add clickable link to product page
        if (storeProfile?.store_slug) {
          const productUrl = `${window.location.origin}/loja/${storeProfile.store_slug}/produto/${product.id}`;
          pdf.link(x, y, cardWidth, cardHeight, { url: productUrl });
        }
      }

      // Footer
      const footerY = pageHeight - footerHeight;
      pdf.setFillColor(r, g, b);
      pdf.rect(0, footerY, pageWidth, footerHeight, "F");

      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      
      const footerInfo = [
        getFullAddress(),
        storeProfile?.email,
        storeProfile?.whatsapp_number ? `WhatsApp: ${storeProfile.whatsapp_number}` : ""
      ].filter(Boolean).join(" | ");
      
      pdf.text(footerInfo, pageWidth / 2, footerY + 12, { align: "center" });
    }

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

      // Use exclusive layout for single product
      if (filterType === "single" && filteredProducts.length === 1) {
        pdf = await generateSingleProductPDF(filteredProducts[0]);
      } else {
        pdf = await generateMultipleProductsPDF();
      }

      const blob = pdf.output("blob");
      setPdfBlob(blob);
      
      // Upload PDF to storage and get public URL
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

      // If the URL wasn't generated (e.g. upload policy), upload on-demand and then copy
      if (!url && pdfBlob && user?.id) {
        const fileName = `${user.id}/catalogs/${Date.now()}-catalogo.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: true });

        if (uploadError) throw uploadError;

        url =
          supabase.storage.from("product-images").getPublicUrl(uploadData.path).data
            .publicUrl ?? null;

        if (url) setCatalogUrl(url);
      }

      if (!url) {
        toast.error("URL do catálogo não disponível");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        textarea.style.left = "-1000px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
      toast.success("Link do catálogo copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error("Erro ao copiar link");
      if (import.meta.env.DEV) console.error("Copy catalog link error:", e);
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
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Sem categoria";
    const category = categories.find(c => c.id === categoryId);
    return category?.name || "Sem categoria";
  };

  const canGenerate = filterType === "all" || 
    (filterType === "category" && selectedCategory) || 
    (filterType === "single" && selectedProduct);

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
                <RadioGroup value={filterType} onValueChange={setFilterType}>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      value="all" 
                      id="all"
                      style={{ 
                        borderColor: filterType === "all" ? primaryColor : undefined,
                        backgroundColor: filterType === "all" ? primaryColor : "white"
                      }}
                    />
                    <Label htmlFor="all" className="cursor-pointer">
                      Gerar catálogo de todos os produtos
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      value="category" 
                      id="category"
                      style={{ 
                        borderColor: filterType === "category" ? primaryColor : undefined,
                        backgroundColor: filterType === "category" ? primaryColor : "white"
                      }}
                    />
                    <Label htmlFor="category" className="cursor-pointer">
                      Gerar catálogo de uma categoria específica
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem 
                      value="single" 
                      id="single"
                      style={{ 
                        borderColor: filterType === "single" ? primaryColor : undefined,
                        backgroundColor: filterType === "single" ? primaryColor : "white"
                      }}
                    />
                    <Label htmlFor="single" className="cursor-pointer">
                      Gerar catálogo de um único produto
                    </Label>
                  </div>
                </RadioGroup>

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
                        <SelectValue placeholder="Escolha um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
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
                    backgroundColor: canGenerate ? buttonBgColor : undefined, 
                    color: canGenerate ? buttonTextColor : undefined 
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
                    {/* Preview Header */}
                    <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {storeProfile?.store_logo_url ? (
                          <img 
                            src={storeProfile.store_logo_url} 
                            alt="Logo" 
                            className="h-8 w-auto object-contain"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-300 rounded flex items-center justify-center text-xs text-gray-500">
                            Logo
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">Catálogo de Produtos</p>
                        <p className="text-xs text-muted-foreground">
                          Gerado em: {new Date().toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>

                    {/* Single Product Preview - Exclusive Layout */}
                    {filterType === "single" && filteredProducts.length === 1 ? (
                      <div className="flex flex-col items-center text-center space-y-4 py-4">
                        {/* Product Image */}
                        <div className="w-32 h-32 flex items-center justify-center">
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
                        
                        {/* Product Title */}
                        <h3 className="text-sm font-bold text-foreground px-4">
                          {filteredProducts[0].name}
                        </h3>
                        
                        {/* Product Price */}
                        <p className="text-lg font-bold text-foreground">
                          {formatPrice(filteredProducts[0].promotional_price || filteredProducts[0].price)}
                        </p>
                        
                        {/* Ver produto button */}
                        <div 
                          className="text-xs text-white rounded-md py-2 px-6"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Ver produto
                        </div>
                        
                        {/* Product Description */}
                        {filteredProducts[0].description && (
                          <p className="text-xs text-muted-foreground px-4 line-clamp-4">
                            {filteredProducts[0].description}
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Products Grid Preview */}
                        <div className="grid grid-cols-3 gap-2">
                          {filteredProducts.slice(0, 9).map((product) => (
                            <div 
                              key={product.id} 
                              className="bg-white border border-gray-200 rounded-lg p-2 text-center"
                            >
                              <div className="aspect-square rounded mb-2 overflow-hidden flex items-center justify-center bg-white">
                                {product.image_url ? (
                                  <img 
                                    src={product.image_url} 
                                    alt={product.name}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-gray-50">
                                    Sem imagem
                                  </div>
                                )}
                              </div>
                              <p className="text-xs font-medium text-center">{product.name}</p>
                              <p className="text-xs font-bold mb-1">
                                {formatPrice(product.promotional_price || product.price)}
                              </p>
                              <div 
                                className="text-[8px] text-white rounded py-1"
                                style={{ backgroundColor: primaryColor }}
                              >
                                Ver produto
                              </div>
                            </div>
                          ))}
                        </div>

                        {filteredProducts.length > 9 && (
                          <p className="text-sm text-muted-foreground text-center">
                            +{filteredProducts.length - 9} produtos adicionais
                          </p>
                        )}
                      </>
                    )}

                    {/* Preview Footer */}
                    <div 
                      className="rounded-lg p-3 text-center text-white text-xs"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <p className="truncate">
                        {[
                          getFullAddress(),
                          storeProfile?.email,
                          storeProfile?.whatsapp_number ? `WhatsApp: ${storeProfile.whatsapp_number}` : ""
                        ].filter(Boolean).join(" | ")}
                      </p>
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
