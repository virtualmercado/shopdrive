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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

interface FreeShippingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const FreeShippingModal = ({ open, onOpenChange, onSuccess }: FreeShippingModalProps) => {
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor, primaryColor } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [minimumValue, setMinimumValue] = useState("");

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
        .select("free_shipping_minimum")
        .eq("id", user.id)
        .single();

      if (data?.free_shipping_minimum) {
        setMinimumValue(data.free_shipping_minimum.toString());
      } else {
        setMinimumValue("");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const value = minimumValue.trim() ? parseFloat(minimumValue) : null;

      const { error } = await supabase
        .from("profiles")
        .update({
          free_shipping_minimum: value,
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
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Frete grátis removido!");
      setMinimumValue("");
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
      <DialogContent className="max-w-md">
        <style>{`
          [data-radix-dialog-content] > button[type="button"]:focus,
          [data-radix-dialog-content] > button[type="button"]:focus-visible {
            outline: 2px solid ${primaryColor} !important;
            outline-offset: 2px !important;
            box-shadow: none !important;
          }
          [data-radix-dialog-content] > button[type="button"]:hover {
            color: ${primaryColor} !important;
            border-color: ${primaryColor} !important;
          }
          /* Input focus styles with merchant color */
          .merchant-input:focus {
            border-color: ${primaryColor} !important;
            box-shadow: 0 0 0 2px ${primaryColor}33 !important;
          }
          /* Cancel button hover with merchant color */
          .merchant-cancel-btn:hover {
            background-color: ${primaryColor}15 !important;
          }
        `}</style>
        
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Frete Grátis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="minimum_value">Valor Mínimo para Frete Grátis (R$)</Label>
            <Input
              id="minimum_value"
              type="number"
              min="0"
              step="0.01"
              value={minimumValue}
              onChange={(e) => setMinimumValue(e.target.value)}
              placeholder="Ex: 100.00"
              style={{ borderColor: primaryColor }}
              className="merchant-input focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <p className="text-xs text-muted-foreground">
              Pedidos acima deste valor terão frete grátis automaticamente
            </p>
          </div>

          {minimumValue && (
            <div 
              className="p-3 rounded-lg"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <p className="text-sm">
                <strong>Regra atual:</strong> Frete grátis para pedidos acima de R$ {parseFloat(minimumValue).toFixed(2)}
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
            disabled={loading}
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
            className="flex-1 hover:opacity-90 transition-opacity"
          >
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FreeShippingModal;
