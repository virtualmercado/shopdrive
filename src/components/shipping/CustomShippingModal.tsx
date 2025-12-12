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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";

interface ShippingRule {
  id: string;
  rule_name: string;
  scope_type: "neighborhood" | "city" | "zipcode";
  scope_value: string;
  shipping_fee: number;
  is_active: boolean;
}

interface CustomShippingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CustomShippingModal = ({ open, onOpenChange, onSuccess }: CustomShippingModalProps) => {
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor, primaryColor } = useTheme();
  
  const [rules, setRules] = useState<ShippingRule[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [ruleName, setRuleName] = useState("");
  const [scopeType, setScopeType] = useState<"neighborhood" | "city" | "zipcode">("neighborhood");
  const [scopeValue, setScopeValue] = useState("");
  const [shippingFee, setShippingFee] = useState("");

  useEffect(() => {
    if (open && user) {
      fetchRules();
    }
  }, [open, user]);

  const fetchRules = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("shipping_rules")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRules((data || []).map(item => ({
        ...item,
        scope_type: item.scope_type as "neighborhood" | "city" | "zipcode"
      })));
    } catch (error) {
      console.error("Error fetching rules:", error);
    }
  };

  const handleAddRule = async () => {
    if (!user) return;

    if (!ruleName.trim() || !scopeValue.trim() || !shippingFee) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("shipping_rules")
        .insert({
          user_id: user.id,
          rule_name: ruleName.trim(),
          scope_type: scopeType,
          scope_value: scopeValue.trim(),
          shipping_fee: parseFloat(shippingFee),
          is_active: true,
        });

      if (error) throw error;

      toast.success("Regra adicionada com sucesso!");
      setRuleName("");
      setScopeValue("");
      setShippingFee("");
      fetchRules();
      onSuccess?.();
    } catch (error) {
      console.error("Error adding rule:", error);
      toast.error("Erro ao adicionar regra");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from("shipping_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Regra removida com sucesso!");
      fetchRules();
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Erro ao remover regra");
    }
  };

  const getScopeLabel = (type: string) => {
    switch (type) {
      case "neighborhood": return "Bairro";
      case "city": return "Cidade";
      case "zipcode": return "CEP";
      default: return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <style>{`
          [data-radix-dialog-content] > button[type="button"]:focus,
          [data-radix-dialog-content] > button[type="button"]:focus-visible {
            outline: 2px solid ${primaryColor} !important;
            outline-offset: 2px !important;
            box-shadow: none !important;
          }
          [data-radix-dialog-content] > button[type="button"]:hover {
            color: ${primaryColor} !important;
          }
          /* Input focus styles with merchant color */
          .merchant-input:focus {
            border-color: ${primaryColor} !important;
            box-shadow: 0 0 0 2px ${primaryColor}33 !important;
          }
          /* Select trigger hover with merchant color */
          .merchant-select:hover {
            border-color: ${primaryColor} !important;
          }
          .merchant-select[data-state="open"] {
            border-color: ${primaryColor} !important;
            box-shadow: 0 0 0 2px ${primaryColor}33 !important;
          }
        `}</style>
        
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Frete Personalizado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add New Rule Form */}
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <h3 className="font-medium">Adicionar Nova Regra</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule_name">Nome da Regra</Label>
                <Input
                  id="rule_name"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Ex: Centro da cidade"
                  style={{ borderColor: primaryColor }}
                  className="merchant-input focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scope_type">Tipo de Escopo</Label>
                <Select value={scopeType} onValueChange={(v) => setScopeType(v as any)}>
                  <SelectTrigger 
                    style={{ borderColor: primaryColor }}
                    className="merchant-select focus:ring-0 focus:ring-offset-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem 
                      value="neighborhood"
                      className="cursor-pointer"
                      style={{ 
                        backgroundColor: scopeType === "neighborhood" ? `${primaryColor}15` : undefined 
                      }}
                    >
                      Bairro
                    </SelectItem>
                    <SelectItem 
                      value="city"
                      className="cursor-pointer"
                      style={{ 
                        backgroundColor: scopeType === "city" ? `${primaryColor}15` : undefined 
                      }}
                    >
                      Cidade
                    </SelectItem>
                    <SelectItem 
                      value="zipcode"
                      className="cursor-pointer"
                      style={{ 
                        backgroundColor: scopeType === "zipcode" ? `${primaryColor}15` : undefined 
                      }}
                    >
                      CEP
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scope_value">
                  {scopeType === "neighborhood" ? "Bairro" : scopeType === "city" ? "Cidade" : "CEP"}
                </Label>
                <Input
                  id="scope_value"
                  value={scopeValue}
                  onChange={(e) => setScopeValue(e.target.value)}
                  placeholder={scopeType === "zipcode" ? "00000-000" : "Nome do local"}
                  style={{ borderColor: primaryColor }}
                  className="merchant-input focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shipping_fee">Valor do Frete (R$)</Label>
                <Input
                  id="shipping_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  placeholder="0.00"
                  style={{ borderColor: primaryColor }}
                  className="merchant-input focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <Button
              onClick={handleAddRule}
              disabled={loading}
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              className="w-full hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Existing Rules */}
          <div className="space-y-3">
            <h3 className="font-medium">Regras Cadastradas</h3>
            
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma regra cadastrada
              </p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-3 bg-white border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{rule.rule_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {getScopeLabel(rule.scope_type)}: {rule.scope_value} • R$ {rule.shipping_fee.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            style={{ borderColor: primaryColor, color: primaryColor }}
            className="hover:opacity-90"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomShippingModal;
