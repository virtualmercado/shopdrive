import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  CreditCard, 
  QrCode, 
  FileText, 
  Check, 
  Shield, 
  Lock,
  Crown,
  Zap,
  RefreshCw,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// Cores da VirtualMercado
const VM_PRIMARY = "#6a1b9a";
const VM_ORANGE = "#f97316";

// Preços base dos planos
const PLAN_PRICES = {
  pro: 29.97,
  premium: 49.97
};

// Recursos dos planos
const PLAN_FEATURES = {
  pro: [
    "Até 150 produtos cadastrados",
    "Até 300 clientes ativos",
    "Personalização total do seu site",
    "Cupons de desconto ilimitado"
  ],
  premium: [
    "Produtos ilimitados",
    "Clientes ilimitados",
    "Editor de imagens com IA",
    "Vínculo de domínio próprio",
    "Suporte dedicado via e-mail e WhatsApp"
  ]
};

type PaymentMethod = "credit_card" | "pix" | "boleto";
type BillingCycle = "monthly" | "annual";
type PlanId = "pro" | "premium";

interface CardFormData {
  cardNumber: string;
  holderName: string;
  expirationMonth: string;
  expirationYear: string;
  cvv: string;
}

const AdminSubscriptionCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Parâmetros da URL
  const planParam = (searchParams.get("plano") as PlanId) || "pro";
  const cycleParam = (searchParams.get("ciclo") as BillingCycle) || "monthly";
  const originParam = searchParams.get("origem") || "painel_lojista";

  // Estados
  const [plan, setPlan] = useState<PlanId>(planParam);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(cycleParam);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit_card");
  const [recurringConsent, setRecurringConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Form do cartão
  const [cardForm, setCardForm] = useState<CardFormData>({
    cardNumber: "",
    holderName: "",
    expirationMonth: "",
    expirationYear: "",
    cvv: ""
  });

  // Buscar perfil do usuário
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) setUserProfile(data);
    };
    fetchProfile();
  }, [user]);

  // Cálculos de preço
  const monthlyPrice = PLAN_PRICES[plan];
  const annualPrice = monthlyPrice * 12 * 0.7; // 30% desconto
  const totalAmount = billingCycle === "monthly" ? monthlyPrice : annualPrice;
  const savings = billingCycle === "annual" ? monthlyPrice * 12 - annualPrice : 0;

  // Métodos de pagamento disponíveis com base no ciclo
  const availablePaymentMethods = billingCycle === "monthly" 
    ? ["credit_card"] 
    : ["credit_card", "pix", "boleto"];

  // Reset payment method quando mudar ciclo
  useEffect(() => {
    if (billingCycle === "monthly" && paymentMethod !== "credit_card") {
      setPaymentMethod("credit_card");
    }
  }, [billingCycle]);

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const match = cleaned.match(/.{1,4}/g);
    return match ? match.join(" ") : cleaned;
  };

  const handleCardChange = (field: keyof CardFormData, value: string) => {
    if (field === "cardNumber") {
      value = formatCardNumber(value);
    }
    setCardForm(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    if (!termsAccepted) return false;
    if (billingCycle === "monthly" && !recurringConsent) return false;
    if (paymentMethod === "credit_card") {
      const { cardNumber, holderName, expirationMonth, expirationYear, cvv } = cardForm;
      if (!cardNumber || !holderName || !expirationMonth || !expirationYear || !cvv) {
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para assinar um plano");
      navigate("/login");
      return;
    }

    if (!canProceed()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsProcessing(true);

    try {
      // Aqui será implementada a lógica de pagamento real na Fase 2
      toast.info("Processando pagamento... (Fase 2 - em desenvolvimento)");
      
      // Simular delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success("Estrutura do checkout pronta! Integração com gateway será implementada na Fase 2.");
    } catch (error: any) {
      console.error("Error processing subscription:", error);
      toast.error(error.message || "Erro ao processar assinatura");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8" style={{ color: VM_PRIMARY }} />
              <div>
                <h1 className="text-xl font-bold" style={{ color: VM_PRIMARY }}>
                  Checkout de Assinatura
                </h1>
                <p className="text-sm text-muted-foreground">VirtualMercado</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Ambiente Seguro</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1 - Plano */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" style={{ color: VM_ORANGE }} />
                Seu Plano
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Seletor de Plano */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Escolha o plano</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["pro", "premium"] as PlanId[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlan(p)}
                      className={cn(
                        "p-4 rounded-lg border-2 text-left transition-all",
                        plan === p 
                          ? "border-[#6a1b9a] bg-purple-50" 
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="font-bold uppercase" style={{ color: plan === p ? VM_PRIMARY : undefined }}>
                        {p}
                      </div>
                      <div className="text-lg font-semibold mt-1">
                        R$ {PLAN_PRICES[p].toFixed(2).replace(".", ",")}
                        <span className="text-xs font-normal text-muted-foreground">/mês</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seletor de Ciclo */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Ciclo de cobrança</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all relative",
                      billingCycle === "monthly" 
                        ? "border-[#6a1b9a] bg-purple-50" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      <span className="font-medium">Mensal</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Cobrança recorrente
                    </div>
                  </button>
                  <button
                    onClick={() => setBillingCycle("annual")}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all relative",
                      billingCycle === "annual" 
                        ? "border-[#6a1b9a] bg-purple-50" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <Badge 
                      className="absolute -top-2 -right-2 text-xs"
                      style={{ backgroundColor: VM_ORANGE }}
                    >
                      -30%
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">Anual</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Pagamento único
                    </div>
                  </button>
                </div>
              </div>

              <Separator />

              {/* Benefícios do Plano */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Benefícios inclusos</Label>
                <div className="space-y-2">
                  {PLAN_FEATURES[plan].map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aviso de Cobrança */}
              <div 
                className={cn(
                  "p-3 rounded-lg text-sm",
                  billingCycle === "monthly" 
                    ? "bg-blue-50 text-blue-800 border border-blue-200" 
                    : "bg-green-50 text-green-800 border border-green-200"
                )}
              >
                {billingCycle === "monthly" ? (
                  <div className="flex items-start gap-2">
                    <RefreshCw className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>O pagamento será cobrado automaticamente todos os meses no cartão informado.</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Pagamento único. Não recorrente. Você economiza R$ {savings.toFixed(2).replace(".", ",")}!</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Coluna 2 - Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" style={{ color: VM_ORANGE }} />
                Forma de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Métodos de Pagamento */}
              <RadioGroup 
                value={paymentMethod} 
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                className="space-y-3"
              >
                <div 
                  className={cn(
                    "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    paymentMethod === "credit_card" 
                      ? "border-[#6a1b9a] bg-purple-50" 
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => setPaymentMethod("credit_card")}
                >
                  <RadioGroupItem value="credit_card" id="credit_card" />
                  <Label htmlFor="credit_card" className="flex items-center gap-2 cursor-pointer">
                    <CreditCard className="h-5 w-5" />
                    Cartão de Crédito
                  </Label>
                </div>

                {billingCycle === "annual" && (
                  <>
                    <div 
                      className={cn(
                        "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                        paymentMethod === "pix" 
                          ? "border-[#6a1b9a] bg-purple-50" 
                          : "border-gray-200 hover:border-gray-300"
                      )}
                      onClick={() => setPaymentMethod("pix")}
                    >
                      <RadioGroupItem value="pix" id="pix" />
                      <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer">
                        <QrCode className="h-5 w-5" />
                        Pix
                      </Label>
                    </div>

                    <div 
                      className={cn(
                        "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                        paymentMethod === "boleto" 
                          ? "border-[#6a1b9a] bg-purple-50" 
                          : "border-gray-200 hover:border-gray-300"
                      )}
                      onClick={() => setPaymentMethod("boleto")}
                    >
                      <RadioGroupItem value="boleto" id="boleto" />
                      <Label htmlFor="boleto" className="flex items-center gap-2 cursor-pointer">
                        <FileText className="h-5 w-5" />
                        Boleto Bancário
                      </Label>
                    </div>
                  </>
                )}
              </RadioGroup>

              {/* Formulário do Cartão */}
              {paymentMethod === "credit_card" && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="cardNumber">Número do Cartão</Label>
                    <Input
                      id="cardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={cardForm.cardNumber}
                      onChange={(e) => handleCardChange("cardNumber", e.target.value)}
                      maxLength={19}
                    />
                  </div>
                  <div>
                    <Label htmlFor="holderName">Nome no Cartão</Label>
                    <Input
                      id="holderName"
                      placeholder="Como está impresso no cartão"
                      value={cardForm.holderName}
                      onChange={(e) => handleCardChange("holderName", e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="expirationMonth">Mês</Label>
                      <Input
                        id="expirationMonth"
                        placeholder="MM"
                        value={cardForm.expirationMonth}
                        onChange={(e) => handleCardChange("expirationMonth", e.target.value)}
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="expirationYear">Ano</Label>
                      <Input
                        id="expirationYear"
                        placeholder="AA"
                        value={cardForm.expirationYear}
                        onChange={(e) => handleCardChange("expirationYear", e.target.value)}
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input
                        id="cvv"
                        placeholder="000"
                        value={cardForm.cvv}
                        onChange={(e) => handleCardChange("cvv", e.target.value)}
                        maxLength={4}
                        type="password"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pix Info */}
              {paymentMethod === "pix" && (
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <QrCode className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Após confirmar, você receberá um QR Code Pix para pagamento.
                  </p>
                </div>
              )}

              {/* Boleto Info */}
              {paymentMethod === "boleto" && (
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Após confirmar, você receberá o boleto para pagamento. Vencimento em 3 dias úteis.
                  </p>
                </div>
              )}

              {/* Consentimento de Recorrência (apenas mensal) */}
              {billingCycle === "monthly" && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="recurring-consent"
                      checked={recurringConsent}
                      onCheckedChange={(checked) => setRecurringConsent(checked as boolean)}
                    />
                    <Label htmlFor="recurring-consent" className="text-sm leading-relaxed cursor-pointer">
                      Autorizo a VirtualMercado a realizar cobranças mensais recorrentes no cartão de crédito informado, 
                      no valor do plano escolhido, até que eu cancele a assinatura, conforme os{" "}
                      <a href="/termos-de-uso" target="_blank" className="text-[#6a1b9a] underline">
                        Termos de Uso
                      </a>.
                    </Label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coluna 3 - Confirmação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" style={{ color: VM_ORANGE }} />
                Confirmação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dados do Usuário */}
              {userProfile && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Seus dados</Label>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                    <p><strong>Nome:</strong> {userProfile.full_name}</p>
                    <p><strong>E-mail:</strong> {userProfile.email}</p>
                    {userProfile.store_name && (
                      <p><strong>Loja:</strong> {userProfile.store_name}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Resumo do Pedido */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Resumo do pedido</Label>
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Plano {plan.toUpperCase()}</span>
                    <span className="text-sm font-medium">
                      R$ {monthlyPrice.toFixed(2).replace(".", ",")}/mês
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm">Ciclo</span>
                    <span className="text-sm font-medium">
                      {billingCycle === "monthly" ? "Mensal" : "Anual"}
                    </span>
                  </div>

                  {billingCycle === "annual" && (
                    <div className="flex justify-between text-green-600">
                      <span className="text-sm">Desconto (30%)</span>
                      <span className="text-sm font-medium">
                        -R$ {savings.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="font-bold">Total</span>
                    <div className="text-right">
                      <span className="text-xl font-bold" style={{ color: VM_PRIMARY }}>
                        R$ {totalAmount.toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-sm text-muted-foreground block">
                        {billingCycle === "monthly" ? "por mês" : "por ano"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Termos */}
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                  Li e aceito os{" "}
                  <a href="/termos-de-uso" target="_blank" className="text-[#6a1b9a] underline">
                    Termos de Uso
                  </a>{" "}
                  e a{" "}
                  <a href="/politica-de-privacidade" target="_blank" className="text-[#6a1b9a] underline">
                    Política de Privacidade
                  </a>.
                </Label>
              </div>

              {/* Botão Assinar */}
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isProcessing}
                className="w-full h-12 text-lg"
                style={{ 
                  backgroundColor: canProceed() ? VM_PRIMARY : undefined,
                  opacity: canProceed() ? 1 : 0.5
                }}
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Processando...
                  </div>
                ) : (
                  <>
                    <Lock className="h-5 w-5 mr-2" />
                    Assinar Plano
                  </>
                )}
              </Button>

              {/* Selos de Segurança */}
              <div className="flex items-center justify-center gap-4 pt-4">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  SSL
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  Pagamento Seguro
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminSubscriptionCheckout;
