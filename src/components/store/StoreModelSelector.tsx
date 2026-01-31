import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ShoppingCart, BookOpen, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type StoreModelType = "loja_virtual" | "catalogo_digital";

interface StoreModelOption {
  id: StoreModelType;
  name: string;
  description: string;
  icon: typeof ShoppingCart;
}

const storeModelOptions: StoreModelOption[] = [
  {
    id: "loja_virtual",
    name: "Loja Virtual",
    description: "Layout completo com banners, carrosséis de produtos, vídeo e todos os módulos ativos. Ideal para e-commerce tradicional.",
    icon: ShoppingCart,
  },
  {
    id: "catalogo_digital",
    name: "Catálogo Digital",
    description: "Layout simplificado focado na listagem de produtos. Sem banners, carrosséis ou vídeo. Ideal para consulta de preços.",
    icon: BookOpen,
  },
];

interface StoreModelSelectorProps {
  userId: string | null;
  primaryColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
}

export const StoreModelSelector = ({
  userId,
  primaryColor,
  buttonBgColor,
  buttonTextColor,
}: StoreModelSelectorProps) => {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<StoreModelType>("loja_virtual");
  const [savedModel, setSavedModel] = useState<StoreModelType>("loja_virtual");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchCurrentModel();
    }
  }, [userId]);

  const fetchCurrentModel = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("store_model")
        .eq("id", userId)
        .single();

      if (error) throw error;

      if (data?.store_model) {
        const model = data.store_model as StoreModelType;
        setSelectedModel(model);
        setSavedModel(model);
      }
    } catch (error) {
      console.error("Erro ao carregar modelo:", error);
    }
  };

  const handleSaveModel = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ store_model: selectedModel })
        .eq("id", userId);

      if (error) throw error;

      setSavedModel(selectedModel);
      toast({
        title: "Modelo salvo!",
        description: "O modelo da sua loja foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao salvar modelo:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o modelo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selectedModel !== savedModel;

  return (
    <Card className="p-6">
      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
            <BookOpen className="h-4 w-4 text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Modelo de Loja</h2>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          Escolha como sua loja será exibida para os clientes.
        </p>
      </div>

      <div className="space-y-4">
        {/* Model Options */}
        <div className="grid md:grid-cols-2 gap-4">
          {storeModelOptions.map((model) => {
            const isSelected = selectedModel === model.id;
            const isSaved = savedModel === model.id;
            const Icon = model.icon;

            return (
              <button
                key={model.id}
                type="button"
                onClick={() => setSelectedModel(model.id)}
                className={`w-full text-left border rounded-lg p-5 transition-all relative ${
                  isSelected ? "border-2" : "border hover:border-gray-300"
                }`}
                style={{
                  borderColor: isSelected ? primaryColor : undefined,
                  backgroundColor: isSelected ? `${primaryColor}08` : undefined,
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0"
                    style={{
                      backgroundColor: isSelected ? `${primaryColor}15` : "#f3f4f6",
                      color: isSelected ? primaryColor : "#6b7280",
                    }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{model.name}</span>
                      {model.id === "loja_virtual" && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded uppercase font-medium"
                          style={{
                            backgroundColor: `${primaryColor}20`,
                            color: primaryColor,
                          }}
                        >
                          Padrão
                        </span>
                      )}
                      {isSaved && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 uppercase font-medium">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      {model.description}
                    </p>
                  </div>

                  {isSelected && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Alert */}
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700 text-sm">
            O modelo escolhido altera o layout e o comportamento da loja online. O checkout permanece ativo em ambos os modelos.
          </AlertDescription>
        </Alert>

        {/* Save Button */}
        <div className="pt-2">
          <Button
            onClick={handleSaveModel}
            disabled={!hasChanges || saving}
            className="w-full sm:w-auto transition-all"
            style={{
              backgroundColor: hasChanges ? buttonBgColor : undefined,
              color: hasChanges ? buttonTextColor : undefined,
            }}
          >
            {saving ? "Salvando..." : hasChanges ? "Salvar modelo" : "Modelo salvo"}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default StoreModelSelector;
