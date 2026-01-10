import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  CreditCard, 
  QrCode, 
  ExternalLink,
  Settings2,
  FileText,
  Percent,
  Info,
  AlertTriangle
} from "lucide-react";

interface PaymentSettings {
  id?: string;
  user_id: string;
  // Legacy fields for gateway credentials
  mercadopago_enabled: boolean;
  mercadopago_access_token: string | null;
  mercadopago_public_key: string | null;
  pagbank_enabled: boolean;
  pagbank_token: string | null;
  pagbank_email: string | null;
  // New payment method fields
  pix_enabled: boolean;
  pix_provider: 'mercado_pago' | 'pagbank' | null;
  pix_discount_percent: number;
  credit_card_enabled: boolean;
  credit_card_provider: 'mercado_pago' | 'pagbank' | null;
  credit_card_installments_no_interest: number;
  boleto_enabled: boolean;
  boleto_provider: 'mercado_pago' | 'pagbank' | null;
}

const defaultSettings: Omit<PaymentSettings, 'user_id'> = {
  mercadopago_enabled: false,
  mercadopago_access_token: null,
  mercadopago_public_key: null,
  pagbank_enabled: false,
  pagbank_token: null,
  pagbank_email: null,
  pix_enabled: false,
  pix_provider: null,
  pix_discount_percent: 0,
  credit_card_enabled: false,
  credit_card_provider: null,
  credit_card_installments_no_interest: 1,
  boleto_enabled: false,
  boleto_provider: null,
};

