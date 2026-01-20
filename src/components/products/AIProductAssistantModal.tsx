import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, RefreshCw, ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface AIProductAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCategory?: string;
  currentProductName?: string;
  productId?: string;
  generateTitle?: boolean;
  onApply: (result: { title?: string; description: string }) => void;
}

interface AIGenerationResult {
  title_suggested?: string;
  description_long: string;
}

type Step = 1 | 2 | 3;

const PRODUCT_TYPES = [
  { value: "cosmetico", label: "Cosmético" },
  { value: "alimento", label: "Alimento" },
  { value: "moda", label: "Moda" },
  { value: "eletronico", label: "Eletrônico" },
  { value: "casa", label: "Casa e Decoração" },
  { value: "servico", label: "Serviço" },
  { value: "outros", label: "Outros" },
];

const TONE_OPTIONS = [
  { value: "neutral", label: "Neutro profissional" },
  { value: "persuasive", label: "Vendas persuasivo" },
  { value: "simple", label: "Simples e direto" },
  { value: "premium", label: "Premium sofisticado" },
];

const CHANNEL_OPTIONS = [
  { value: "loja_vm", label: "Loja VM" },
  { value: "instagram", label: "Instagram" },
  { value: "marketplace", label: "Marketplace" },
  { value: "catalogo", label: "Catálogo PDF" },
];

export const AIProductAssistantModal = ({
  open,
  onOpenChange,
  currentCategory,
  currentProductName,
  productId,
  generateTitle = false,
  onApply,
}: AIProductAssistantModalProps) => {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIGenerationResult | null>(null);
  const { toast } = useToast();
  const { buttonBgColor, buttonTextColor, buttonBorderStyle } = useTheme();
  
  const buttonRadius = buttonBorderStyle === 'rounded' ? 'rounded-full' : 'rounded-none';

  // Step 1 fields
  const [category, setCategory] = useState(currentCategory || "");
  const [productType, setProductType] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [differentiators, setDifferentiators] = useState("");
  const [tone, setTone] = useState("neutral");
  const [channel, setChannel] = useState("loja_vm");

  // Step 2 fields (optional)
  const [benefits, setBenefits] = useState("");
  const [materials, setMaterials] = useState("");
  const [usageInstructions, setUsageInstructions] = useState("");
  const [variationsInfo, setVariationsInfo] = useState("");
  const [warrantyInfo, setWarrantyInfo] = useState("");

  const resetForm = () => {
    setStep(1);
    setResult(null);
    setCategory(currentCategory || "");
    setProductType("");
    setTargetAudience("");
    setDifferentiators("");
    setTone("neutral");
    setChannel("loja_vm");
    setBenefits("");
    setMaterials("");
    setUsageInstructions("");
    setVariationsInfo("");
    setWarrantyInfo("");
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para usar o assistente de IA",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke("ai-product-writer", {
        body: {
          product_id: productId,
          category,
          product_type: productType,
          target_audience: targetAudience,
          differentiators,
          tone,
          channel,
          benefits,
          materials,
          usage_instructions: usageInstructions,
          variations_info: variationsInfo,
          warranty_info: warrantyInfo,
          generate_title: generateTitle,
          existing_name: currentProductName,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao gerar conteúdo");
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setResult(response.data);
      setStep(3);
    } catch (error) {
      console.error("AI generation error:", error);
      toast({
        title: "Erro na geração",
        description: error instanceof Error 
          ? error.message 
          : "Não foi possível gerar o texto agora. Você pode tentar novamente ou escrever manualmente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply({
        title: result.title_suggested,
        description: result.description_long,
      });
      onOpenChange(false);
      resetForm();
      toast({
        title: "Sucesso",
        description: "Conteúdo aplicado ao produto",
      });
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: "Texto copiado para a área de transferência",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o texto",
        variant: "destructive",
      });
    }
  };

  const handleRegenerate = () => {
    setStep(2);
    setResult(null);
  };

  const canProceedToStep2 = tone && channel;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente IA de Produto
          </DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition-colors ${
                step >= s ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Quick data */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">
              Etapa 1 de 3: Dados rápidos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria do produto</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Roupas femininas"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de produto</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Público-alvo</Label>
                <Input
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Ex: Mulheres 25-45 anos"
                />
              </div>

              <div className="space-y-2">
                <Label>Diferenciais do produto</Label>
                <Input
                  value={differentiators}
                  onChange={(e) => setDifferentiators(e.target.value)}
                  placeholder="Ex: 100% algodão, fabricação nacional"
                />
              </div>

              <div className="space-y-2">
                <Label>Tom do texto *</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tom" />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Canal do conteúdo *</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className={buttonRadius}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2}
                className={`gap-2 ${buttonRadius}`}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Product details (optional) */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">
              Etapa 2 de 3: Detalhes do produto (opcional)
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Benefícios principais</Label>
                <Textarea
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  placeholder="Ex: Conforto térmico, durabilidade, fácil lavagem"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Materiais / Ingredientes</Label>
                <Textarea
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="Ex: 95% algodão, 5% elastano"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Modo de uso / Funcionamento</Label>
                <Textarea
                  value={usageInstructions}
                  onChange={(e) => setUsageInstructions(e.target.value)}
                  placeholder="Ex: Lavar à máquina em água fria"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Variações (tamanho, cor, voltagem, etc.)</Label>
                <Input
                  value={variationsInfo}
                  onChange={(e) => setVariationsInfo(e.target.value)}
                  placeholder="Ex: P, M, G, GG | Cores: preto, branco, azul"
                />
              </div>

              <div className="space-y-2">
                <Label>Garantia / Informações adicionais</Label>
                <Textarea
                  value={warrantyInfo}
                  onChange={(e) => setWarrantyInfo(e.target.value)}
                  placeholder="Ex: Garantia de 90 dias contra defeitos de fabricação"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className={`gap-2 ${buttonRadius}`}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={loading}
                className={`gap-2 ${buttonRadius}`}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar agora
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && result && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">
              Etapa 3 de 3: Resultado da geração
            </h3>

            <div className="space-y-4 max-h-[400px] overflow-y-auto border rounded-lg p-4 bg-muted/50">
              {result.title_suggested && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Título sugerido</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(result.title_suggested!)}
                      className="gap-1 h-7"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar
                    </Button>
                  </div>
                  <p className="text-sm bg-background p-3 rounded border">
                    {result.title_suggested}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Descrição</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(result.description_long)}
                    className="gap-1 h-7"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </Button>
                </div>
                <div className="text-sm bg-background p-3 rounded border whitespace-pre-wrap">
                  {result.description_long}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2 pt-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  className={`gap-2 ${buttonRadius}`}
                >
                  <RefreshCw className="h-4 w-4" />
                  Regerar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className={`gap-2 ${buttonRadius}`}
                >
                  Ajustar tom
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className={buttonRadius}
                >
                  Editar manualmente
                </Button>
                <Button
                  onClick={handleApply}
                  className={`gap-2 ${buttonRadius}`}
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                >
                  <Check className="h-4 w-4" />
                  Aplicar no produto
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading state for step 3 */}
        {step === 3 && !result && loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Gerando conteúdo com IA...</p>
            <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
