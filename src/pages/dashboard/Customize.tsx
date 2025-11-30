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
        .select("store_logo_url, primary_color, secondary_color, footer_text_color, font_family, font_weight")
        .eq("id", user.id)
        .single();

      if (profile) {
        setLogoUrl(profile.store_logo_url);
        if (profile.primary_color) setColors(prev => ({ ...prev, primary: profile.primary_color }));
        if (profile.secondary_color) setColors(prev => ({ ...prev, secondary: profile.secondary_color }));
        if (profile.footer_text_color) setColors(prev => ({ ...prev, background: profile.footer_text_color }));
        if (profile.font_family) setFontFamily(profile.font_family);
        if (profile.font_weight) setFontWeight(profile.font_weight);
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
          font_weight: fontWeight
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
                      ? 'border-primary bg-primary/10 text-primary font-semibold' 
                      : 'border-input hover:border-primary/50'
                  }`}
                  style={{ fontWeight: 300 }}
                >
                  Fina
                </button>
                <button
                  type="button"
                  onClick={() => setFontWeight(500)}
                  className={`border rounded-md p-3 text-center transition-all ${
                    fontWeight === 500 
                      ? 'border-primary bg-primary/10 text-primary font-semibold' 
                      : 'border-input hover:border-primary/50'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  Média
                </button>
                <button
                  type="button"
                  onClick={() => setFontWeight(700)}
                  className={`border rounded-md p-3 text-center transition-all ${
                    fontWeight === 700 
                      ? 'border-primary bg-primary/10 text-primary font-semibold' 
                      : 'border-input hover:border-primary/50'
                  }`}
                  style={{ fontWeight: 700 }}
                >
                  Grossa
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            className="bg-secondary hover:bg-secondary/90 px-8"
          >
            Salvar Alterações
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Customize;