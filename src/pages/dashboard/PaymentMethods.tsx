import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { 
  MessageCircle,
  CreditCard, 
  QrCode, 
  ExternalLink,
  Settings2,
  Trash2,
  Banknote,
  Smartphone,
  Building2,
  Percent,
  Info
} from "lucide-react";

interface PaymentSettings {
  id?: string;
  user_id: string;
  whatsapp_enabled: boolean;
  whatsapp_number: string | null;
  whatsapp_accepts_cash: boolean;
  whatsapp_accepts_credit: boolean;
  whatsapp_accepts_debit: boolean;
  whatsapp_accepts_pix: boolean;
  whatsapp_accepts_transfer: boolean;
  mercadopago_enabled: boolean;
  mercadopago_access_token: string | null;
  mercadopago_public_key: string | null;
  mercadopago_accepts_credit: boolean;
  mercadopago_accepts_pix: boolean;
  mercadopago_pix_discount: number;
  mercadopago_installments_free: number;
  pagbank_enabled: boolean;
  pagbank_token: string | null;
  pagbank_email: string | null;
  pagbank_accepts_credit: boolean;
  pagbank_accepts_pix: boolean;
}

const defaultSettings: Omit<PaymentSettings, 'user_id'> = {
  whatsapp_enabled: false,
  whatsapp_number: null,
  whatsapp_accepts_cash: true,
  whatsapp_accepts_credit: true,
  whatsapp_accepts_debit: true,
  whatsapp_accepts_pix: true,
  whatsapp_accepts_transfer: false,
  mercadopago_enabled: false,
  mercadopago_access_token: null,
  mercadopago_public_key: null,
  mercadopago_accepts_credit: true,
  mercadopago_accepts_pix: true,
  mercadopago_pix_discount: 0,
  mercadopago_installments_free: 1,
  pagbank_enabled: false,
  pagbank_token: null,
  pagbank_email: null,
  pagbank_accepts_credit: true,
  pagbank_accepts_pix: true,
};

