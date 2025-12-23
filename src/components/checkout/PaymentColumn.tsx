import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Shield, Lock, CheckCircle } from "lucide-react";
import pixLogo from "@/assets/pix-logo.png";
import whatsappLogo from "@/assets/whatsapp-logo.svg";
import creditCardIllustration from "@/assets/credit-card-illustration.png";

type PaymentMethod = "pix" | "cartao_credito" | "boleto" | "whatsapp";

interface PaymentColumnProps {
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  paymentSettings: {
    pix_enabled?: boolean;
    pix_provider?: string;
    pix_discount_percent?: number;
    credit_card_enabled?: boolean;
    credit_card_provider?: string;
    credit_card_installments_no_interest?: number;
    boleto_enabled?: boolean;
    boleto_provider?: string;
    whatsapp_enabled?: boolean;
    whatsapp_number?: string;
    mercadopago_enabled?: boolean;
    mercadopago_accepts_pix?: boolean;
    mercadopago_accepts_credit?: boolean;
    pagbank_enabled?: boolean;
    pagbank_accepts_pix?: boolean;
    pagbank_accepts_credit?: boolean;
  } | null;
  total: number;
  subtotal: number;
  pixDiscountAmount: number;
  primaryColor: string;
  loading: boolean;
  onFinalize: () => void;
  isFormValid: boolean;
}

interface CardFormData {
  number: string;
  expiry: string;
  name: string;
  cvv: string;
  installments: string;
}