const PaymentMethodsContent = () => {
  const { user } = useAuth();
  const { primaryColor, buttonBgColor, buttonTextColor } = useTheme();
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Dialog states for gateway configuration
  const [mercadoPagoDialogOpen, setMercadoPagoDialogOpen] = useState(false);
  const [pagbankDialogOpen, setPagbankDialogOpen] = useState(false);
  
  // Temp form states for gateway credentials
  const [tempMercadoPago, setTempMercadoPago] = useState({
    accessToken: "",
    publicKey: "",
  });
  
  const [tempPagbank, setTempPagbank] = useState({
    token: "",
    email: "",
  });

  // Local state for payment methods configuration
  const [pixEnabled, setPixEnabled] = useState(false);
  const [pixProvider, setPixProvider] = useState<string>("");
  const [pixDiscount, setPixDiscount] = useState(0);
  
  const [creditCardEnabled, setCreditCardEnabled] = useState(false);
  const [creditCardProvider, setCreditCardProvider] = useState<string>("");
  const [creditCardInstallments, setCreditCardInstallments] = useState(1);
  
  const [boletoEnabled, setBoletoEnabled] = useState(false);
  const [boletoProvider, setBoletoProvider] = useState<string>("");

  const hasMercadoPagoCredentials = !!(settings?.mercadopago_access_token && settings?.mercadopago_public_key);
  const hasPagbankCredentials = !!(settings?.pagbank_token && settings?.pagbank_email);
  const hasAnyGateway = hasMercadoPagoCredentials || hasPagbankCredentials;

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  useEffect(() => {
    if (settings) {
      setPixEnabled(settings.pix_enabled || false);
      setPixProvider(settings.pix_provider || "");
      setPixDiscount(settings.pix_discount_percent || 0);
      setCreditCardEnabled(settings.credit_card_enabled || false);
      setCreditCardProvider(settings.credit_card_provider || "");
      setCreditCardInstallments(settings.credit_card_installments_no_interest || 1);
      setBoletoEnabled(settings.boleto_enabled || false);
      setBoletoProvider(settings.boleto_provider || "");
    }
  }, [settings]);

  const fetchSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data as PaymentSettings);
      } else {
        setSettings({ ...defaultSettings, user_id: user.id });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching payment settings:", error);
      }
      toast.error("Erro ao carregar configurações de pagamento");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<PaymentSettings>) => {
    if (!user || !settings) return;
    
    setSaving(true);
    try {
      const updatedSettings = { ...settings, ...newSettings };
      
      if (settings.id) {
        const { error } = await supabase
          .from("payment_settings")
          .update(updatedSettings)
          .eq("id", settings.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("payment_settings")
          .insert({ ...updatedSettings, user_id: user.id })
          .select()
          .single();
        
        if (error) throw error;
        if (data) {
          setSettings(data as PaymentSettings);
          return;
        }
      }
      
      setSettings(updatedSettings);
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error saving payment settings:", error);
      }
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const validateAndSavePaymentMethods = async () => {
    // Validation: if a method is enabled, it must have a provider
    if (pixEnabled && !pixProvider) {
      toast.error("Selecione um gateway para o Pix");
      return;
    }
    if (creditCardEnabled && !creditCardProvider) {
      toast.error("Selecione um gateway para o Cartão de Crédito");
      return;
    }
    if (boletoEnabled && !boletoProvider) {
      toast.error("Selecione um gateway para o Boleto");
      return;
    }

    // Validate provider credentials
    if (pixEnabled && pixProvider === "mercado_pago" && !hasMercadoPagoCredentials) {
      toast.error("Configure as credenciais do Mercado Pago antes de ativar o Pix");
      return;
    }
    if (pixEnabled && pixProvider === "pagbank" && !hasPagbankCredentials) {
      toast.error("Configure as credenciais do PagBank antes de ativar o Pix");
      return;
    }
    if (creditCardEnabled && creditCardProvider === "mercado_pago" && !hasMercadoPagoCredentials) {
      toast.error("Configure as credenciais do Mercado Pago antes de ativar o Cartão");
      return;
    }
    if (creditCardEnabled && creditCardProvider === "pagbank" && !hasPagbankCredentials) {
      toast.error("Configure as credenciais do PagBank antes de ativar o Cartão");
      return;
    }
    if (boletoEnabled && boletoProvider === "mercado_pago" && !hasMercadoPagoCredentials) {
      toast.error("Configure as credenciais do Mercado Pago antes de ativar o Boleto");
      return;
    }
    if (boletoEnabled && boletoProvider === "pagbank" && !hasPagbankCredentials) {
      toast.error("Configure as credenciais do PagBank antes de ativar o Boleto");
      return;
    }

    // Validate discount range
    if (pixDiscount < 0 || pixDiscount > 100) {
      toast.error("Desconto no Pix deve ser entre 0 e 100%");
      return;
    }

    // Validate installments
    if (creditCardInstallments < 1) {
      toast.error("Parcelamento deve ser pelo menos 1x");
      return;
    }

    await saveSettings({
      pix_enabled: pixEnabled,
      pix_provider: pixEnabled && pixProvider ? (pixProvider as 'mercado_pago' | 'pagbank') : null,
      pix_discount_percent: pixDiscount,
      credit_card_enabled: creditCardEnabled,
      credit_card_provider: creditCardEnabled && creditCardProvider ? (creditCardProvider as 'mercado_pago' | 'pagbank') : null,
      credit_card_installments_no_interest: creditCardInstallments,
      boleto_enabled: boletoEnabled,
      boleto_provider: boletoEnabled && boletoProvider ? (boletoProvider as 'mercado_pago' | 'pagbank') : null,
    });
  };

  const saveMercadoPagoCredentials = async () => {
    if (!tempMercadoPago.accessToken.trim() || !tempMercadoPago.publicKey.trim()) {
      toast.error("Preencha todas as credenciais do Mercado Pago");
      return;
    }
    
    await saveSettings({
      mercadopago_enabled: true,
      mercadopago_access_token: tempMercadoPago.accessToken,
      mercadopago_public_key: tempMercadoPago.publicKey,
    });
    setMercadoPagoDialogOpen(false);
  };

  const savePagbankCredentials = async () => {
    if (!tempPagbank.token.trim() || !tempPagbank.email.trim()) {
      toast.error("Preencha todas as credenciais do PagBank");
      return;
    }
    
    await saveSettings({
      pagbank_enabled: true,
      pagbank_token: tempPagbank.token,
      pagbank_email: tempPagbank.email,
    });
    setPagbankDialogOpen(false);
  };

  const openMercadoPagoConfig = () => {
    setTempMercadoPago({
      accessToken: settings?.mercadopago_access_token || "",
      publicKey: settings?.mercadopago_public_key || "",
    });
    setMercadoPagoDialogOpen(true);
  };

  const openPagbankConfig = () => {
    setTempPagbank({
      token: settings?.pagbank_token || "",
      email: settings?.pagbank_email || "",
    });
    setPagbankDialogOpen(true);
  };

  const noMethodsActive = !pixEnabled && !creditCardEnabled && !boletoEnabled;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* CSS for gateway credential buttons hover with merchant primary color */}
      <style>{`
        .gateway-credentials-btn:hover {
          background-color: ${buttonBgColor} !important;
          color: ${buttonTextColor} !important;
          border-color: ${buttonBgColor} !important;
        }
      `}</style>
      <div className="space-y-6 max-w-4xl lg:max-w-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
              <CreditCard className="h-4 w-4 text-gray-600" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Formas de Pagamento</h2>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Configure quais métodos de pagamento estarão disponíveis no checkout da sua loja.
          </p>
        </div>

        {/* Warning if no methods active */}
        {noMethodsActive && (
          <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Ative pelo menos uma forma de pagamento para receber pedidos.
            </AlertDescription>
          </Alert>
        )}

        {/* Gateway Configuration Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurar Gateways</CardTitle>
            <CardDescription>
              Configure as credenciais dos gateways antes de ativar os métodos de pagamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mercado Pago */}
              <div className={`p-4 rounded-lg border-2 ${hasMercadoPagoCredentials ? 'border-green-200 bg-green-50' : 'border-muted bg-muted/30'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" style={{ color: '#00A1E4' }} />
                    <span className="font-medium">Mercado Pago</span>
                  </div>
                  {hasMercadoPagoCredentials && (
                    <span className="text-xs text-green-600 font-medium">Configurado</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openMercadoPagoConfig}
                  className="w-full gateway-credentials-btn transition-colors"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  {hasMercadoPagoCredentials ? "Editar credenciais" : "Configurar"}
                </Button>
              </div>

              {/* PagBank */}
              <div className={`p-4 rounded-lg border-2 ${hasPagbankCredentials ? 'border-green-200 bg-green-50' : 'border-muted bg-muted/30'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" style={{ color: '#FFC700' }} />
                    <span className="font-medium">PagBank</span>
                  </div>
                  {hasPagbankCredentials && (
                    <span className="text-xs text-green-600 font-medium">Configurado</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openPagbankConfig}
                  className="w-full gateway-credentials-btn transition-colors"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  {hasPagbankCredentials ? "Editar credenciais" : "Configurar"}
                </Button>
              </div>
            </div>

            {!hasAnyGateway && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Configure pelo menos um gateway</p>
                    <p className="mt-1">
                      Para ativar os métodos de pagamento, você precisa configurar as credenciais do Mercado Pago ou PagBank.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Métodos de Pagamento</CardTitle>
            <CardDescription>
              Ative os métodos que deseja oferecer e escolha qual gateway será usado para cada um.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pix */}
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <QrCode className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <h3 className="font-medium">Pix</h3>
                    <p className="text-sm text-muted-foreground">Pagamento instantâneo via QR Code</p>
                  </div>
                </div>
                <Switch
                  checked={pixEnabled}
                  onCheckedChange={setPixEnabled}
                  disabled={!hasAnyGateway}
                  style={{
                    backgroundColor: pixEnabled ? primaryColor : undefined,
                  }}
                />
              </div>
              
              {pixEnabled && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gateway para Pix *</Label>
                      <Select value={pixProvider} onValueChange={setPixProvider}>
                        <SelectTrigger style={{ borderColor: primaryColor }}>
                          <SelectValue placeholder="Selecione o gateway" />
                        </SelectTrigger>
                        <SelectContent>
                          {hasMercadoPagoCredentials && (
                            <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                          )}
                          {hasPagbankCredentials && (
                            <SelectItem value="pagbank">PagBank</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        Desconto no Pix (%)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={pixDiscount}
                        onChange={(e) => setPixDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                        style={{ borderColor: primaryColor }}
                        onFocus={(e) => {
                          e.currentTarget.style.boxShadow = `0 0 0 1px ${primaryColor}`;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cartão de Crédito */}
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <CreditCard className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <h3 className="font-medium">Cartão de crédito</h3>
                    <p className="text-sm text-muted-foreground">Pague em até 12x</p>
                  </div>
                </div>
                <Switch
                  checked={creditCardEnabled}
                  onCheckedChange={setCreditCardEnabled}
                  disabled={!hasAnyGateway}
                  style={{
                    backgroundColor: creditCardEnabled ? primaryColor : undefined,
                  }}
                />
              </div>
              
              {creditCardEnabled && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gateway para Cartão *</Label>
                      <Select value={creditCardProvider} onValueChange={setCreditCardProvider}>
                        <SelectTrigger style={{ borderColor: primaryColor }}>
                          <SelectValue placeholder="Selecione o gateway" />
                        </SelectTrigger>
                        <SelectContent>
                          {hasMercadoPagoCredentials && (
                            <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                          )}
                          {hasPagbankCredentials && (
                            <SelectItem value="pagbank">PagBank</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Parcelamento sem juros (até)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="12"
                        value={creditCardInstallments}
                        onChange={(e) => setCreditCardInstallments(Math.min(12, Math.max(1, Number(e.target.value))))}
                        style={{ borderColor: primaryColor }}
                        onFocus={(e) => {
                          e.currentTarget.style.boxShadow = `0 0 0 1px ${primaryColor}`;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Boleto Bancário */}
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <FileText className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <h3 className="font-medium">Boleto bancário</h3>
                    <p className="text-sm text-muted-foreground">Pagamento via boleto</p>
                  </div>
                </div>
                <Switch
                  checked={boletoEnabled}
                  onCheckedChange={setBoletoEnabled}
                  disabled={!hasAnyGateway}
                  style={{
                    backgroundColor: boletoEnabled ? primaryColor : undefined,
                  }}
                />
              </div>
              
              {boletoEnabled && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Gateway para Boleto *</Label>
                    <Select value={boletoProvider} onValueChange={setBoletoProvider}>
                      <SelectTrigger style={{ borderColor: primaryColor }}>
                        <SelectValue placeholder="Selecione o gateway" />
                      </SelectTrigger>
                      <SelectContent>
                        {hasMercadoPagoCredentials && (
                          <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                        )}
                        {hasPagbankCredentials && (
                          <SelectItem value="pagbank">PagBank</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <Button
                onClick={validateAndSavePaymentMethods}
                disabled={saving}
                className="w-full md:w-auto"
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Links úteis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open('https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/integrate-with-pix', '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Documentação Mercado Pago
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open('https://dev.pagseguro.uol.com.br/reference/pix-intro', '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Documentação PagBank
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Mercado Pago Config Dialog */}
        <Dialog open={mercadoPagoDialogOpen} onOpenChange={setMercadoPagoDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" style={{ color: '#00A1E4' }} />
                Configurar Mercado Pago
              </DialogTitle>
              <DialogDescription>
                Insira suas credenciais do Mercado Pago para habilitar pagamentos.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mp-access-token">Access Token *</Label>
                <Input
                  id="mp-access-token"
                  type="password"
                  placeholder="APP_USR-..."
                  value={tempMercadoPago.accessToken}
                  onChange={(e) => setTempMercadoPago(prev => ({ ...prev, accessToken: e.target.value }))}
                  style={{ borderColor: primaryColor }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${primaryColor}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mp-public-key">Public Key *</Label>
                <Input
                  id="mp-public-key"
                  placeholder="APP_USR-..."
                  value={tempMercadoPago.publicKey}
                  onChange={(e) => setTempMercadoPago(prev => ({ ...prev, publicKey: e.target.value }))}
                  style={{ borderColor: primaryColor }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${primaryColor}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p>Obtenha suas credenciais em:</p>
                    <a 
                      href="https://www.mercadopago.com.br/developers/panel/app" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      mercadopago.com.br/developers
                    </a>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setMercadoPagoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={saveMercadoPagoCredentials}
                disabled={saving}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                {saving ? "Salvando..." : "Salvar Credenciais"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PagBank Config Dialog */}
        <Dialog open={pagbankDialogOpen} onOpenChange={setPagbankDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" style={{ color: '#FFC700' }} />
                Configurar PagBank
              </DialogTitle>
              <DialogDescription>
                Insira suas credenciais do PagBank para habilitar pagamentos.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pb-token">Token *</Label>
                <Input
                  id="pb-token"
                  type="password"
                  placeholder="Seu token do PagBank"
                  value={tempPagbank.token}
                  onChange={(e) => setTempPagbank(prev => ({ ...prev, token: e.target.value }))}
                  style={{ borderColor: primaryColor }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${primaryColor}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pb-email">E-mail da conta PagBank *</Label>
                <Input
                  id="pb-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={tempPagbank.email}
                  onChange={(e) => setTempPagbank(prev => ({ ...prev, email: e.target.value }))}
                  style={{ borderColor: primaryColor }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${primaryColor}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p>Obtenha suas credenciais em:</p>
                    <a 
                      href="https://pagseguro.uol.com.br/preferencias/integracoes" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      pagseguro.uol.com.br/preferencias
                    </a>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPagbankDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={savePagbankCredentials}
                disabled={saving}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                {saving ? "Salvando..." : "Salvar Credenciais"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

const PaymentMethods = () => {
  return (
    <ThemeProvider>
      <PaymentMethodsContent />
    </ThemeProvider>
  );
};

export default PaymentMethods;
