import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";

interface FreeShippingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ShippingScope = "ALL" | "CITY" | "STATE";

const FreeShippingModal = ({ open, onOpenChange, onSuccess }: FreeShippingModalProps) => {
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor, primaryColor } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [minimumValue, setMinimumValue] = useState("");
  const [scope, setScope] = useState<ShippingScope>("ALL");
  const [cep, setCep] = useState("");
  const [merchantCity, setMerchantCity] = useState("");
  const [merchantState, setMerchantState] = useState("");
  const [cepError, setCepError] = useState("");

  useEffect(() => {
    if (open && user) {
      fetchSettings();
    }
  }, [open, user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("free_shipping_minimum, free_shipping_scope, merchant_reference_cep, merchant_city, merchant_state")
        .eq("id", user.id)
        .single();

      if (data) {
        if (data.free_shipping_minimum) {
          setMinimumValue(data.free_shipping_minimum.toString());
        } else {
          setMinimumValue("");
        }
        setScope((data.free_shipping_scope as ShippingScope) || "ALL");
        setCep(data.merchant_reference_cep || "");
        setMerchantCity(data.merchant_city || "");
        setMerchantState(data.merchant_state || "");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length > 5) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return digits;
  };

  const handleCepChange = async (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    setCepError("");

    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 8) {
      await lookupCep(digits);
    } else {
      setMerchantCity("");
      setMerchantState("");
    }
  };

  const lookupCep = async (cepDigits: string) => {
    setLookupLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        setCepError("CEP não encontrado");
        setMerchantCity("");
        setMerchantState("");
      } else {
        setMerchantCity(data.localidade || "");
        setMerchantState(data.uf || "");
        setCepError("");
      }
    } catch (error) {
      setCepError("Erro ao consultar CEP");
      setMerchantCity("");
      setMerchantState("");
    } finally {
      setLookupLoading(false);
    }
  };

  const isFormValid = () => {
    const minValueValid = minimumValue.trim() !== "" && parseFloat(minimumValue) >= 0;
    const cepValid = cep.replace(/\D/g, "").length === 8 && !cepError && merchantCity && merchantState;
    return minValueValid && cepValid;
  };

  const handleSave = async () => {
    if (!user) return;

    if (!isFormValid()) {
      if (!minimumValue.trim() || parseFloat(minimumValue) < 0) {
        toast.error("Informe um valor mínimo válido");
        return;
      }
      if (cep.replace(/\D/g, "").length !== 8) {
        toast.error("Informe um CEP válido com 8 dígitos");
        return;
      }
      if (cepError || !merchantCity || !merchantState) {
        toast.error("CEP inválido. Verifique e tente novamente.");
        return;
      }
      return;
    }

    setLoading(true);
    try {
      const value = parseFloat(minimumValue);

      const { error } = await supabase
        .from("profiles")
        .update({
          free_shipping_minimum: value,
          free_shipping_scope: scope,
          merchant_reference_cep: cep.replace(/\D/g, ""),
          merchant_city: merchantCity,
          merchant_state: merchantState,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Configuração de frete grátis salva!");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving free shipping settings:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          free_shipping_minimum: null,
          free_shipping_scope: "ALL",
          merchant_reference_cep: null,
          merchant_city: null,
          merchant_state: null,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Frete grátis removido!");
      setMinimumValue("");
      setScope("ALL");
      setCep("");
      setMerchantCity("");
      setMerchantState("");
      onSuccess?.();
    } catch (error) {
      console.error("Error removing free shipping:", error);
      toast.error("Erro ao remover frete grátis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <style>{`
          [data-radix-dialog-content] > button[type="button"]:focus,
          [data-radix-dialog-content] > button[type="button"]:focus-visible {
            outline: 2px solid ${primaryColor} !important;
            outline-offset: 2px !important;
            box-shadow: none !important;
          }
          [data-radix-dialog-content] > button[type="button"]:hover {
            color: ${primaryColor} !important;
            outline: 1px solid ${primaryColor} !important;
            outline-offset: 0px !important;
          }
          .merchant-input:focus {
            border-color: ${primaryColor} !important;
            box-shadow: 0 0 0 2px ${primaryColor}33 !important;
          }
          .merchant-cancel-btn:hover {
            background-color: ${primaryColor}15 !important;
          }
          .merchant-radio[data-state="checked"] {
            border-color: ${primaryColor} !important;
          }
          .merchant-radio[data-state="checked"] > span {
            background-color: ${primaryColor} !important;
          }
        `}</style>
        
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Frete Grátis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Valor Mínimo */}
          <div className="space-y-2">
            <Label htmlFor="minimum_value">Valor Mínimo para Frete Grátis (R$)</Label>
            <Input
              id="minimum_value"
              type="number"
              min="0"
              step="0.01"
              value={minimumValue}
              onChange={(e) => setMinimumValue(e.target.value)}
              placeholder="Ex: 100,00"
              style={{ borderColor: primaryColor }}
              className="merchant-input focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <p className="text-xs text-muted-foreground">
              Pedidos acima deste valor terão frete grátis
            </p>
          </div>

          {/* Locais Válidos */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Locais Válidos</Label>
            <RadioGroup
              value={scope}
              onValueChange={(value) => setScope(value as ShippingScope)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem 
                  value="ALL" 
                  id="scope-all"
                  className="merchant-radio border-2"
                  style={{ 
                    borderColor: scope === "ALL" ? primaryColor : undefined,
                    backgroundColor: "#FFFFFF"
                  }}
                />
                <Label htmlFor="scope-all" className="cursor-pointer font-normal">
                  Todos
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem 
                  value="CITY" 
                  id="scope-city"
                  className="merchant-radio border-2"
                  style={{ 
                    borderColor: scope === "CITY" ? primaryColor : undefined,
                    backgroundColor: "#FFFFFF"
                  }}
                />
                <Label htmlFor="scope-city" className="cursor-pointer font-normal">
                  Apenas para minha cidade
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem 
                  value="STATE" 
                  id="scope-state"
                  className="merchant-radio border-2"
                  style={{ 
                    borderColor: scope === "STATE" ? primaryColor : undefined,
                    backgroundColor: "#FFFFFF"
                  }}
                />
                <Label htmlFor="scope-state" className="cursor-pointer font-normal">
                  Apenas para meu estado
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* CEP de Referência */}
          <div className="space-y-2">
            <Label htmlFor="cep" className="flex items-center gap-1">
              Digite seu CEP
              <span className="text-destructive">*</span>
              <span className="text-xs text-muted-foreground ml-1">(Obrigatório)</span>
            </Label>
            <div className="relative">
              <Input
                id="cep"
                type="text"
                value={cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                style={{ borderColor: cepError ? undefined : primaryColor }}
                className={`merchant-input focus-visible:ring-0 focus-visible:ring-offset-0 pr-10 ${cepError ? "border-destructive" : ""}`}
              />
              {lookupLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {cepError && (
              <p className="text-xs text-destructive">{cepError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Este CEP será usado para determinar sua cidade/estado nas regras de frete grátis
            </p>
          </div>

          {/* Cidade/Estado detectados */}
          {(merchantCity || merchantState) && !cepError && (
            <div 
              className="p-3 rounded-lg flex items-start gap-2"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: primaryColor }} />
              <div className="text-sm">
                <p className="font-medium">Localização detectada:</p>
                <p className="text-muted-foreground">
                  {merchantCity} - {merchantState}
                </p>
              </div>
            </div>
          )}

          {/* Resumo da regra */}
          {minimumValue && !cepError && merchantCity && (
            <div 
              className="p-3 rounded-lg"
              style={{ backgroundColor: `${primaryColor}10` }}
            >
              <p className="text-sm">
                <strong>Regra configurada:</strong> Frete grátis para pedidos acima de R$ {parseFloat(minimumValue).toFixed(2)}
                {scope === "ALL" && " para qualquer destino"}
                {scope === "CITY" && ` apenas para ${merchantCity}`}
                {scope === "STATE" && ` apenas para ${merchantState}`}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 merchant-cancel-btn"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            Cancelar
          </Button>
          {minimumValue && (
            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={loading}
              className="text-destructive border-destructive hover:bg-destructive/10"
            >
              Remover
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={loading || !isFormValid()}
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
            className="flex-1 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FreeShippingModal;