export const PaymentColumn = ({
  paymentMethod,
  onPaymentMethodChange,
  paymentSettings,
  total,
  subtotal,
  pixDiscountAmount,
  primaryColor,
  loading,
  onFinalize,
  isFormValid,
}: PaymentColumnProps) => {
  const [cardForm, setCardForm] = useState<CardFormData>({
    number: "",
    expiry: "",
    name: "",
    cvv: "",
    installments: "1",
  });
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);

  // Check if payment methods are enabled
  const isPixEnabled = paymentSettings?.pix_enabled || 
    (paymentSettings?.mercadopago_enabled && paymentSettings?.mercadopago_accepts_pix) ||
    (paymentSettings?.pagbank_enabled && paymentSettings?.pagbank_accepts_pix);
  
  const isCreditCardEnabled = paymentSettings?.credit_card_enabled ||
    (paymentSettings?.mercadopago_enabled && paymentSettings?.mercadopago_accepts_credit) ||
    (paymentSettings?.pagbank_enabled && paymentSettings?.pagbank_accepts_credit);
  
  const isBoletoEnabled = paymentSettings?.boleto_enabled;
  
  const pixDiscount = paymentSettings?.pix_discount_percent || 0;
  const maxInstallments = paymentSettings?.credit_card_installments_no_interest || 1;

  const generateInstallmentOptions = () => {
    const options = [];
    for (let i = 1; i <= Math.min(maxInstallments, 12); i++) {
      const value = total / i;
      options.push({
        value: i.toString(),
        label: i === 1 
          ? `1x de R$ ${total.toFixed(2)} (sem juros)` 
          : `${i}x de R$ ${value.toFixed(2)} (sem juros)`,
      });
    }
    return options;
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    onPaymentMethodChange(method);
    setShowPaymentDetails(true);
  };

  const handleChangePaymentMethod = () => {
    setShowPaymentDetails(false);
  };

  // If showing payment details
  if (showPaymentDetails) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color: primaryColor }} />
            Forma de pagamento
          </h3>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="p-0"
            style={{ color: primaryColor }}
            onClick={handleChangePaymentMethod}
          >
            Alterar
          </Button>
        </div>

        {/* PIX Details */}
        {paymentMethod === "pix" && (
          <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <img src={pixLogo} alt="PIX" className="h-6 w-6 object-contain" />
              <div>
                <p className="font-medium text-green-800">Pagamento via PIX</p>
                {pixDiscount > 0 && (
                  <p className="text-sm text-green-600">
                    Desconto de {pixDiscount}% aplicado!
                  </p>
                )}
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Após finalizar, você receberá o QR Code para pagamento
              </p>
            </div>
          </div>
        )}

        {/* Credit Card Form */}
        {paymentMethod === "cartao_credito" && (
          <div className="space-y-4">
            {/* Credit Card Illustration */}
            <div className="flex justify-center mb-2 px-2">
              <img 
                src={creditCardIllustration} 
                alt="Exemplo de cartão de crédito" 
                className="w-full h-auto rounded-lg shadow-md"
              />
            </div>
            
            <div>
              <Label className="text-xs">Número do cartão</Label>
              <Input
                placeholder="0000 0000 0000 0000"
                value={cardForm.number}
                onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Validade</Label>
                <Input
                  placeholder="MM/AA"
                  value={cardForm.expiry}
                  onChange={(e) => setCardForm({ ...cardForm, expiry: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">CVV</Label>
                <Input
                  placeholder="123"
                  maxLength={4}
                  value={cardForm.cvv}
                  onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Nome no cartão</Label>
              <Input
                placeholder="NOME COMO ESTÁ NO CARTÃO"
                value={cardForm.name}
                onChange={(e) => setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <Label className="text-xs">Parcelas</Label>
              <Select
                value={cardForm.installments}
                onValueChange={(value) => setCardForm({ ...cardForm, installments: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateInstallmentOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Boleto Details */}
        {paymentMethod === "boleto" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-2xl">📄</span>
              <div>
                <p className="font-medium text-blue-800">Boleto Bancário</p>
                <p className="text-sm text-blue-600">
                  Vencimento em 3 dias úteis
                </p>
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                O boleto será gerado após finalizar o pedido
              </p>
            </div>
          </div>
        )}

        {/* WhatsApp Details */}
        {paymentMethod === "whatsapp" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <img src={whatsappLogo} alt="WhatsApp" className="h-6 w-6 object-contain" style={{ fill: '#25D366' }} />
              <div>
                <p className="font-medium text-emerald-800">Combinar via WhatsApp</p>
                <p className="text-sm text-emerald-600">
                  Fale diretamente com o vendedor
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Trust Seals */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Compra segura</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>Dados criptografados</span>
          </div>
        </div>

        {/* Finalize Button */}
        <Button
          type="button"
          className="w-full text-white font-semibold py-6"
          style={{ backgroundColor: primaryColor }}
          disabled={loading || !isFormValid}
          onClick={onFinalize}
        >
          {loading ? (
            "Processando..."
          ) : (
            <>
              <CheckCircle className="h-5 w-5 mr-2" />
              Finalizar compra
            </>
          )}
        </Button>
      </div>
    );
  }

  // Payment method selection
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <CreditCard className="h-5 w-5" style={{ color: primaryColor }} />
        Forma de pagamento
      </h3>

      <RadioGroup
        value={paymentMethod}
        onValueChange={(value) => handleMethodSelect(value as PaymentMethod)}
        className="space-y-3"
      >
        {/* PIX */}
        {isPixEnabled && (
          <div 
            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
              paymentMethod === "pix" ? "border-2" : "border-border"
            }`}
            style={paymentMethod === "pix" ? { borderColor: primaryColor } : {}}
            onClick={() => handleMethodSelect("pix")}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="pix" id="pix" />
              <div className="flex items-center gap-2">
                <img src={pixLogo} alt="PIX" className="h-5 w-5 object-contain" />
                <Label htmlFor="pix" className="font-medium cursor-pointer">
                  Pix
                </Label>
              </div>
            </div>
            {pixDiscount > 0 && (
              <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                -{pixDiscount}%
              </span>
            )}
          </div>
        )}

        {/* Credit Card */}
        {isCreditCardEnabled && (
          <div 
            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
              paymentMethod === "cartao_credito" ? "border-2" : "border-border"
            }`}
            style={paymentMethod === "cartao_credito" ? { borderColor: primaryColor } : {}}
            onClick={() => handleMethodSelect("cartao_credito")}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="cartao_credito" id="cartao_credito" />
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="text-lg">💳</span>
                </div>
                <Label htmlFor="cartao_credito" className="font-medium cursor-pointer">
                  Cartão de crédito
                </Label>
              </div>
            </div>
            {maxInstallments > 1 && (
              <span className="text-xs text-muted-foreground">
                até {maxInstallments}x s/juros
              </span>
            )}
          </div>
        )}

        {/* Boleto */}
        {isBoletoEnabled && (
          <div 
            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
              paymentMethod === "boleto" ? "border-2" : "border-border"
            }`}
            style={paymentMethod === "boleto" ? { borderColor: primaryColor } : {}}
            onClick={() => handleMethodSelect("boleto")}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="boleto" id="boleto" />
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <Label htmlFor="boleto" className="font-medium cursor-pointer">
                  Boleto bancário
                </Label>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp */}
        <div 
          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
            paymentMethod === "whatsapp" ? "border-2" : "border-border"
          }`}
          style={paymentMethod === "whatsapp" ? { borderColor: primaryColor } : {}}
          onClick={() => handleMethodSelect("whatsapp")}
        >
          <div className="flex items-center gap-3">
            <RadioGroupItem value="whatsapp" id="whatsapp" />
            <div className="flex items-center gap-2">
              <img src={whatsappLogo} alt="WhatsApp" className="h-5 w-5 object-contain" style={{ filter: 'invert(52%) sepia(75%) saturate(518%) hue-rotate(108deg) brightness(94%) contrast(87%)' }} />
              <div>
                <Label htmlFor="whatsapp" className="font-medium cursor-pointer">
                  Combinar via WhatsApp
                </Label>
                <p className="text-xs text-muted-foreground">
                  Fale direto com o vendedor
                </p>
              </div>
            </div>
          </div>
        </div>
      </RadioGroup>

      {/* Trust Seals */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Compra segura</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>Dados criptografados</span>
        </div>
      </div>

      {/* Finalize Button */}
      <Button
        type="button"
        className="w-full text-white font-semibold py-6"
        style={{ backgroundColor: primaryColor }}
        disabled={loading || !isFormValid}
        onClick={onFinalize}
      >
        {loading ? (
          "Processando..."
        ) : (
          <>
            <CheckCircle className="h-5 w-5 mr-2" />
            Finalizar compra
          </>
        )}
      </Button>
    </div>
  );
};
