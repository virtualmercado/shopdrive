import { useState } from "react";
import { Pencil, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/contexts/ThemeContext";
import creditCardIllustration from "@/assets/credit-card-illustration.png";

// VirtualMercado default colors
const VM_PRIMARY = "#6a1b9a";

interface SavedCard {
  holderName: string;
  lastFourDigits: string;
  expirationMonth: string;
  expirationYear: string;
}

interface PaymentDataSectionProps {
  savedCard?: SavedCard | null;
  onCardSave?: (cardData: {
    cardNumber: string;
    holderName: string;
    expirationMonth: string;
    expirationYear: string;
    cvv: string;
  }) => void;
  onPaymentMethodChange?: (method: "card" | "boleto") => void;
}

export const PaymentDataSection = ({
  savedCard = null,
  onCardSave,
  onPaymentMethodChange,
}: PaymentDataSectionProps) => {
  const { primaryColor } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "boleto">("card");
  
  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState(savedCard?.holderName || "");
  const [expirationMonth, setExpirationMonth] = useState(savedCard?.expirationMonth || "");
  const [expirationYear, setExpirationYear] = useState(savedCard?.expirationYear || "");
  const [cvv, setCvv] = useState("");

  // Use merchant's primary color or fallback to VM default
  const activeColor = primaryColor || VM_PRIMARY;

  const handlePaymentMethodChange = (value: string) => {
    const method = value as "card" | "boleto";
    setPaymentMethod(method);
    onPaymentMethodChange?.(method);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setCardNumber("");
    setHolderName(savedCard?.holderName || "");
    setExpirationMonth(savedCard?.expirationMonth || "");
    setExpirationYear(savedCard?.expirationYear || "");
    setCvv("");
  };

  const handleValidateCard = () => {
    onCardSave?.({
      cardNumber,
      holderName,
      expirationMonth,
      expirationYear,
      cvv,
    });
    setIsEditing(false);
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const months = Array.from({ length: 12 }, (_, i) => 
    String(i + 1).padStart(2, "0")
  );
  
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => 
    String(currentYear + i)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Dados para pagamento
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha a forma de pagamento do seu plano
        </p>
      </div>

      {/* Card Summary or Edit Form */}
      {savedCard && !isEditing ? (
        // Saved card summary view
        <div className="border border-border rounded-lg p-4 bg-muted/30">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nome impresso</p>
                <p className="text-sm font-medium text-foreground">
                  {savedCard.holderName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Número do cartão</p>
                <p className="text-sm font-medium text-foreground">
                  **** **** **** {savedCard.lastFourDigits}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Data de expiração</p>
                <p className="text-sm font-medium text-foreground">
                  {savedCard.expirationMonth}/{savedCard.expirationYear}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="shrink-0 gap-2"
              style={{
                borderColor: activeColor,
                color: activeColor,
              }}
            >
              <Pencil className="h-4 w-4" />
              Alterar cartão
            </Button>
          </div>
        </div>
      ) : isEditing || !savedCard ? (
        // Card edit form
        <div className="border border-border rounded-lg p-4 md:p-6 bg-background space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card Number */}
            <div className="md:col-span-2">
              <Label htmlFor="cardNumber" className="text-sm font-medium">
                Número do cartão
              </Label>
              <Input
                id="cardNumber"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                className="mt-1.5"
                maxLength={19}
              />
            </div>

            {/* Holder Name */}
            <div className="md:col-span-2">
              <Label htmlFor="holderName" className="text-sm font-medium">
                Nome impresso
              </Label>
              <Input
                id="holderName"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value.toUpperCase())}
                placeholder="NOME COMO ESTÁ NO CARTÃO"
                className="mt-1.5"
              />
            </div>

            {/* Expiration */}
            <div>
              <Label className="text-sm font-medium">Vencimento</Label>
              <div className="flex gap-2 mt-1.5">
                <Select value={expirationMonth} onValueChange={setExpirationMonth}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={expirationYear} onValueChange={setExpirationYear}>
                  <SelectTrigger 
                    className="flex-1"
                    style={{
                      backgroundColor: expirationYear ? `${activeColor}10` : undefined,
                      borderColor: expirationYear ? activeColor : undefined,
                    }}
                  >
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CVV */}
            <div>
              <Label htmlFor="cvv" className="text-sm font-medium">
                Código de segurança
              </Label>
              <div className="flex items-start gap-3 mt-1.5">
                <Input
                  id="cvv"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="CVV"
                  maxLength={4}
                  className="w-24"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <img 
                    src={creditCardIllustration} 
                    alt="CVV" 
                    className="w-10 h-6 object-contain"
                  />
                  <span>
                    Sequência de três últimos<br />
                    dígitos no verso do cartão.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Verification notice */}
          <p className="text-xs text-muted-foreground">
            Será realizada uma transação de verificação com a operadora do seu cartão.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {savedCard && (
              <Button
                variant="secondary"
                onClick={handleCancelEdit}
                className="sm:order-1"
              >
                Cancelar edição
              </Button>
            )}
            <Button
              onClick={handleValidateCard}
              className="sm:order-2 text-white"
              style={{ backgroundColor: activeColor }}
            >
              Validar dados do cartão
            </Button>
          </div>
        </div>
      ) : null}

      {/* Payment Method Selection */}
      <RadioGroup
        value={paymentMethod}
        onValueChange={handlePaymentMethodChange}
        className="space-y-3"
      >
        <label
          htmlFor="payment-card"
          className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
            paymentMethod === "card" 
              ? "bg-muted/50" 
              : "bg-background hover:bg-muted/20"
          }`}
          style={{
            borderColor: paymentMethod === "card" ? activeColor : undefined,
          }}
        >
          <RadioGroupItem
            value="card"
            id="payment-card"
            className="mt-0.5"
            style={{
              borderColor: activeColor,
              color: paymentMethod === "card" ? activeColor : undefined,
            }}
          />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              Pagamento Automático no Cartão
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Use as bandeiras de cartão de crédito mais populares do mercado.
            </p>
          </div>
        </label>

        <label
          htmlFor="payment-boleto"
          className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
            paymentMethod === "boleto" 
              ? "bg-muted/50" 
              : "bg-background hover:bg-muted/20"
          }`}
          style={{
            borderColor: paymentMethod === "boleto" ? activeColor : undefined,
          }}
        >
          <RadioGroupItem
            value="boleto"
            id="payment-boleto"
            className="mt-0.5"
            style={{
              borderColor: activeColor,
              color: paymentMethod === "boleto" ? activeColor : undefined,
            }}
          />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              Boleto Bancário
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Um boleto será gerado de forma automática dias antes do vencimento de sua mensalidade.
            </p>
          </div>
        </label>
      </RadioGroup>
    </div>
  );
};
