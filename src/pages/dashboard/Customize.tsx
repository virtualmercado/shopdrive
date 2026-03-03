import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Upload, Palette, Image, Type, LayoutGrid, RectangleHorizontal } from "lucide-react";
import { AIPaletteSection } from "@/components/customize/AIPaletteSection";
import { TopBarConfigSection } from "@/components/customize/TopBarConfigSection";
import { StoreLayoutSelector } from "@/components/customize/StoreLayoutSelector";
import { useMerchantPlan } from "@/hooks/useMerchantPlan";
import { PlanGateOverlay } from "@/components/plan";

// Fixed ShopDrive admin colors — never inherit from merchant theme
const SD_PRIMARY = "#6A1B9A";
const SD_PRIMARY_BG = "#6A1B9A40";
const SD_PRIMARY_HOVER = "#6A1B9A80";

const Customize = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [colors, setColors] = useState({
    primary: "#6a1b9a",
    secondary: "#FB8C00",
    background: "#FFFFFF",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontWeight, setFontWeight] = useState(400);
  const [productImageFormat, setProductImageFormat] = useState("square");
  const [productBorderStyle, setProductBorderStyle] = useState("rounded");
  const [productTextAlignment, setProductTextAlignment] = useState("left");
  const [productButtonDisplay, setProductButtonDisplay] = useState("below");
  const [buttonBorderStyle, setButtonBorderStyle] = useState("rounded");
  const [buttonBgColor, setButtonBgColor] = useState("#6a1b9a");
  const [buttonTextColor, setButtonTextColor] = useState("#FFFFFF");
  const [headerLogoPosition, setHeaderLogoPosition] = useState<"left" | "center" | "right">("left");

  const { plan, limits, loading: planLoading } = useMerchantPlan();
  const isBlocked = plan === 'free';

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_logo_url, primary_color, secondary_color, footer_text_color, font_family, font_weight, product_image_format, product_border_style, product_text_alignment, product_button_display, button_border_style, button_bg_color, button_text_color, header_logo_position")
        .eq("id", user.id)
        .single();

      if (profile) {
        setLogoUrl(profile.store_logo_url);
        if (profile.primary_color) setColors(prev => ({ ...prev, primary: profile.primary_color }));
        if (profile.secondary_color) setColors(prev => ({ ...prev, secondary: profile.secondary_color }));
        if (profile.footer_text_color) setColors(prev => ({ ...prev, background: profile.footer_text_color }));
        if (profile.font_family) setFontFamily(profile.font_family);
        if (profile.font_weight) setFontWeight(profile.font_weight);
        if (profile.product_image_format) setProductImageFormat(profile.product_image_format);
        if (profile.product_border_style) setProductBorderStyle(profile.product_border_style);
        if (profile.product_text_alignment) setProductTextAlignment(profile.product_text_alignment);
        if (profile.product_button_display) setProductButtonDisplay(profile.product_button_display);
        if (profile.button_border_style) setButtonBorderStyle(profile.button_border_style);
        if (profile.button_bg_color) setButtonBgColor(profile.button_bg_color);
        if (profile.button_text_color) setButtonTextColor(profile.button_text_color);
        if (profile.header_logo_position) setHeaderLogoPosition(profile.header_logo_position as "left" | "center" | "right");
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !userId) return;

    const file = e.target.files[0];
    
    if (file.size > 200 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo recomendado é 200 KB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/logo_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ store_logo_url: publicUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);
      toast({
        title: "Logo atualizada!",
        description: "A logo foi enviada e está disponível na sua loja online.",
      });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro ao enviar logo",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!userId || !logoUrl) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ store_logo_url: null })
        .eq("id", userId);

      if (error) throw error;

      setLogoUrl(null);
      toast({
        title: "Logo removida",
        description: "A logo foi excluída. O nome da loja será exibido no header.",
      });
    } catch (error) {
      console.error("Erro ao remover logo:", error);
      toast({
        title: "Erro ao remover logo",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          primary_color: colors.primary,
          secondary_color: colors.secondary,
          footer_text_color: colors.background,
          font_family: fontFamily,
          font_weight: fontWeight,
          product_image_format: productImageFormat,
          product_border_style: productBorderStyle,
          product_text_alignment: productTextAlignment,
          product_button_display: productButtonDisplay,
          button_border_style: buttonBorderStyle,
          button_bg_color: buttonBgColor,
          button_text_color: buttonTextColor,
          header_logo_position: headerLogoPosition
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Alterações salvas!",
        description: "Sua loja foi atualizada com sucesso",
      });
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <p>Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 relative">
        {/* Plan gate overlay for FREE plan */}
        {isBlocked && !planLoading && (
          <PlanGateOverlay
            message={"Personalização completa disponível apenas nos planos PRO e PREMIUM.\nFaça upgrade para liberar logo, cores e identidade visual personalizada."}
            buttonLabel="Ver Planos"
            fixed
          />
        )}

        {/* Colors */}
        <Card className="p-6">
          <div className="space-y-1 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-muted rounded">
                <Palette className="h-4 w-4 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Cores</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primary">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primary"
                  type="color"
                  value={colors.primary}
                  onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                  className="h-12 w-20"
                />
                <Input
                  type="text"
                  value={colors.primary}
                  onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary">Cor de fundo do cabeçalho</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary"
                  type="color"
                  value={colors.secondary}
                  onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                  className="h-12 w-20"
                />
                <Input
                  type="text"
                  value={colors.secondary}
                  onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="background">Cor dos textos do cabeçalho</Label>
              <div className="flex gap-2">
                <Input
                  id="background"
                  type="color"
                  value={colors.background}
                  onChange={(e) => setColors({ ...colors, background: e.target.value })}
                  className="h-12 w-20"
                />
                <Input
                  type="text"
                  value={colors.background}
                  onChange={(e) => setColors({ ...colors, background: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Top Bar Configuration */}
        <TopBarConfigSection
          userId={userId}
          primaryColor={colors.primary}
        />

        {/* Logo */}
        <Card className="p-6">
          <div className="space-y-1 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-muted rounded">
                <Image className="h-4 w-4 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Logo</h2>
            </div>
          </div>
          <div className="space-y-6">
            {logoUrl ? (
              <div className="space-y-4">
                <div className="border-2 rounded-lg p-4 flex items-center justify-between bg-muted/20">
                  <img src={logoUrl} alt="Logo da loja" className="h-16 object-contain" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveLogo}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ) : null}
            
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-shrink-0">
                <label htmlFor="logo-upload">
                  <Button 
                    variant="outline" 
                    disabled={uploading} 
                    asChild
                    className="transition-all"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = SD_PRIMARY;
                      e.currentTarget.style.borderColor = SD_PRIMARY;
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '';
                      e.currentTarget.style.borderColor = '';
                      e.currentTarget.style.color = '';
                    }}
                  >
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? "Enviando..." : "Escolher Imagem"}
                    </span>
                  </Button>
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1 flex-1">
                <p className="font-medium text-foreground">Formato recomendado: PNG com fundo transparente</p>
                <p className="font-medium">Tamanho recomendado para Header: 250×80 px</p>
                <p className="font-medium">Tamanho máximo: 200 KB</p>
              </div>
            </div>

            {/* Logo Position Control */}
            <div className="border-t pt-6">
              <Label className="text-base font-medium mb-3 block">Posição da Logo no Cabeçalho</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setHeaderLogoPosition("left")}
                  className={`border rounded-md p-3 text-center transition-all flex flex-col items-center gap-2 ${
                    headerLogoPosition === "left" 
                      ? 'border-transparent font-semibold' 
                      : 'border-input'
                  }`}
                  style={{ 
                    ...(headerLogoPosition === "left" && {
                      backgroundColor: SD_PRIMARY_BG,
                      color: SD_PRIMARY
                    }),
                    ...(headerLogoPosition !== "left" && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (headerLogoPosition !== "left") {
                      e.currentTarget.style.borderColor = SD_PRIMARY_HOVER;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (headerLogoPosition !== "left") {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="flex items-center gap-1 w-full">
                    <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: headerLogoPosition === "left" ? SD_PRIMARY : '#9ca3af' }} />
                    <div className="flex-1 h-2 bg-muted rounded" />
                    <div className="w-6 h-2 bg-muted rounded" />
                  </div>
                  <span className="text-sm">Esquerda</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeaderLogoPosition("center")}
                  className={`border rounded-md p-3 text-center transition-all flex flex-col items-center gap-2 ${
                    headerLogoPosition === "center" 
                      ? 'border-transparent font-semibold' 
                      : 'border-input'
                  }`}
                  style={{ 
                    ...(headerLogoPosition === "center" && {
                      backgroundColor: SD_PRIMARY_BG,
                      color: SD_PRIMARY
                    }),
                    ...(headerLogoPosition !== "center" && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (headerLogoPosition !== "center") {
                      e.currentTarget.style.borderColor = SD_PRIMARY_HOVER;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (headerLogoPosition !== "center") {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="flex items-center gap-1 w-full">
                    <div className="w-6 h-2 bg-muted rounded" />
                    <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: headerLogoPosition === "center" ? SD_PRIMARY : '#9ca3af' }} />
                    <div className="w-6 h-2 bg-muted rounded" />
                  </div>
                  <span className="text-sm">Centralizada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeaderLogoPosition("right")}
                  className={`border rounded-md p-3 text-center transition-all flex flex-col items-center gap-2 ${
                    headerLogoPosition === "right" 
                      ? 'border-transparent font-semibold' 
                      : 'border-input'
                  }`}
                  style={{ 
                    ...(headerLogoPosition === "right" && {
                      backgroundColor: SD_PRIMARY_BG,
                      color: SD_PRIMARY
                    }),
                    ...(headerLogoPosition !== "right" && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (headerLogoPosition !== "right") {
                      e.currentTarget.style.borderColor = SD_PRIMARY_HOVER;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (headerLogoPosition !== "right") {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="flex items-center gap-1 w-full">
                    <div className="w-6 h-2 bg-muted rounded" />
                    <div className="flex-1 h-2 bg-muted rounded" />
                    <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: headerLogoPosition === "right" ? SD_PRIMARY : '#9ca3af' }} />
                  </div>
                  <span className="text-sm">Direita</span>
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* AI Palette Section */}
        <AIPaletteSection 
          currentColors={colors}
          buttonBgColor={buttonBgColor}
          buttonTextColor={buttonTextColor}
          userId={userId}
          onApplyPalette={(newColors) => {
            setColors(prev => ({
              ...prev,
              primary: newColors.primary || prev.primary,
              secondary: newColors.secondary || prev.secondary,
              background: newColors.background || prev.background,
            }));
            if (newColors.buttonBg) setButtonBgColor(newColors.buttonBg);
            if (newColors.buttonText) setButtonTextColor(newColors.buttonText);
          }}
        />

        {/* Store Layout Selector */}
        <StoreLayoutSelector userId={userId} />

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            className="transition-all"
            style={{ backgroundColor: SD_PRIMARY, color: '#FFFFFF' }}
          >
            Salvar Alterações
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Customize;
