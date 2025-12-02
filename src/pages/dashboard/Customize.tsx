import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Upload } from "lucide-react";

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
        .select("store_logo_url, primary_color, secondary_color, footer_text_color, font_family, font_weight, product_image_format, product_border_style, product_text_alignment, product_button_display, button_border_style, button_bg_color, button_text_color")
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
          button_text_color: buttonTextColor
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
        <div className="max-w-4xl space-y-6">
          <p>Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        {/* Colors */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Cores</h2>
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

        {/* Logo */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Logo</h2>
          <div className="space-y-4">
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
                  <Button variant="outline" disabled={uploading} asChild>
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
          </div>
        </Card>

        {/* Typography */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Tipografia</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Fonte Principal */}
            <div className="space-y-2">
              <Label htmlFor="font">Fonte Principal</Label>
              <select 
                id="font"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="Inter" style={{ fontFamily: 'Inter' }}>Inter</option>
                <option value="Roboto" style={{ fontFamily: 'Roboto' }}>Roboto</option>
                <option value="Open Sans" style={{ fontFamily: 'Open Sans' }}>Open Sans</option>
                <option value="Poppins" style={{ fontFamily: 'Poppins' }}>Poppins</option>
                <option value="Montserrat" style={{ fontFamily: 'Montserrat' }}>Montserrat</option>
              </select>
            </div>

            {/* Peso da Fonte */}
            <div className="space-y-2">
              <Label>Peso da Fonte</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFontWeight(300)}
                  className={`border rounded-md p-3 text-center transition-all ${
                    fontWeight === 300 
                      ? 'border-transparent font-semibold' 
                      : 'border-input'
                  }`}
                  style={{ 
                    fontWeight: 300,
                    ...(fontWeight === 300 && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(fontWeight !== 300 && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (fontWeight !== 300) {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (fontWeight !== 300) {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  Fina
                </button>
                <button
                  type="button"
                  onClick={() => setFontWeight(500)}
                  className={`border rounded-md p-3 text-center transition-all ${
                    fontWeight === 500 
                      ? 'border-transparent font-semibold' 
                      : 'border-input'
                  }`}
                  style={{ 
                    fontWeight: 500,
                    ...(fontWeight === 500 && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(fontWeight !== 500 && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (fontWeight !== 500) {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (fontWeight !== 500) {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  Média
                </button>
                <button
                  type="button"
                  onClick={() => setFontWeight(700)}
                  className={`border rounded-md p-3 text-center transition-all ${
                    fontWeight === 700 
                      ? 'border-transparent font-semibold' 
                      : 'border-input'
                  }`}
                  style={{ 
                    fontWeight: 700,
                    ...(fontWeight === 700 && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(fontWeight !== 700 && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (fontWeight !== 700) {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (fontWeight !== 700) {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  Grossa
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Product Designer */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Designer dos Produtos</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Image Format */}
            <div className="space-y-2">
              <Label>Formato das Imagens</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProductImageFormat('square')}
                  className={`border rounded-md p-4 text-center transition-all flex flex-col items-center gap-3 ${
                    productImageFormat === 'square' 
                      ? 'border-transparent' 
                      : 'border-input'
                  }`}
                  style={{
                    ...(productImageFormat === 'square' && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(productImageFormat !== 'square' && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (productImageFormat !== 'square') {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (productImageFormat !== 'square') {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="flex flex-col gap-2 items-center">
                    <div className="w-16 h-16 border-2" style={{ borderColor: productImageFormat === 'square' ? colors.primary : '#ccc' }} />
                    <div className="space-y-1 w-16">
                      <div className="h-2 bg-muted rounded" style={{ width: '100%' }} />
                      <div className="h-2 bg-muted rounded" style={{ width: '70%' }} />
                    </div>
                  </div>
                  <span className="font-medium">Quadrada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductImageFormat('rectangular')}
                  className={`border rounded-md p-4 text-center transition-all flex flex-col items-center gap-3 ${
                    productImageFormat === 'rectangular' 
                      ? 'border-transparent' 
                      : 'border-input'
                  }`}
                  style={{
                    ...(productImageFormat === 'rectangular' && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(productImageFormat !== 'rectangular' && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (productImageFormat !== 'rectangular') {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (productImageFormat !== 'rectangular') {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="flex flex-col gap-2 items-center">
                    <div className="w-12 h-16 border-2" style={{ borderColor: productImageFormat === 'rectangular' ? colors.primary : '#ccc' }} />
                    <div className="space-y-1 w-12">
                      <div className="h-2 bg-muted rounded" style={{ width: '100%' }} />
                      <div className="h-2 bg-muted rounded" style={{ width: '70%' }} />
                    </div>
                  </div>
                  <span className="font-medium">Retangular</span>
                </button>
              </div>
            </div>

            {/* Border Style and Button Display - Two Column Layout */}
            <div className="space-y-2">
              <Label>Estilo das Bordas</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProductBorderStyle('straight')}
                  className={`border rounded-md p-4 text-center transition-all flex flex-col items-center gap-3 ${
                    productBorderStyle === 'straight' 
                      ? 'border-transparent' 
                      : 'border-input'
                  }`}
                  style={{
                    ...(productBorderStyle === 'straight' && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(productBorderStyle !== 'straight' && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (productBorderStyle !== 'straight') {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (productBorderStyle !== 'straight') {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="w-12 h-12 border-2" style={{ borderColor: productBorderStyle === 'straight' ? colors.primary : '#ccc', borderRadius: '0' }} />
                  <span className="font-medium">Retas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductBorderStyle('rounded')}
                  className={`border rounded-md p-4 text-center transition-all flex flex-col items-center gap-3 ${
                    productBorderStyle === 'rounded' 
                      ? 'border-transparent' 
                      : 'border-input'
                  }`}
                  style={{
                    ...(productBorderStyle === 'rounded' && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(productBorderStyle !== 'rounded' && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (productBorderStyle !== 'rounded') {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (productBorderStyle !== 'rounded') {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="w-12 h-12 border-2" style={{ borderColor: productBorderStyle === 'rounded' ? colors.primary : '#ccc', borderRadius: '8px' }} />
                  <span className="font-medium">Arredondadas</span>
                </button>
              </div>
            </div>

            {/* Button Display */}
            <div className="space-y-2">
              <Label>Botão de Comprar</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProductButtonDisplay('below')}
                  className={`border rounded-md p-4 text-center transition-all flex flex-col items-center justify-center gap-3 ${
                    productButtonDisplay === 'below' 
                      ? 'border-transparent' 
                      : 'border-input'
                  }`}
                  style={{
                    ...(productButtonDisplay === 'below' && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(productButtonDisplay !== 'below' && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (productButtonDisplay !== 'below') {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (productButtonDisplay !== 'below') {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <span className="font-medium text-center">Abaixo do produto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductButtonDisplay('none')}
                  className={`border rounded-md p-4 text-center transition-all flex flex-col items-center justify-center gap-3 ${
                    productButtonDisplay === 'none' 
                      ? 'border-transparent' 
                      : 'border-input'
                  }`}
                  style={{
                    ...(productButtonDisplay === 'none' && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(productButtonDisplay !== 'none' && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (productButtonDisplay !== 'none') {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (productButtonDisplay !== 'none') {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <span className="font-medium text-center">Sem botão</span>
                </button>
              </div>
            </div>

            {/* Text Alignment */}
            <div className="space-y-2">
              <Label>Alinhamento do Texto</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProductTextAlignment('left')}
                  className={`border rounded-md p-4 text-center transition-all flex flex-col items-center gap-3 ${
                    productTextAlignment === 'left' 
                      ? 'border-transparent' 
                      : 'border-input'
                  }`}
                  style={{
                    ...(productTextAlignment === 'left' && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(productTextAlignment !== 'left' && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (productTextAlignment !== 'left') {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (productTextAlignment !== 'left') {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="w-12 h-16 border-2" style={{ borderColor: productTextAlignment === 'left' ? colors.primary : '#ccc' }} />
                  <div className="flex flex-col gap-2 items-start" style={{ width: '48px' }}>
                    <div className="h-2 bg-muted rounded" style={{ width: '100%' }} />
                    <div className="h-2 bg-muted rounded" style={{ width: '75%' }} />
                  </div>
                  <span className="font-medium">Esquerda</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductTextAlignment('center')}
                  className={`border rounded-md p-4 text-center transition-all flex flex-col items-center gap-3 ${
                    productTextAlignment === 'center' 
                      ? 'border-transparent' 
                      : 'border-input'
                  }`}
                  style={{
                    ...(productTextAlignment === 'center' && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(productTextAlignment !== 'center' && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (productTextAlignment !== 'center') {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (productTextAlignment !== 'center') {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="w-12 h-16 border-2" style={{ borderColor: productTextAlignment === 'center' ? colors.primary : '#ccc' }} />
                  <div className="flex flex-col gap-2 items-center" style={{ width: '48px' }}>
                    <div className="h-2 bg-muted rounded" style={{ width: '100%' }} />
                    <div className="h-2 bg-muted rounded" style={{ width: '75%' }} />
                  </div>
                  <span className="font-medium">Centro</span>
                </button>
              </div>
            </div>

            {/* Button Border Style */}
            <div className="space-y-2">
              <Label>Estilo dos Botões</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setButtonBorderStyle('rounded')}
                  className={`border rounded-md p-4 text-center transition-all flex flex-col items-center justify-center gap-3 ${
                    buttonBorderStyle === 'rounded' 
                      ? 'border-transparent' 
                      : 'border-input'
                  }`}
                  style={{
                    ...(buttonBorderStyle === 'rounded' && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(buttonBorderStyle !== 'rounded' && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (buttonBorderStyle !== 'rounded') {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (buttonBorderStyle !== 'rounded') {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="w-16 h-8 border-2 rounded-lg" style={{ borderColor: buttonBorderStyle === 'rounded' ? colors.primary : '#ccc' }} />
                  <span className="font-medium">Arredondada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setButtonBorderStyle('straight')}
                  className={`border rounded-md p-4 text-center transition-all flex flex-col items-center justify-center gap-3 ${
                    buttonBorderStyle === 'straight' 
                      ? 'border-transparent' 
                      : 'border-input'
                  }`}
                  style={{
                    ...(buttonBorderStyle === 'straight' && {
                      backgroundColor: `${colors.primary}40`,
                      color: colors.primary
                    }),
                    ...(buttonBorderStyle !== 'straight' && {
                      borderColor: 'hsl(var(--input))'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (buttonBorderStyle !== 'straight') {
                      e.currentTarget.style.borderColor = `${colors.primary}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (buttonBorderStyle !== 'straight') {
                      e.currentTarget.style.borderColor = 'hsl(var(--input))';
                    }
                  }}
                >
                  <div className="w-16 h-8 border-2" style={{ borderColor: buttonBorderStyle === 'straight' ? colors.primary : '#ccc' }} />
                  <span className="font-medium">Reta</span>
                </button>
              </div>
            </div>

            {/* Button Colors */}
            <div className="space-y-2">
              <Label>Cor dos Botões</Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Cor de Fundo</span>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={buttonBgColor}
                      onChange={(e) => setButtonBgColor(e.target.value)}
                      className="h-12 w-20"
                    />
                    <Input
                      type="text"
                      value={buttonBgColor}
                      onChange={(e) => setButtonBgColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Cor do Texto</span>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={buttonTextColor}
                      onChange={(e) => setButtonTextColor(e.target.value)}
                      className="h-12 w-20"
                    />
                    <Input
                      type="text"
                      value={buttonTextColor}
                      onChange={(e) => setButtonTextColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            className="px-8 transition-all hover:opacity-90"
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
          >
            Salvar Alterações
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Customize;