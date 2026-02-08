import { useState, useEffect, useRef, useCallback } from "react";
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
  Calendar,
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Mail
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import CheckoutIdentificationCard, { GuestData } from "@/components/checkout/CheckoutIdentificationCard";

// Cores da ShopDrive
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
type CheckoutStep = "form" | "pix" | "boleto" | "success" | "success_new_account";

interface CardFormData {
  cardNumber: string;
  holderName: string;
  expirationMonth: string;
  expirationYear: string;
  cvv: string;
}

interface PixData {
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  amount: number;
}

interface BoletoData {
  url: string;
  barcode: string;
  digitableLine: string;
  expiresAt: string;
  amount: number;
}

declare global {
  interface Window {
    MercadoPago: any;
  }
}

const AdminSubscriptionCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const mpRef = useRef<any>(null);

  // Parâmetros da URL
  const planParam = (searchParams.get("plano") as PlanId) || "pro";
  const cycleParam = (searchParams.get("ciclo") as BillingCycle) || "monthly";
  const originParam = searchParams.get("origem") || "checkout";

  // Estados
  const [plan, setPlan] = useState<PlanId>(planParam);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(cycleParam);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit_card");
  const [recurringConsent, setRecurringConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [step, setStep] = useState<CheckoutStep>("form");
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [mpPublicKey, setMpPublicKey] = useState<string | null>(null);
  const [mpLoaded, setMpLoaded] = useState(false);

  // Dados de pagamento
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [boletoData, setBoletoData] = useState<BoletoData | null>(null);

  // Form do cartão
  const [cardForm, setCardForm] = useState<CardFormData>({
    cardNumber: "",
    holderName: "",
    expirationMonth: "",
    expirationYear: "",
    cvv: ""
  });

  // Guest checkout states
  const [isIdentificationValid, setIsIdentificationValid] = useState(false);
  const [guestData, setGuestData] = useState<GuestData | null>(null);
  const [createdUserEmail, setCreatedUserEmail] = useState<string | null>(null);

  // Check if user is logged in for identification validation
  const isUserLoggedIn = !!(user && session);

  // Carregar SDK do Mercado Pago
  useEffect(() => {
    const loadMercadoPagoSDK = async () => {
      // Buscar public key do gateway master
      const { data: gateway, error } = await supabase
        .from("master_payment_gateways")
        .select("mercadopago_public_key")
        .eq("is_active", true)
        .eq("is_default", true)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar gateway de pagamento:", error);
        toast.error("Erro ao carregar configurações de pagamento. Recarregue a página.");
        return;
      }

      if (!gateway?.mercadopago_public_key) {
        console.warn("MercadoPago public key não encontrada - verifique as políticas RLS e configurações do gateway");
        toast.error("Configuração de pagamento não encontrada. Contate o suporte.");
        return;
      }

      setMpPublicKey(gateway.mercadopago_public_key);

      // Carregar SDK se ainda não carregado
      if (!window.MercadoPago) {
        const script = document.createElement("script");
        script.src = "https://sdk.mercadopago.com/js/v2";
        script.async = true;
        script.onload = () => {
          mpRef.current = new window.MercadoPago(gateway.mercadopago_public_key, {
            locale: "pt-BR"
          });
          setMpLoaded(true);
          console.log("MercadoPago SDK loaded successfully");
        };
        script.onerror = () => {
          console.error("Falha ao carregar script do MercadoPago");
          toast.error("Erro ao carregar SDK de pagamento. Verifique sua conexão.");
        };
        document.body.appendChild(script);
      } else {
        mpRef.current = new window.MercadoPago(gateway.mercadopago_public_key, {
          locale: "pt-BR"
        });
        setMpLoaded(true);
      }
    };

    loadMercadoPagoSDK();
  }, []);

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

  // Reset payment method quando mudar ciclo
  useEffect(() => {
    if (billingCycle === "monthly" && paymentMethod !== "credit_card") {
      setPaymentMethod("credit_card");
    }
  }, [billingCycle]);

  // Polling para verificar status do pagamento (PIX/Boleto)
  useEffect(() => {
    if ((step === "pix" || step === "boleto") && subscriptionId) {
      const interval = setInterval(async () => {
        try {
          const { data, error } = await supabase.functions.invoke("check-master-subscription-status", {
            body: { subscriptionId }
          });

          if (data?.subscription?.status === "active") {
            setStep("success");
            toast.success("Pagamento confirmado! Sua assinatura está ativa.");
            clearInterval(interval);
          }
        } catch (error) {
          console.error("Error checking status:", error);
        }
      }, 5000); // Check every 5 seconds

      return () => clearInterval(interval);
    }
  }, [step, subscriptionId]);

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

  const detectCardBrand = (cardNumber: string): string => {
    const cleaned = cardNumber.replace(/\D/g, "");
    if (/^4/.test(cleaned)) return "visa";
    if (/^5[1-5]/.test(cleaned)) return "master";
    if (/^3[47]/.test(cleaned)) return "amex";
    if (/^6(?:011|5)/.test(cleaned)) return "discover";
    if (/^(?:2131|1800|35)/.test(cleaned)) return "jcb";
    if (/^3(?:0[0-5]|[68])/.test(cleaned)) return "diners";
    if (/^(636368|636369|438935|504175|451416|636297|5067|4576|4011)/.test(cleaned)) return "elo";
    if (/^(50|6[04-9])/.test(cleaned)) return "hipercard";
    return "visa";
  };

  const canProceed = () => {
    // Check identification - must be logged in OR have valid guest data
    if (!isUserLoggedIn && !isIdentificationValid) return false;
    
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

  const tokenizeCard = async (): Promise<{ token: string; paymentMethodId: string } | null> => {
    if (!mpRef.current || !mpLoaded) {
      console.error("MercadoPago SDK not loaded");
      toast.error("SDK de pagamento não carregado. Aguarde ou recarregue a página.");
      return null;
    }

    try {
      const cardNumber = cardForm.cardNumber.replace(/\s/g, "");
      const cardBrand = detectCardBrand(cardNumber);

      // Criar token usando SDK
      const cardTokenData = {
        cardNumber: cardNumber,
        cardholderName: cardForm.holderName,
        cardExpirationMonth: cardForm.expirationMonth,
        cardExpirationYear: `20${cardForm.expirationYear}`,
        securityCode: cardForm.cvv,
        identificationType: "CPF",
        identificationNumber: userProfile?.cpf_cnpj?.replace(/\D/g, "") || "00000000000",
      };

      const response = await mpRef.current.createCardToken(cardTokenData);
      
      if (response.id) {
        console.log("Card tokenized successfully:", response.id);
        return {
          token: response.id,
          paymentMethodId: cardBrand
        };
      } else {
        throw new Error("Failed to tokenize card");
      }
    } catch (error: any) {
      console.error("Card tokenization error:", error);
      toast.error("Erro ao processar dados do cartão. Verifique os dados informados.");
      return null;
    }
  };

  const handleSubmit = async () => {
    // Check if user is logged in or has valid guest data
    const isGuest = !isUserLoggedIn && guestData;
    
    if (!isUserLoggedIn && !guestData) {
      toast.error("Preencha seus dados de identificação para continuar");
      return;
    }

    if (!canProceed()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsProcessing(true);

    try {
      let cardToken: string | undefined;
      let paymentMethodId: string | undefined;
      let cardBrand: string | undefined;
      let cardLastFour: string | undefined;
      let userId = user?.id;

      // Tokenizar cartão se necessário
      if (paymentMethod === "credit_card") {
        const tokenResult = await tokenizeCard();
        if (!tokenResult) {
          setIsProcessing(false);
          return;
        }
        cardToken = tokenResult.token;
        paymentMethodId = tokenResult.paymentMethodId;
        cardBrand = detectCardBrand(cardForm.cardNumber);
        cardLastFour = cardForm.cardNumber.replace(/\s/g, "").slice(-4);
      }

      // If guest checkout, create account first (without password)
      if (isGuest && guestData) {
        try {
          // Create user with temporary password (will be reset via email)
          const tempPassword = crypto.randomUUID();
          
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: guestData.email,
            password: tempPassword,
            options: {
              data: {
                full_name: guestData.fullName,
                store_name: guestData.storeName,
              },
              emailRedirectTo: `${window.location.origin}/lojista`,
            },
          });

          if (signUpError) {
            throw new Error(signUpError.message);
          }

          if (!signUpData.user) {
            throw new Error("Erro ao criar conta. Tente novamente.");
          }

          userId = signUpData.user.id;
          setCreatedUserEmail(guestData.email);

          // Send password reset email so user can set their own password
          await supabase.auth.resetPasswordForEmail(guestData.email, {
            redirectTo: `${window.location.origin}/login?mode=recovery`,
          });

          console.log("checkout_account_auto_created", { email: guestData.email });
        } catch (error: any) {
          console.error("Error creating account:", error);
          toast.error(error.message || "Erro ao criar conta");
          setIsProcessing(false);
          return;
        }
      }

      if (!userId) {
        toast.error("Erro: usuário não identificado");
        setIsProcessing(false);
        return;
      }

      // Chamar edge function para criar assinatura
      const { data, error } = await supabase.functions.invoke("create-master-subscription", {
        body: {
          userId,
          planId: plan,
          billingCycle,
          paymentMethod,
          cardToken,
          paymentMethodId,
          cardBrand,
          cardLastFour,
          installments: 1,
          recurringConsent,
          origin: originParam,
          guestCheckout: isGuest,
        }
      });

      if (error) {
        // Handle 409 conflict - existing subscription
        if (error.message?.includes("409")) {
          toast.error("Você já possui uma assinatura ativa ou pendente. Acesse o painel para gerenciá-la.");
          setTimeout(() => {
            navigate("/lojista/financeiro");
          }, 2000);
          return;
        }
        throw new Error(error.message || "Erro ao processar assinatura");
      }

      if (data?.error) {
        // Handle existing subscription error from response body
        if (data.existingSubscriptionId) {
          toast.error("Você já possui uma assinatura. Redirecionando para gerenciamento...");
          setTimeout(() => {
            navigate("/lojista/financeiro");
          }, 2000);
          return;
        }
        throw new Error(data.error);
      }

      console.log("Subscription response:", data);
      console.log("checkout_payment_success", { plan, billingCycle, paymentMethod });

      setSubscriptionId(data.subscription?.id);

      // Tratar resposta baseado no método de pagamento
      if (data.payment?.status === "approved" || data.subscription?.status === "active") {
        if (isGuest) {
          setStep("success_new_account");
        } else {
          setStep("success");
        }
        toast.success("Assinatura ativada com sucesso!");
      } else if (data.payment?.paymentMethod === "pix") {
        setPixData({
          qrCode: data.payment.pixQrCode,
          qrCodeBase64: data.payment.pixQrCodeBase64,
          expiresAt: data.payment.pixExpiresAt,
          amount: data.payment.amount
        });
        setStep("pix");
        toast.success("PIX gerado! Escaneie o QR Code para pagar.");
      } else if (data.payment?.paymentMethod === "boleto") {
        setBoletoData({
          url: data.payment.boletoUrl,
          barcode: data.payment.boletoBarcode,
          digitableLine: data.payment.boletoDigitableLine,
          expiresAt: data.payment.boletoExpiresAt,
          amount: data.payment.amount
        });
        setStep("boleto");
        toast.success("Boleto gerado! Pague até a data de vencimento.");
      } else if (data.payment?.status === "pending") {
        toast.info("Pagamento pendente de confirmação.");
      } else {
        toast.error(data.message || "Erro ao processar pagamento");
      }
    } catch (error: any) {
      console.error("Error processing subscription:", error);
      toast.error(error.message || "Erro ao processar assinatura");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const formatExpirationTime = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Expirado";
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Render PIX Step
  if (step === "pix" && pixData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <QrCode className="h-12 w-12 mx-auto mb-2" style={{ color: VM_PRIMARY }} />
            <CardTitle>Pague com Pix</CardTitle>
            <p className="text-sm text-muted-foreground">
              Escaneie o QR Code ou copie o código para pagar
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code */}
            <div className="flex justify-center">
              {pixData.qrCodeBase64 ? (
                <img 
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`} 
                  alt="QR Code Pix" 
                  className="w-48 h-48"
                />
              ) : (
                <div className="w-48 h-48 bg-gray-200 flex items-center justify-center rounded-lg">
                  <QrCode className="h-24 w-24 text-gray-400" />
                </div>
              )}
            </div>

            {/* Código Copia e Cola */}
            <div className="space-y-2">
              <Label className="text-sm">Código Pix (Copia e Cola)</Label>
              <div className="flex gap-2">
                <Input 
                  value={pixData.qrCode} 
                  readOnly 
                  className="text-xs"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(pixData.qrCode)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Timer e Valor */}
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span>Expira em: {formatExpirationTime(pixData.expiresAt)}</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold" style={{ color: VM_PRIMARY }}>
                  R$ {pixData.amount.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>

            {/* Aguardando pagamento */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Aguardando confirmação do pagamento...</span>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setStep("form")}
            >
              Voltar e escolher outro método
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Boleto Step
  if (step === "boleto" && boletoData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-2" style={{ color: VM_PRIMARY }} />
            <CardTitle>Boleto Gerado</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pague o boleto até a data de vencimento
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Linha Digitável */}
            <div className="space-y-2">
              <Label className="text-sm">Linha Digitável</Label>
              <div className="flex gap-2">
                <Input 
                  value={boletoData.digitableLine || boletoData.barcode} 
                  readOnly 
                  className="text-xs"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(boletoData.digitableLine || boletoData.barcode)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Vencimento e Valor */}
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div className="text-sm">
                <span className="text-muted-foreground">Vencimento:</span>
                <br />
                <span className="font-medium">
                  {new Date(boletoData.expiresAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold" style={{ color: VM_PRIMARY }}>
                  R$ {boletoData.amount.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>

            {/* Botão abrir boleto */}
            {boletoData.url && (
              <Button 
                className="w-full"
                style={{ backgroundColor: VM_PRIMARY }}
                onClick={() => window.open(boletoData.url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Boleto
              </Button>
            )}

            {/* Aguardando pagamento */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Aguardando confirmação do pagamento...</span>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setStep("form")}
            >
              Voltar e escolher outro método
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Success Step (for logged in users)
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold mb-2">Assinatura Ativada!</h2>
              <p className="text-muted-foreground">
                Bem-vindo ao plano {plan.toUpperCase()}! Sua assinatura está ativa.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Plano</span>
                <span className="font-medium">{plan.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Ciclo</span>
                <span className="font-medium">{billingCycle === "monthly" ? "Mensal" : "Anual"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor</span>
                <span className="font-medium">R$ {totalAmount.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            <Button 
              className="w-full"
              style={{ backgroundColor: VM_PRIMARY }}
              onClick={() => navigate("/lojista")}
            >
              Ir para o Painel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Success Step for New Account (guest checkout)
  if (step === "success_new_account") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold mb-2">Pagamento Confirmado!</h2>
              <p className="text-muted-foreground">
                Sua assinatura do plano {plan.toUpperCase()} está ativa.
              </p>
            </div>

            {/* Email notification */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-left">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-purple-800">
                    Enviamos um link para definir sua senha
                  </p>
                  <p className="text-sm text-purple-700 mt-1">
                    Verifique sua caixa de entrada em <strong>{createdUserEmail}</strong> para acessar seu painel.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Plano</span>
                <span className="font-medium">{plan.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Ciclo</span>
                <span className="font-medium">{billingCycle === "monthly" ? "Mensal" : "Anual"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor</span>
                <span className="font-medium">R$ {totalAmount.toFixed(2).replace(".", ",")}</span>
              </div>
              {guestData && (
                <>
                  <Separator className="my-2" />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Loja</span>
                    <span className="font-medium">{guestData.storeName}</span>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <Button 
                className="w-full"
                style={{ backgroundColor: VM_PRIMARY }}
                onClick={() => navigate("/login")}
              >
                Fazer login
              </Button>
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => navigate("/")}
              >
                Voltar para a página inicial
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Função para voltar baseado na origem
  const handleGoBack = () => {
    if (originParam === "landing") {
      navigate("/");
    } else if (originParam === "painel_lojista") {
      navigate("/lojista/financeiro");
    } else {
      navigate(-1);
    }
  };

  // Render Form Step (default)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoBack}
                className="mr-2 hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Crown className="h-8 w-8" style={{ color: VM_PRIMARY }} />
              <div>
                <h1 className="text-xl font-bold" style={{ color: VM_PRIMARY }}>
                  Checkout de Assinatura
                </h1>
                <p className="text-sm text-muted-foreground">ShopDrive</p>
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
        {/* Identification Card - Above the 3 columns */}
        <CheckoutIdentificationCard
          user={user}
          session={session}
          userProfile={userProfile}
          onProfileUpdate={setUserProfile}
          onValidationChange={setIsIdentificationValid}
          onGuestDataChange={setGuestData}
        />

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

                  {!mpLoaded && mpPublicKey && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Carregando SDK de pagamento...
                    </div>
                  )}
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
                      Autorizo a ShopDrive a realizar cobranças mensais recorrentes no cartão de crédito informado, 
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
                disabled={!canProceed() || isProcessing || (paymentMethod === "credit_card" && !mpLoaded && !!mpPublicKey)}
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