const PaymentMethodsContent = () => {
  const { user } = useAuth();
  const { primaryColor, buttonBgColor, buttonTextColor } = useTheme();
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Dialog states
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [mercadoPagoDialogOpen, setMercadoPagoDialogOpen] = useState(false);
  const [pagbankDialogOpen, setPagbankDialogOpen] = useState(false);
  
  // Temp form states
  const [tempWhatsappNumber, setTempWhatsappNumber] = useState("");
  const [tempWhatsappAccepts, setTempWhatsappAccepts] = useState({
    cash: true,
    credit: true,
    debit: true,
    pix: true,
    transfer: false,
  });
  
  const [tempMercadoPago, setTempMercadoPago] = useState({
    accessToken: "",
    publicKey: "",
    acceptsCredit: true,
    acceptsPix: true,
    pixDiscount: 0,
    installmentsFree: 1,
  });
  
  const [tempPagbank, setTempPagbank] = useState({
    token: "",
    email: "",
    acceptsCredit: true,
    acceptsPix: true,
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

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

  const toggleWhatsapp = async (enabled: boolean) => {
    if (enabled && !settings?.whatsapp_number) {
      // Open config dialog first
      setTempWhatsappNumber(settings?.whatsapp_number || "");
      setTempWhatsappAccepts({
        cash: settings?.whatsapp_accepts_cash ?? true,
        credit: settings?.whatsapp_accepts_credit ?? true,
        debit: settings?.whatsapp_accepts_debit ?? true,
        pix: settings?.whatsapp_accepts_pix ?? true,
        transfer: settings?.whatsapp_accepts_transfer ?? false,
      });
      setWhatsappDialogOpen(true);
    } else {
      await saveSettings({ whatsapp_enabled: enabled });
    }
  };

  const toggleMercadoPago = async (enabled: boolean) => {
    if (enabled && !settings?.mercadopago_access_token) {
      setTempMercadoPago({
        accessToken: settings?.mercadopago_access_token || "",
        publicKey: settings?.mercadopago_public_key || "",
        acceptsCredit: settings?.mercadopago_accepts_credit ?? true,
        acceptsPix: settings?.mercadopago_accepts_pix ?? true,
        pixDiscount: settings?.mercadopago_pix_discount ?? 0,
        installmentsFree: settings?.mercadopago_installments_free ?? 1,
      });
      setMercadoPagoDialogOpen(true);
    } else {
      await saveSettings({ mercadopago_enabled: enabled });
    }
  };

  const togglePagbank = async (enabled: boolean) => {
    if (enabled && !settings?.pagbank_token) {
      setTempPagbank({
        token: settings?.pagbank_token || "",
        email: settings?.pagbank_email || "",
        acceptsCredit: settings?.pagbank_accepts_credit ?? true,
        acceptsPix: settings?.pagbank_accepts_pix ?? true,
      });
      setPagbankDialogOpen(true);
    } else {
      await saveSettings({ pagbank_enabled: enabled });
    }
  };

  const saveWhatsappConfig = async () => {
    if (!tempWhatsappNumber.trim()) {
      toast.error("Informe o número do WhatsApp");
      return;
    }
    
    // Normaliza o número de WhatsApp com DDI 55
    const normalizedNumber = normalizeWhatsAppNumber(tempWhatsappNumber);
    
    await saveSettings({
      whatsapp_enabled: true,
      whatsapp_number: normalizedNumber,
      whatsapp_accepts_cash: tempWhatsappAccepts.cash,
      whatsapp_accepts_credit: tempWhatsappAccepts.credit,
      whatsapp_accepts_debit: tempWhatsappAccepts.debit,
      whatsapp_accepts_pix: tempWhatsappAccepts.pix,
      whatsapp_accepts_transfer: tempWhatsappAccepts.transfer,
    });
    setWhatsappDialogOpen(false);
  };

  const saveMercadoPagoConfig = async () => {
    if (!tempMercadoPago.accessToken.trim() || !tempMercadoPago.publicKey.trim()) {
      toast.error("Preencha todas as credenciais do Mercado Pago");
      return;
    }
    
    await saveSettings({
      mercadopago_enabled: true,
      mercadopago_access_token: tempMercadoPago.accessToken,
      mercadopago_public_key: tempMercadoPago.publicKey,
      mercadopago_accepts_credit: tempMercadoPago.acceptsCredit,
      mercadopago_accepts_pix: tempMercadoPago.acceptsPix,
      mercadopago_pix_discount: tempMercadoPago.pixDiscount,
      mercadopago_installments_free: tempMercadoPago.installmentsFree,
    });
    setMercadoPagoDialogOpen(false);
  };

  const savePagbankConfig = async () => {
    if (!tempPagbank.token.trim() || !tempPagbank.email.trim()) {
      toast.error("Preencha todas as credenciais do PagBank");
      return;
    }
    
    await saveSettings({
      pagbank_enabled: true,
      pagbank_token: tempPagbank.token,
      pagbank_email: tempPagbank.email,
      pagbank_accepts_credit: tempPagbank.acceptsCredit,
      pagbank_accepts_pix: tempPagbank.acceptsPix,
    });
    setPagbankDialogOpen(false);
  };

  const removeIntegration = async (provider: 'mercadopago' | 'pagbank') => {
    if (provider === 'mercadopago') {
      await saveSettings({
        mercadopago_enabled: false,
        mercadopago_access_token: null,
        mercadopago_public_key: null,
      });
    } else {
      await saveSettings({
        pagbank_enabled: false,
        pagbank_token: null,
        pagbank_email: null,
      });
    }
    toast.success("Integração removida com sucesso");
  };

  const openWhatsappConfig = () => {
    setTempWhatsappNumber(settings?.whatsapp_number || "");
    setTempWhatsappAccepts({
      cash: settings?.whatsapp_accepts_cash ?? true,
      credit: settings?.whatsapp_accepts_credit ?? true,
      debit: settings?.whatsapp_accepts_debit ?? true,
      pix: settings?.whatsapp_accepts_pix ?? true,
      transfer: settings?.whatsapp_accepts_transfer ?? false,
    });
    setWhatsappDialogOpen(true);
  };

  const openMercadoPagoConfig = () => {
    setTempMercadoPago({
      accessToken: settings?.mercadopago_access_token || "",
      publicKey: settings?.mercadopago_public_key || "",
      acceptsCredit: settings?.mercadopago_accepts_credit ?? true,
      acceptsPix: settings?.mercadopago_accepts_pix ?? true,
      pixDiscount: settings?.mercadopago_pix_discount ?? 0,
      installmentsFree: settings?.mercadopago_installments_free ?? 1,
    });
    setMercadoPagoDialogOpen(true);
  };

  const openPagbankConfig = () => {
    setTempPagbank({
      token: settings?.pagbank_token || "",
      email: settings?.pagbank_email || "",
      acceptsCredit: settings?.pagbank_accepts_credit ?? true,
      acceptsPix: settings?.pagbank_accepts_pix ?? true,
    });
    setPagbankDialogOpen(true);
  };

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
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Formas de Pagamento</h2>
          <p className="text-muted-foreground mt-1">
            Configure como você deseja receber os pagamentos dos seus clientes.
          </p>
        </div>

        {/* WhatsApp Payment */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <MessageCircle className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <div>
                  <CardTitle className="text-lg">Pagamento via WhatsApp</CardTitle>
                  <CardDescription>
                    Receba pedidos diretamente no seu WhatsApp
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={settings?.whatsapp_enabled || false}
                onCheckedChange={toggleWhatsapp}
                style={{
                  backgroundColor: settings?.whatsapp_enabled ? primaryColor : undefined,
                }}
              />
            </div>
          </CardHeader>
          {settings?.whatsapp_enabled && (
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">WhatsApp configurado</p>
                  <p className="text-sm text-muted-foreground">{settings.whatsapp_number}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openWhatsappConfig}
                  className="gap-2"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <Settings2 className="h-4 w-4" />
                  Configurar
                </Button>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Como funciona:</p>
                    <p className="mt-1">
                      Ao finalizar a compra, o cliente será redirecionado para o WhatsApp com um resumo do pedido, 
                      valor total e forma de pagamento escolhida. O pagamento é coordenado diretamente entre você e o cliente.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Mercado Pago */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: '#00A1E415' }}
                >
                  <CreditCard className="h-6 w-6" style={{ color: '#00A1E4' }} />
                </div>
                <div>
                  <CardTitle className="text-lg">Mercado Pago</CardTitle>
                  <CardDescription>
                    Aceite cartões e Pix automaticamente
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={settings?.mercadopago_enabled || false}
                onCheckedChange={toggleMercadoPago}
                style={{
                  backgroundColor: settings?.mercadopago_enabled ? primaryColor : undefined,
                }}
              />
            </div>
          </CardHeader>
          {settings?.mercadopago_enabled && settings.mercadopago_access_token && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Taxas */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Taxas informativas</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Cartão de crédito: ~4,99%</p>
                    <p>Pix: ~0,99%</p>
                  </div>
                </div>
                
                {/* Configurações */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Suas configurações</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Desconto no Pix: {settings.mercadopago_pix_discount}%</p>
                    <p>Parcelamento s/ juros: até {settings.mercadopago_installments_free}x</p>
                  </div>
                </div>
              </div>
              
              {/* Atalhos */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openMercadoPagoConfig}
                  className="gap-2"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <Settings2 className="h-4 w-4" />
                  Configurar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open('https://www.mercadopago.com.br/balance', '_blank')}
                >
                  <Banknote className="h-4 w-4" />
                  Ver saldo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open('https://www.mercadopago.com.br', '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Acessar Mercado Pago
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeIntegration('mercadopago')}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover integração
                </Button>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p>O recebimento é feito diretamente na sua conta Mercado Pago. As taxas são de responsabilidade do provedor.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* PagBank */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: '#FFC70015' }}
                >
                  <Building2 className="h-6 w-6" style={{ color: '#FFC700' }} />
                </div>
                <div>
                  <CardTitle className="text-lg">PagBank</CardTitle>
                  <CardDescription>
                    Integração com PagBank para cartões e Pix
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={settings?.pagbank_enabled || false}
                onCheckedChange={togglePagbank}
                style={{
                  backgroundColor: settings?.pagbank_enabled ? primaryColor : undefined,
                }}
              />
            </div>
          </CardHeader>
          {settings?.pagbank_enabled && settings.pagbank_token ? (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Taxas */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Taxas informativas</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Cartão de crédito: ~4,99%</p>
                    <p>Pix: ~0,99%</p>
                  </div>
                </div>
                
                {/* Prazos */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Prazos de recebimento</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Cartão de crédito: 30 dias</p>
                    <p>Pix: Imediato</p>
                  </div>
                </div>
              </div>
              
              {/* Atalhos */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openPagbankConfig}
                  className="gap-2"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <Settings2 className="h-4 w-4" />
                  Configurar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open('https://pagseguro.uol.com.br', '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Acessar PagBank
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeIntegration('pagbank')}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover integração
                </Button>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p>O recebimento é feito diretamente na sua conta PagBank. As taxas são de responsabilidade do provedor.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          ) : !settings?.pagbank_enabled ? (
            <CardContent>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex gap-2">
                  <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Não possui conta PagBank?</p>
                    <p className="mt-1">
                      Crie sua conta gratuitamente em{" "}
                      <a 
                        href="https://pagseguro.uol.com.br" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline font-medium"
                      >
                        pagseguro.uol.com.br
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          ) : null}
        </Card>

        {/* WhatsApp Config Dialog */}
        <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" style={{ color: primaryColor }} />
                Configurar pagamento via WhatsApp
              </DialogTitle>
              <DialogDescription>
                Configure como você deseja receber pagamentos via WhatsApp.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp-number">Número do WhatsApp *</Label>
                <Input
                  id="whatsapp-number"
                  placeholder="+55 11 99999-9999"
                  value={tempWhatsappNumber}
                  onChange={(e) => setTempWhatsappNumber(e.target.value)}
                  style={{ borderColor: primaryColor }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${primaryColor}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Inclua o DDI (+55) e DDD
                </p>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <Label>Formas de pagamento aceitas</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="accepts-cash"
                      checked={tempWhatsappAccepts.cash}
                      onCheckedChange={(checked) => 
                        setTempWhatsappAccepts(prev => ({ ...prev, cash: !!checked }))
                      }
                      style={{ 
                        borderColor: primaryColor,
                        backgroundColor: tempWhatsappAccepts.cash ? primaryColor : undefined 
                      }}
                    />
                    <Label htmlFor="accepts-cash" className="font-normal flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-muted-foreground" />
                      Dinheiro
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="accepts-credit"
                      checked={tempWhatsappAccepts.credit}
                      onCheckedChange={(checked) => 
                        setTempWhatsappAccepts(prev => ({ ...prev, credit: !!checked }))
                      }
                      style={{ 
                        borderColor: primaryColor,
                        backgroundColor: tempWhatsappAccepts.credit ? primaryColor : undefined 
                      }}
                    />
                    <Label htmlFor="accepts-credit" className="font-normal flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      Cartão de crédito
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="accepts-debit"
                      checked={tempWhatsappAccepts.debit}
                      onCheckedChange={(checked) => 
                        setTempWhatsappAccepts(prev => ({ ...prev, debit: !!checked }))
                      }
                      style={{ 
                        borderColor: primaryColor,
                        backgroundColor: tempWhatsappAccepts.debit ? primaryColor : undefined 
                      }}
                    />
                    <Label htmlFor="accepts-debit" className="font-normal flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      Cartão de débito
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="accepts-pix"
                      checked={tempWhatsappAccepts.pix}
                      onCheckedChange={(checked) => 
                        setTempWhatsappAccepts(prev => ({ ...prev, pix: !!checked }))
                      }
                      style={{ 
                        borderColor: primaryColor,
                        backgroundColor: tempWhatsappAccepts.pix ? primaryColor : undefined 
                      }}
                    />
                    <Label htmlFor="accepts-pix" className="font-normal flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-muted-foreground" />
                      Pix
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="accepts-transfer"
                      checked={tempWhatsappAccepts.transfer}
                      onCheckedChange={(checked) => 
                        setTempWhatsappAccepts(prev => ({ ...prev, transfer: !!checked }))
                      }
                      style={{ 
                        borderColor: primaryColor,
                        backgroundColor: tempWhatsappAccepts.transfer ? primaryColor : undefined 
                      }}
                    />
                    <Label htmlFor="accepts-transfer" className="font-normal flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Transferência bancária
                    </Label>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setWhatsappDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={saveWhatsappConfig}
                disabled={saving}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mercado Pago Config Dialog */}
        <Dialog open={mercadoPagoDialogOpen} onOpenChange={setMercadoPagoDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" style={{ color: '#00A1E4' }} />
                Configurar Mercado Pago
              </DialogTitle>
              <DialogDescription>
                Conecte sua conta Mercado Pago para receber pagamentos.
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
              
              <Separator />
              
              <div className="space-y-3">
                <Label>Métodos aceitos</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mp-accepts-credit"
                      checked={tempMercadoPago.acceptsCredit}
                      onCheckedChange={(checked) => 
                        setTempMercadoPago(prev => ({ ...prev, acceptsCredit: !!checked }))
                      }
                      style={{ 
                        borderColor: primaryColor,
                        backgroundColor: tempMercadoPago.acceptsCredit ? primaryColor : undefined 
                      }}
                    />
                    <Label htmlFor="mp-accepts-credit" className="font-normal">
                      Cartão de crédito
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mp-accepts-pix"
                      checked={tempMercadoPago.acceptsPix}
                      onCheckedChange={(checked) => 
                        setTempMercadoPago(prev => ({ ...prev, acceptsPix: !!checked }))
                      }
                      style={{ 
                        borderColor: primaryColor,
                        backgroundColor: tempMercadoPago.acceptsPix ? primaryColor : undefined 
                      }}
                    />
                    <Label htmlFor="mp-accepts-pix" className="font-normal">
                      Pix
                    </Label>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mp-pix-discount" className="flex items-center gap-1">
                    <Percent className="h-3 w-3" />
                    Desconto no Pix
                  </Label>
                  <Input
                    id="mp-pix-discount"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="0"
                    value={tempMercadoPago.pixDiscount}
                    onChange={(e) => setTempMercadoPago(prev => ({ ...prev, pixDiscount: Number(e.target.value) }))}
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
                  <Label htmlFor="mp-installments">Parcelamento s/ juros</Label>
                  <Input
                    id="mp-installments"
                    type="number"
                    min="1"
                    max="12"
                    placeholder="1"
                    value={tempMercadoPago.installmentsFree}
                    onChange={(e) => setTempMercadoPago(prev => ({ ...prev, installmentsFree: Number(e.target.value) }))}
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
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setMercadoPagoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={saveMercadoPagoConfig}
                disabled={saving}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PagBank Config Dialog */}
        <Dialog open={pagbankDialogOpen} onOpenChange={setPagbankDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" style={{ color: '#FFC700' }} />
                Configurar PagBank
              </DialogTitle>
              <DialogDescription>
                Conecte sua conta PagBank para receber pagamentos.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
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
              
              <div className="space-y-2">
                <Label htmlFor="pb-token">Token de integração *</Label>
                <Input
                  id="pb-token"
                  type="password"
                  placeholder="Token PagBank"
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
              
              <Separator />
              
              <div className="space-y-3">
                <Label>Métodos aceitos</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="pb-accepts-credit"
                      checked={tempPagbank.acceptsCredit}
                      onCheckedChange={(checked) => 
                        setTempPagbank(prev => ({ ...prev, acceptsCredit: !!checked }))
                      }
                      style={{ 
                        borderColor: primaryColor,
                        backgroundColor: tempPagbank.acceptsCredit ? primaryColor : undefined 
                      }}
                    />
                    <Label htmlFor="pb-accepts-credit" className="font-normal">
                      Cartão de crédito
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="pb-accepts-pix"
                      checked={tempPagbank.acceptsPix}
                      onCheckedChange={(checked) => 
                        setTempPagbank(prev => ({ ...prev, acceptsPix: !!checked }))
                      }
                      style={{ 
                        borderColor: primaryColor,
                        backgroundColor: tempPagbank.acceptsPix ? primaryColor : undefined 
                      }}
                    />
                    <Label htmlFor="pb-accepts-pix" className="font-normal">
                      Pix
                    </Label>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPagbankDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={savePagbankConfig}
                disabled={saving}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                {saving ? "Salvando..." : "Salvar Configurações"}
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
