import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import creditCardIllustration from "@/assets/credit-card-illustration.png";

interface CardFormProps {
  onValidate: (cardData: {
    cardNumber: string;
    holderName: string;
    expirationMonth: string;
    expirationYear: string;
    cvv: string;
    cardToken?: string;
    paymentMethodId?: string;
  }) => Promise<void>;
  onCancel?: () => void;
  showCancelButton?: boolean;
  isLoading?: boolean;
  primaryColor?: string;
  initialData?: {
    holderName?: string;
    expirationMonth?: string;
    expirationYear?: string;
  };
}

declare global {
  interface Window {
    MercadoPago: any;
  }
}

export const CardForm = ({
  onValidate,
  onCancel,
  showCancelButton = false,
  isLoading = false,
  primaryColor = "#6a1b9a",
  initialData,
}: CardFormProps) => {
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState(initialData?.holderName || "");
  const [expirationMonth, setExpirationMonth] = useState(initialData?.expirationMonth || "");
  const [expirationYear, setExpirationYear] = useState(initialData?.expirationYear || "");
  const [cvv, setCvv] = useState("");
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const mpRef = useRef<any>(null);

  // Initialize Mercado Pago SDK
  useEffect(() => {
    const initMP = async () => {
      if (window.MercadoPago && !mpRef.current) {
        try {
          // Get public key from master_payment_gateways
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/master_payment_gateways?is_active=eq.true&is_default=eq.true&select=mercadopago_public_key`,
            {
              headers: {
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
            }
          );
          const data = await response.json();
          
          if (data?.[0]?.mercadopago_public_key) {
            mpRef.current = new window.MercadoPago(data[0].mercadopago_public_key, {
              locale: "pt-BR",
            });
          }
        } catch (error) {
          console.error("Error initializing MercadoPago:", error);
        }
      }
    };

    initMP();
  }, []);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const detectCardBrand = (number: string): string => {
    const cleanNumber = number.replace(/\s/g, "");
    
    if (/^4/.test(cleanNumber)) return "visa";
    if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) return "master";
    if (/^3[47]/.test(cleanNumber)) return "amex";
    if (/^6(?:011|5)/.test(cleanNumber)) return "discover";
    if (/^(?:2131|1800|35)/.test(cleanNumber)) return "jcb";
    if (/^3(?:0[0-5]|[68])/.test(cleanNumber)) return "diners";
    if (/^(636368|438935|504175|451416|636297|5067|4576|4011)/.test(cleanNumber)) return "elo";
    if (/^(606282|3841)/.test(cleanNumber)) return "hipercard";
    
    return "unknown";
  };

  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    setCardNumber(formatted);
    
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 4) {
      setCardBrand(detectCardBrand(digits));
    } else {
      setCardBrand(null);
    }
  };

  const tokenizeCard = async (): Promise<{ token: string; paymentMethodId: string } | null> => {
    if (!mpRef.current) {
      console.error("MercadoPago SDK not initialized");
      return null;
    }

    try {
      const cardTokenData = {
        cardNumber: cardNumber.replace(/\s/g, ""),
        cardholderName: holderName,
        cardExpirationMonth: expirationMonth,
        cardExpirationYear: expirationYear.length === 2 ? `20${expirationYear}` : expirationYear,
        securityCode: cvv,
        identificationType: "CPF",
        identificationNumber: "00000000000", // Will be updated with real CPF
      };

      const response = await mpRef.current.createCardToken(cardTokenData);
      
      if (response.id) {
        return {
          token: response.id,
          paymentMethodId: cardBrand || "visa",
        };
      }
      return null;
    } catch (error) {
      console.error("Card tokenization error:", error);
      return null;
    }
  };

  const handleSubmit = async () => {
    // Try to tokenize with Mercado Pago
    const tokenData = await tokenizeCard();
    
    await onValidate({
      cardNumber: cardNumber.replace(/\s/g, ""),
      holderName,
      expirationMonth,
      expirationYear,
      cvv,
      cardToken: tokenData?.token,
      paymentMethodId: tokenData?.paymentMethodId || cardBrand || undefined,
    });
  };

  const isFormValid = 
    cardNumber.replace(/\s/g, "").length >= 13 &&
    holderName.length >= 3 &&
    expirationMonth &&
    expirationYear &&
    cvv.length >= 3;

  const months = Array.from({ length: 12 }, (_, i) => 
    String(i + 1).padStart(2, "0")
  );
  
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => 
    String(currentYear + i)
  );

  const brandLogos: Record<string, string> = {
    visa: "https://www.mercadopago.com/org-img/MP3/API/logos/visa.gif",
    master: "https://www.mercadopago.com/org-img/MP3/API/logos/master.gif",
    amex: "https://www.mercadopago.com/org-img/MP3/API/logos/amex.gif",
    elo: "https://www.mercadopago.com/org-img/MP3/API/logos/elo.gif",
    hipercard: "https://www.mercadopago.com/org-img/MP3/API/logos/hipercard.gif",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Number */}
        <div className="md:col-span-2">
          <Label htmlFor="cardNumber" className="text-sm font-medium">
            Número do cartão
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="cardNumber"
              value={cardNumber}
              onChange={(e) => handleCardNumberChange(e.target.value)}
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              disabled={isLoading}
            />
            {cardBrand && brandLogos[cardBrand] && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <img 
                  src={brandLogos[cardBrand]} 
                  alt={cardBrand} 
                  className="h-6 w-auto"
                />
              </div>
            )}
          </div>
          {cardBrand && cardBrand !== "unknown" && (
            <p className="text-xs text-muted-foreground mt-1">
              Bandeira detectada: {cardBrand.toUpperCase()}
            </p>
          )}
        </div>

        {/* Holder Name */}
        <div className="md:col-span-2">
          <Label htmlFor="holderName" className="text-sm font-medium">
            Nome impresso no cartão
          </Label>
          <Input
            id="holderName"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value.toUpperCase())}
            placeholder="NOME COMO ESTÁ NO CARTÃO"
            className="mt-1.5"
            disabled={isLoading}
          />
        </div>

        {/* Expiration */}
        <div>
          <Label className="text-sm font-medium">Vencimento</Label>
          <div className="flex gap-2 mt-1.5">
            <Select 
              value={expirationMonth} 
              onValueChange={setExpirationMonth}
              disabled={isLoading}
            >
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
            <Select 
              value={expirationYear} 
              onValueChange={setExpirationYear}
              disabled={isLoading}
            >
              <SelectTrigger className="flex-1">
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
              disabled={isLoading}
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

      {/* Gateway info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <img 
          src="https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/6.6.105/mercadopago/logo__small@2x.png" 
          alt="Mercado Pago" 
          className="h-4"
        />
        <span>Pagamento processado com segurança pelo Mercado Pago</span>
      </div>

      {/* Verification notice */}
      <p className="text-xs text-muted-foreground">
        Será realizada uma transação de verificação com a operadora do seu cartão.
      </p>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {showCancelButton && onCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
            className="sm:order-1"
            disabled={isLoading}
          >
            Cancelar
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          className="sm:order-2 text-white"
          style={{ backgroundColor: primaryColor }}
          disabled={!isFormValid || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validando...
            </>
          ) : (
            "Validar dados do cartão"
          )}
        </Button>
      </div>
    </div>
  );
};
