import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Eye, EyeOff, Save, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface GatewayConfig {
  id: string;
  gateway_name: string;
  display_name: string;
  is_active: boolean;
  is_default: boolean;
  environment: string;
  mercadopago_access_token?: string;
  mercadopago_public_key?: string;
  pagbank_token?: string;
  pagbank_email?: string;
}

interface GatewayConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gateway: GatewayConfig | null;
  onSave: () => void;
}

export const GatewayConfigModal = ({
  open,
  onOpenChange,
  gateway,
  onSave
}: GatewayConfigModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [showPagbankToken, setShowPagbankToken] = useState(false);

  const [formData, setFormData] = useState({
    is_active: false,
    is_default: false,
    environment: "sandbox",
    mercadopago_access_token: "",
    mercadopago_public_key: "",
    pagbank_token: "",
    pagbank_email: ""
  });

  useEffect(() => {
    if (gateway) {
      setFormData({
        is_active: gateway.is_active || false,
        is_default: gateway.is_default || false,
        environment: gateway.environment || "sandbox",
        mercadopago_access_token: gateway.mercadopago_access_token || "",
        mercadopago_public_key: gateway.mercadopago_public_key || "",
        pagbank_token: gateway.pagbank_token || "",
        pagbank_email: gateway.pagbank_email || ""
      });
    }
  }, [gateway]);

  const handleSave = async () => {
    if (!gateway) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("master_payment_gateways")
        .update({
          is_active: formData.is_active,
          is_default: formData.is_default,
          environment: formData.environment,
          mercadopago_access_token: formData.mercadopago_access_token || null,
          mercadopago_public_key: formData.mercadopago_public_key || null,
          pagbank_token: formData.pagbank_token || null,
          pagbank_email: formData.pagbank_email || null
        })
        .eq("id", gateway.id);

      if (error) throw error;

      // Se marcou como padrão, desmarcar os outros
      if (formData.is_default) {
        await supabase
          .from("master_payment_gateways")
          .update({ is_default: false })
          .neq("id", gateway.id);
      }

      toast.success(`Configurações de ${gateway.display_name} salvas com sucesso!`);
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving gateway config:", error);
      toast.error(error.message || "Erro ao salvar configurações");
    } finally {
      setIsLoading(false);
    }
  };

  if (!gateway) return null;

  const isMercadoPago = gateway.gateway_name === "mercadopago";
  const isPagBank = gateway.gateway_name === "pagbank";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Configurar {gateway.display_name}
          </DialogTitle>
          <DialogDescription>
            Configure as credenciais e preferências do gateway de pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status e Ambiente */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">Ativo</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, is_active: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">Padrão</Label>
              <Switch
                checked={formData.is_default}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, is_default: checked }))
                }
              />
            </div>
          </div>

          {/* Ambiente */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Ambiente</Label>
            <RadioGroup
              value={formData.environment}
              onValueChange={(value) => 
                setFormData(prev => ({ ...prev, environment: value }))
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sandbox" id="sandbox" />
                <Label htmlFor="sandbox" className="cursor-pointer flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Sandbox (Teste)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="production" id="production" />
                <Label htmlFor="production" className="cursor-pointer flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Produção
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Credenciais Mercado Pago */}
          {isMercadoPago && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mp-access-token">Access Token</Label>
                <div className="relative">
                  <Input
                    id="mp-access-token"
                    type={showAccessToken ? "text" : "password"}
                    placeholder="APP_USR-..."
                    value={formData.mercadopago_access_token}
                    onChange={(e) => 
                      setFormData(prev => ({ ...prev, mercadopago_access_token: e.target.value }))
                    }
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setShowAccessToken(!showAccessToken)}
                  >
                    {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mp-public-key">Public Key</Label>
                <div className="relative">
                  <Input
                    id="mp-public-key"
                    type={showPublicKey ? "text" : "password"}
                    placeholder="APP_USR-..."
                    value={formData.mercadopago_public_key}
                    onChange={(e) => 
                      setFormData(prev => ({ ...prev, mercadopago_public_key: e.target.value }))
                    }
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPublicKey(!showPublicKey)}
                  >
                    {showPublicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Obtenha suas credenciais em{" "}
                <a 
                  href="https://www.mercadopago.com.br/developers/panel/credentials" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#6a1b9a] underline"
                >
                  Mercado Pago Developers
                </a>
              </p>
            </div>
          )}

          {/* Credenciais PagBank */}
          {isPagBank && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pb-email">E-mail PagBank</Label>
                <Input
                  id="pb-email"
                  type="email"
                  placeholder="seu-email@exemplo.com"
                  value={formData.pagbank_email}
                  onChange={(e) => 
                    setFormData(prev => ({ ...prev, pagbank_email: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pb-token">Token</Label>
                <div className="relative">
                  <Input
                    id="pb-token"
                    type={showPagbankToken ? "text" : "password"}
                    placeholder="Token de integração"
                    value={formData.pagbank_token}
                    onChange={(e) => 
                      setFormData(prev => ({ ...prev, pagbank_token: e.target.value }))
                    }
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPagbankToken(!showPagbankToken)}
                  >
                    {showPagbankToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Obtenha suas credenciais em{" "}
                <a 
                  href="https://dev.pagbank.uol.com.br" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#6a1b9a] underline"
                >
                  PagBank Developers
                </a>
              </p>
            </div>
          )}

          {/* Aviso de Produção */}
          {formData.environment === "production" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Atenção:</strong> Você está configurando o ambiente de produção. 
                  Todas as transações serão reais.
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              "Salvando..."
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
