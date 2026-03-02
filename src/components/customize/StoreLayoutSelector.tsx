import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { StoreLayoutPreview } from "./StoreLayoutPreview";

export type StoreLayoutType = "layout_01" | "layout_02" | "layout_03";

// Fixed ShopDrive admin colors
const SD_PRIMARY = "#6A1B9A";
const SD_PRIMARY_BG = "#6A1B9A08";
const SD_PRIMARY_BADGE_BG = "#6A1B9A20";

interface LayoutOption {
  id: StoreLayoutType;
  name: string;
  description: string;
  profile: string;
}

const layoutOptions: LayoutOption[] = [
  {
    id: "layout_01",
    name: "Clássico",
    description: "Layout padrão, equilibrado e seguro. Ideal para lojistas iniciantes.",
    profile: "Padrão"
  },
  {
    id: "layout_02",
    name: "Conversão",
    description: "Foco em vendas rápidas. Promoções aparecem primeiro para incentivar compras.",
    profile: "Vendas"
  },
  {
    id: "layout_03",
    name: "Marca & Conteúdo",
    description: "Storytelling e autoridade da marca. Vídeo e conteúdo visual em destaque.",
    profile: "Branding"
  }
];

interface StoreLayoutSelectorProps {
  userId: string | null;
}

export const StoreLayoutSelector = ({ 
  userId, 
}: StoreLayoutSelectorProps) => {
  const { toast } = useToast();
  const [selectedLayout, setSelectedLayout] = useState<StoreLayoutType>("layout_01");
  const [savedLayout, setSavedLayout] = useState<StoreLayoutType>("layout_01");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchCurrentLayout();
    }
  }, [userId]);

  const fetchCurrentLayout = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("store_layout")
        .eq("id", userId)
        .single();
      
      if (error) throw error;
      
      if (data?.store_layout) {
        const layout = data.store_layout as StoreLayoutType;
        setSelectedLayout(layout);
        setSavedLayout(layout);
      }
    } catch (error) {
      console.error("Erro ao carregar layout:", error);
    }
  };

  const handleSaveLayout = async () => {
    if (!userId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ store_layout: selectedLayout })
        .eq("id", userId);
      
      if (error) throw error;
      
      setSavedLayout(selectedLayout);
      toast({
        title: "Layout salvo!",
        description: "O layout da sua loja foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao salvar layout:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o layout. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selectedLayout !== savedLayout;

  return (
    <Card className="p-6">
      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
            <LayoutGrid className="h-4 w-4 text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Escolha o layout da sua loja</h2>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          Escolha como os módulos da sua loja serão organizados visualmente. 
          Esta alteração muda apenas o layout da página, sem impactar seus produtos, pedidos ou configurações.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Layout Options */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground mb-4">Selecione um layout:</p>
          
          {layoutOptions.map((layout) => {
            const isSelected = selectedLayout === layout.id;
            const isSaved = savedLayout === layout.id;
            
            return (
              <button
                key={layout.id}
                type="button"
                onClick={() => setSelectedLayout(layout.id)}
                className={`w-full text-left border rounded-lg p-4 transition-all relative ${
                  isSelected 
                    ? 'border-2' 
                    : 'border hover:border-gray-300'
                }`}
                style={{
                  borderColor: isSelected ? SD_PRIMARY : undefined,
                  backgroundColor: isSelected ? SD_PRIMARY_BG : undefined
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{layout.name}</span>
                      <span 
                        className="text-[10px] px-1.5 py-0.5 rounded uppercase font-medium"
                        style={{ 
                          backgroundColor: SD_PRIMARY_BADGE_BG,
                          color: SD_PRIMARY
                        }}
                      >
                        {layout.profile}
                      </span>
                      {isSaved && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 uppercase font-medium">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{layout.description}</p>
                  </div>
                  
                  {isSelected && (
                    <div 
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: SD_PRIMARY }}
                    >
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Save Button */}
          <div className="pt-4">
            <Button
              onClick={handleSaveLayout}
              disabled={!hasChanges || saving}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Salvando..." : hasChanges ? "Salvar layout" : "Layout salvo"}
            </Button>
          </div>
        </div>

        {/* Layout Preview */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground mb-4">Pré-visualização:</p>
          <div className="flex items-center justify-center min-h-[400px]">
            <StoreLayoutPreview 
              layoutType={selectedLayout} 
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StoreLayoutSelector;
