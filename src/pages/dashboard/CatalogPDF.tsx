import { useState, useEffect, useRef } from "react";
import { FileText, Download, Share2, RefreshCw, Printer, Check } from "lucide-react";
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
  const [copied, setCopied] = useState(false);

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
      .select("id, name, price, promotional_price, image_url, category_id")
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

  const generatePDF = async () => {
    if (filteredProducts.length === 0) {
      toast.error("Selecione pelo menos um produto para gerar o catálogo");
      return;
    }

    setIsGenerating(true);

    try {
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
      const cardHeight = contentHeight / 3 - 6; // Taller cards with less gap
      const productsPerPage = 9;

      const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
      const currentDate = new Date().toLocaleDateString("pt-BR");

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
            // Use PNG format for logos to preserve transparency
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
          const y = headerHeight + margin + row * (cardHeight + 6);

          // Card background (white) with subtle border
          pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(230, 230, 230);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");

          // Product image area - increased height for taller cards
          const imageAreaWidth = cardWidth - 6;
          const imageAreaHeight = cardHeight * 0.55;
          const imageAreaX = x + 3;
          const imageAreaY = y + 3;
          
          // Light image placeholder background
          pdf.setFillColor(250, 250, 250);
          pdf.rect(imageAreaX, imageAreaY, imageAreaWidth, imageAreaHeight, "F");

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
                // Center the image in the area
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

          // Product name with word wrap - full text display
          pdf.setFontSize(7);
          pdf.setTextColor(40, 40, 40);
          const nameY = y + imageAreaHeight + 8;
          const maxNameWidth = cardWidth - 8;
          const nameLines = pdf.splitTextToSize(product.name, maxNameWidth);
          const maxLines = 3; // Maximum 3 lines for name
          const displayLines = nameLines.slice(0, maxLines);
          const lineHeight = 3;
          
          displayLines.forEach((line: string, lineIndex: number) => {
            pdf.text(line, x + 4, nameY + (lineIndex * lineHeight));
          });

          // Price - position after name lines
          const price = product.promotional_price || product.price;
          pdf.setFontSize(9);
          pdf.setTextColor(20, 20, 20);
          pdf.setFont("helvetica", "bold");
          const priceY = nameY + (displayLines.length * lineHeight) + 4;
          pdf.text(formatPrice(price), x + 4, priceY);
          pdf.setFont("helvetica", "normal");

          // "Ver produto" button - clickable link to product page
          const btnY = y + cardHeight - 11;
          const btnWidth = cardWidth - 8;
          const btnHeight = 8;
          
          // Parse primary color
          const hexColor = storeProfile?.primary_color || primaryColor || "#6a1b9a";
          const r = parseInt(hexColor.slice(1, 3), 16) || 106;
          const g = parseInt(hexColor.slice(3, 5), 16) || 27;
          const b = parseInt(hexColor.slice(5, 7), 16) || 154;
          
          pdf.setFillColor(r, g, b);
          pdf.roundedRect(x + 4, btnY, btnWidth, btnHeight, 2, 2, "F");
          
          pdf.setFontSize(7);
          pdf.setTextColor(255, 255, 255);
          pdf.text("Ver produto", x + cardWidth / 2, btnY + 5, { align: "center" });

          // Add clickable link to product page (works in digital PDF)
          if (storeProfile?.store_slug) {
            const productUrl = `${window.location.origin}/loja/${storeProfile.store_slug}/produto/${product.id}`;
            // Make entire card clickable for better UX
            pdf.link(x, y, cardWidth, cardHeight, { url: productUrl });
          }
        }

        // Footer
        const footerY = pageHeight - footerHeight;
        const hexColor = storeProfile?.primary_color || primaryColor || "#6a1b9a";
        const r = parseInt(hexColor.slice(1, 3), 16) || 106;
        const g = parseInt(hexColor.slice(3, 5), 16) || 27;
        const b = parseInt(hexColor.slice(5, 7), 16) || 154;
        
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

      const blob = pdf.output("blob");
      setPdfBlob(blob);
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

  const handleSharePDF = async () => {
    if (!pdfBlob) return;
    
    const fileName = `catalogo-${storeProfile?.store_slug || 'produtos'}-${new Date().toISOString().split("T")[0]}.pdf`;
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });
    
    // Try native share API first (mobile/tablet) - shares the actual PDF file
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Catálogo de Produtos",
          text: `Confira nosso catálogo de produtos! Cada produto possui um link direto para a loja.`,
        });
        toast.success("Catálogo PDF compartilhado!");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch (e) {
        // User cancelled or share failed, fall through to download
        if ((e as Error).name !== "AbortError") {
          // Fall through to download
        } else {
          return; // User cancelled, don't download
        }
      }
    }
    
    // Fallback: Download the PDF file for manual sharing
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setCopied(true);
    toast.success("PDF baixado! O catálogo contém links clicáveis para cada produto.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNewCatalog = () => {
    setPdfGenerated(false);
    setPdfBlob(null);
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
                  onClick={handleSharePDF}
                  className="gap-2"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  Compartilhar PDF
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

                    {/* Products Grid Preview */}
                    <div className="grid grid-cols-3 gap-2">
                      {filteredProducts.slice(0, 9).map((product) => (
                        <div 
                          key={product.id} 
                          className="bg-white border border-gray-200 rounded-lg p-2 text-center"
                        >
                          <div className="aspect-[4/5] bg-gray-50 rounded mb-2 overflow-hidden flex items-center justify-center">
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
                          <p className="text-xs font-medium line-clamp-2 min-h-[2rem]">{product.name}</p>
                          <p className="text-xs font-bold">
                            {formatPrice(product.promotional_price || product.price)}
                          </p>
                          <div 
                            className="text-[8px] text-white rounded py-1 mt-1"
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
