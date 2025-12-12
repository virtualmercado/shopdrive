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

interface CorreiosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CorreiosModal = ({ open, onOpenChange, onSuccess }: CorreiosModalProps) => {
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor, primaryColor } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [originZipcode, setOriginZipcode] = useState("");
  const [contractCode, setContractCode] = useState("");
  const [contractPassword, setContractPassword] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchSettings();
    }
  }, [open, user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("correios_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setExistingId(data.id);
        setOriginZipcode(data.origin_zipcode || "");
        setContractCode(data.contract_code || "");
        setContractPassword(data.contract_password || "");
        setIsActive(data.is_active || false);
      }
    } catch (error) {
      // No existing settings
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!originZipcode.trim()) {
      toast.error("CEP de origem é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user_id: user.id,
        origin_zipcode: originZipcode.trim(),
        contract_code: contractCode.trim() || null,
        contract_password: contractPassword.trim() || null,
        is_active: true,
      };

      let error;
      if (existingId) {
        const result = await supabase
          .from("correios_settings")
          .update(payload)
          .eq("id", existingId);
        error = result.error;
      } else {
        const result = await supabase
          .from("correios_settings")
          .insert(payload);
        error = result.error;
      }

      if (error) throw error;

      toast.success("Configurações dos Correios salvas!");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving Correios settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!user || !existingId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("correios_settings")
        .update({ is_active: false })
        .eq("id", existingId);

      if (error) throw error;

      toast.success("Integração desativada!");
      setIsActive(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error deactivating Correios:", error);
      toast.error("Erro ao desativar integração");
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
            Integração Correios
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="origin_zipcode">CEP de Origem *</Label>
            <Input
              id="origin_zipcode"
              value={originZipcode}
              onChange={(e) => setOriginZipcode(e.target.value)}
              placeholder="00000-000"
              style={{ borderColor: primaryColor }}
              className="merchant-input focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <p className="text-xs text-muted-foreground">
              CEP de onde os produtos serão enviados
            </p>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-3">Contrato (opcional)</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Se você possui contrato com os Correios, informe os dados abaixo para obter preços diferenciados.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contract_code">Código do Contrato</Label>
                <Input
                  id="contract_code"
                  value={contractCode}
                  onChange={(e) => setContractCode(e.target.value)}
                  placeholder="Código do contrato"
                  style={{ borderColor: primaryColor }}
                  className="merchant-input focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract_password">Senha do Contrato</Label>
                <Input
                  id="contract_password"
                  type="password"
                  value={contractPassword}
                  onChange={(e) => setContractPassword(e.target.value)}
                  placeholder="Senha do contrato"
                  style={{ borderColor: primaryColor }}
                  className="merchant-input focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>
          </div>
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
          {existingId && isActive && (
            <Button
              variant="outline"
              onClick={handleDeactivate}
              disabled={loading}
              className="text-destructive border-destructive hover:bg-destructive/10"
            >
              Desativar
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

export default CorreiosModal;
