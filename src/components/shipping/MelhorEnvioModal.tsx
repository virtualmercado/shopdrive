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

interface MelhorEnvioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const MelhorEnvioModal = ({ open, onOpenChange, onSuccess }: MelhorEnvioModalProps) => {
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor, primaryColor } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [userIdMelhorEnvio, setUserIdMelhorEnvio] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
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
        .from("melhor_envio_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setExistingId(data.id);
        setApiKey(data.api_key || "");
        setUserIdMelhorEnvio(data.user_id_melhor_envio || "");
        setEnvironment((data.environment as "sandbox" | "production") || "sandbox");
        setIsActive(data.is_active || false);
      }
    } catch (error) {
      // No existing settings
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!apiKey.trim()) {
      toast.error("API Key é obrigatória");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user_id: user.id,
        api_key: apiKey.trim(),
        user_id_melhor_envio: userIdMelhorEnvio.trim() || null,
        environment,
        is_active: true,
      };

      let error;
      if (existingId) {
        const result = await supabase
          .from("melhor_envio_settings")
          .update(payload)
          .eq("id", existingId);
        error = result.error;
      } else {
        const result = await supabase
          .from("melhor_envio_settings")
          .insert(payload);
        error = result.error;
      }

      if (error) throw error;

      toast.success("Configurações do Melhor Envio salvas!");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving Melhor Envio settings:", error);
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
        .from("melhor_envio_settings")
        .update({ is_active: false })
        .eq("id", existingId);

      if (error) throw error;

      toast.success("Integração desativada!");
      setIsActive(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error deactivating Melhor Envio:", error);
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
            outline: 1px solid ${primaryColor} !important;
            outline-offset: 0px !important;
          }
          /* Input focus styles with merchant color */
          .merchant-input:focus {
            border-color: ${primaryColor} !important;
            box-shadow: 0 0 0 2px ${primaryColor}33 !important;
          }
          /* Radio button styling - white background with primary border/indicator */
          .merchant-radio[data-state="checked"] span svg {
            fill: ${primaryColor} !important;
            color: ${primaryColor} !important;
          }
          /* Cancel button hover with merchant color */
          .merchant-cancel-btn:hover {
            background-color: ${primaryColor}15 !important;
          }
        `}</style>
        
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Integração Melhor Envio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="api_key">API Key *</Label>
            <Input
              id="api_key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Sua API Key do Melhor Envio"
              style={{ borderColor: primaryColor }}
              className="merchant-input focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <p className="text-xs text-muted-foreground">
              Obtenha sua API Key em melhorenvio.com.br
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user_id_melhor_envio">User ID (opcional)</Label>
            <Input
              id="user_id_melhor_envio"
              value={userIdMelhorEnvio}
              onChange={(e) => setUserIdMelhorEnvio(e.target.value)}
              placeholder="Seu User ID"
              style={{ borderColor: primaryColor }}
              className="merchant-input focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <div className="space-y-3">
            <Label>Ambiente</Label>
            <RadioGroup
              value={environment}
              onValueChange={(v) => setEnvironment(v as "sandbox" | "production")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="sandbox" 
                  id="sandbox"
                  className="merchant-radio border-2"
                  style={{
                    borderColor: primaryColor,
                    backgroundColor: '#FFFFFF',
                    color: primaryColor,
                  }}
                />
                <Label htmlFor="sandbox" className="cursor-pointer">Sandbox</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="production" 
                  id="production"
                  className="merchant-radio border-2"
                  style={{
                    borderColor: primaryColor,
                    backgroundColor: '#FFFFFF',
                    color: primaryColor,
                  }}
                />
                <Label htmlFor="production" className="cursor-pointer">Produção</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Use Sandbox para testes e Produção para ambiente real
            </p>
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

export default MelhorEnvioModal;
