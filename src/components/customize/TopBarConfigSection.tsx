import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TopBarConfig {
  enabled: boolean;
  bgColor: string;
  textColor: string;
  text: string;
  linkType: "none" | "content_page" | "category" | "sale" | "section" | "external";
  linkTarget: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface TopBarConfigSectionProps {
  userId: string | null;
  primaryColor: string;
  onConfigChange?: (config: TopBarConfig) => void;
}

export const TopBarConfigSection = ({
  userId,
  primaryColor,
  onConfigChange,
}: TopBarConfigSectionProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [config, setConfig] = useState<TopBarConfig>({
    enabled: false,
    bgColor: "#000000",
    textColor: "#FFFFFF",
    text: "",
    linkType: "none",
    linkTarget: null,
  });

  useEffect(() => {
    if (userId) {
      fetchConfig();
      fetchCategories();
    }
  }, [userId]);

  const fetchConfig = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("topbar_enabled, topbar_bg_color, topbar_text_color, topbar_text, topbar_link_type, topbar_link_target")
        .eq("id", userId)
        .single();

      if (error) throw error;

      if (data) {
        const newConfig: TopBarConfig = {
          enabled: data.topbar_enabled ?? false,
          bgColor: data.topbar_bg_color ?? "#000000",
          textColor: data.topbar_text_color ?? "#FFFFFF",
          text: data.topbar_text ?? "",
          linkType: (data.topbar_link_type as TopBarConfig["linkType"]) ?? "none",
          linkTarget: data.topbar_link_target ?? null,
        };
        setConfig(newConfig);
      }
    } catch (error) {
      console.error("Erro ao carregar configuração do Top Bar:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!userId) return;

    try {
      const { data } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("user_id", userId);

      if (data) setCategories(data);
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          topbar_enabled: config.enabled,
          topbar_bg_color: config.bgColor,
          topbar_text_color: config.textColor,
          topbar_text: config.text,
          topbar_link_type: config.linkType,
          topbar_link_target: config.linkTarget,
        })
        .eq("id", userId);

      if (error) throw error;

      onConfigChange?.(config);

      toast({
        title: "Configuração salva!",
        description: "O Top Bar foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<TopBarConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  // Auto-calculate text color based on background for contrast
  const autoTextColor = (bgColor: string): string => {
    const hex = bgColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded">
            <Megaphone className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Configuração do Top Bar</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Adicione uma barra de destaque acima do cabeçalho da sua loja
        </p>
      </div>

      <div className="space-y-6">
        {/* Toggle de Ativação */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="topbar-enabled" className="text-base">Ativar Top Bar</Label>
            <p className="text-sm text-muted-foreground">
              Exibe uma barra de destaque acima do cabeçalho
            </p>
          </div>
          <Switch
            id="topbar-enabled"
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig({ enabled: checked })}
          />
        </div>

        {config.enabled && (
          <>
            {/* Texto do Top Bar */}
            <div className="space-y-2">
              <Label htmlFor="topbar-text">Texto do Top Bar</Label>
              <Input
                id="topbar-text"
                value={config.text}
                onChange={(e) => updateConfig({ text: e.target.value })}
                placeholder="Ex.: ACEITAMOS PIX • FRETE GRÁTIS acima de R$ 100"
                className="w-full"
              />
            </div>

            {/* Cores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="topbar-bg-color">Cor de Fundo</Label>
                <div className="flex gap-2">
                  <Input
                    id="topbar-bg-color"
                    type="color"
                    value={config.bgColor}
                    onChange={(e) => {
                      const newBgColor = e.target.value;
                      updateConfig({
                        bgColor: newBgColor,
                        textColor: autoTextColor(newBgColor),
                      });
                    }}
                    className="h-10 w-16 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={config.bgColor}
                    onChange={(e) => updateConfig({ bgColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topbar-text-color">Cor do Texto</Label>
                <div className="flex gap-2">
                  <Input
                    id="topbar-text-color"
                    type="color"
                    value={config.textColor}
                    onChange={(e) => updateConfig({ textColor: e.target.value })}
                    className="h-10 w-16 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={config.textColor}
                    onChange={(e) => updateConfig({ textColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Pré-visualização</Label>
              <div
                className="w-full h-10 rounded flex items-center justify-center text-sm font-medium"
                style={{
                  backgroundColor: config.bgColor,
                  color: config.textColor,
                }}
              >
                {config.text || "Texto do Top Bar aparecerá aqui"}
              </div>
            </div>

            {/* Vínculo/Link */}
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="topbar-link-type">Vínculo ao Clicar</Label>
                <Select
                  value={config.linkType}
                  onValueChange={(value: TopBarConfig["linkType"]) => 
                    updateConfig({ linkType: value, linkTarget: null })
                  }
                >
                  <SelectTrigger id="topbar-link-type">
                    <SelectValue placeholder="Selecione o tipo de vínculo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (apenas informativo)</SelectItem>
                    <SelectItem value="content_page">Página de Conteúdo</SelectItem>
                    <SelectItem value="category">Categoria / Coleção</SelectItem>
                    <SelectItem value="sale">Produtos em Promoção</SelectItem>
                    <SelectItem value="section">Seção da Home</SelectItem>
                    <SelectItem value="external">URL Externa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campos condicionais */}
              {config.linkType === "content_page" && (
                <div className="space-y-2">
                  <Label htmlFor="topbar-page">Página de Destino</Label>
                  <Select
                    value={config.linkTarget || ""}
                    onValueChange={(value) => updateConfig({ linkTarget: value })}
                  >
                    <SelectTrigger id="topbar-page">
                      <SelectValue placeholder="Selecione uma página" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sobre">Sobre Nós</SelectItem>
                      <SelectItem value="trocas">Trocas e Devoluções</SelectItem>
                      <SelectItem value="contato">Contato</SelectItem>
                      <SelectItem value="termos">Termos de Uso</SelectItem>
                      <SelectItem value="privacidade">Privacidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.linkType === "category" && (
                <div className="space-y-2">
                  <Label htmlFor="topbar-category">Categoria</Label>
                  <Select
                    value={config.linkTarget || ""}
                    onValueChange={(value) => updateConfig({ linkTarget: value })}
                  >
                    <SelectTrigger id="topbar-category">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.linkType === "section" && (
                <div className="space-y-2">
                  <Label htmlFor="topbar-section">Seção</Label>
                  <Select
                    value={config.linkTarget || ""}
                    onValueChange={(value) => updateConfig({ linkTarget: value })}
                  >
                    <SelectTrigger id="topbar-section">
                      <SelectValue placeholder="Selecione uma seção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="destaques">Destaques</SelectItem>
                      <SelectItem value="novidades">Novidades</SelectItem>
                      <SelectItem value="todos-produtos">Todos os Produtos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.linkType === "external" && (
                <div className="space-y-2">
                  <Label htmlFor="topbar-url">URL Externa</Label>
                  <Input
                    id="topbar-url"
                    type="url"
                    value={config.linkTarget || ""}
                    onChange={(e) => updateConfig({ linkTarget: e.target.value })}
                    placeholder="https://exemplo.com"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Botão Salvar */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Configuração
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default TopBarConfigSection;
