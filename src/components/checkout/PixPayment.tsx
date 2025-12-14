import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QrCode, Copy, Check, Clock, Loader2, RefreshCw } from "lucide-react";

interface PixPaymentProps {
  orderId: string;
  amount: number;
  storeOwnerId: string;
  gateway: "mercadopago" | "pagbank";
  primaryColor?: string;
  onPaymentConfirmed: () => void;
  onExpired?: () => void;
}

interface PixData {
  qrCode: string;
  qrCodeBase64?: string;
  expiresAt: string;
  pixPaymentId: string;
}

export const PixPayment = ({
  orderId,
  amount,
  storeOwnerId,
  gateway,
  primaryColor = "#6a1b9a",
  onPaymentConfirmed,
  onExpired,
}: PixPaymentProps) => {
  const [loading, setLoading] = useState(true);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const hasConfirmedRef = useRef(false);

  const generatePix = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-pix", {
        body: {
          orderId,
          amount,
          storeOwnerId,
          gateway,
          description: `Pedido #${orderId.substring(0, 8)}`,
        },
      });

      if (fnError || !data?.success) {
        throw new Error(data?.error || "Erro ao gerar PIX");
      }

      setPixData({
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        expiresAt: data.expiresAt,
        pixPaymentId: data.pixPaymentId,
      });

      // Calculate time left
      const expiresAt = new Date(data.expiresAt).getTime();
      const now = Date.now();
      setTimeLeft(Math.max(0, Math.floor((expiresAt - now) / 1000)));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao gerar QR Code PIX";
      console.error("PIX generation error:", errorMessage);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [orderId, amount, storeOwnerId, gateway]);

  // Check payment status via polling
  const checkPaymentStatus = useCallback(async () => {
    if (!pixData?.pixPaymentId || hasConfirmedRef.current) return;

    setChecking(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("check-pix-status", {
        body: { pixPaymentId: pixData.pixPaymentId },
      });

      if (fnError) {
        console.error("Error checking status:", fnError);
        return;
      }

      if (data?.status === "approved" && !hasConfirmedRef.current) {
        hasConfirmedRef.current = true;
        setPaymentStatus("approved");
        toast.success("Pagamento confirmado!");
        
        // Clear polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        
        // Call callback
        onPaymentConfirmed();
      } else if (data?.status === "expired" || data?.status === "cancelled") {
        setPaymentStatus(data.status);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        onExpired?.();
      }
    } catch (err) {
      console.error("Polling error:", err);
    } finally {
      setChecking(false);
    }
  }, [pixData?.pixPaymentId, onPaymentConfirmed, onExpired]);

  useEffect(() => {
    generatePix();
  }, [generatePix]);

  // Start polling when PIX data is available
  useEffect(() => {
    if (!pixData?.pixPaymentId || paymentStatus !== "pending") return;

    // Initial check after 5 seconds
    const initialTimeout = setTimeout(() => {
      checkPaymentStatus();
    }, 5000);

    // Then poll every 4 seconds
    pollingRef.current = setInterval(() => {
      checkPaymentStatus();
    }, 4000);

    return () => {
      clearTimeout(initialTimeout);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pixData?.pixPaymentId, paymentStatus, checkPaymentStatus]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || paymentStatus === "approved") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setPaymentStatus("expired");
          onExpired?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, paymentStatus, onExpired]);

  const copyToClipboard = async () => {
    if (!pixData?.qrCode) return;

    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar código");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: primaryColor }} />
        <p className="text-muted-foreground">Gerando QR Code PIX...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Erro ao gerar PIX</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button onClick={generatePix} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (paymentStatus === "approved") {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div 
          className="p-4 rounded-full"
          style={{ backgroundColor: `${primaryColor}15` }}
        >
          <Check className="h-12 w-12" style={{ color: primaryColor }} />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold" style={{ color: primaryColor }}>
            Pagamento Confirmado!
          </p>
          <p className="text-sm text-muted-foreground">
            Seu pedido foi processado com sucesso.
          </p>
        </div>
      </div>
    );
  }

  if (paymentStatus === "expired") {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <Clock className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold text-muted-foreground">
            QR Code Expirado
          </p>
          <p className="text-sm text-muted-foreground">
            O tempo para pagamento expirou.
          </p>
        </div>
        <Button onClick={generatePix} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Gerar novo QR Code
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6 py-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <QrCode className="h-5 w-5" style={{ color: primaryColor }} />
          <h3 className="text-lg font-semibold">Pagamento via PIX</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Escaneie o QR Code ou copie o código para pagar
        </p>
      </div>

      {/* QR Code */}
      <div 
        className="p-4 bg-white rounded-xl border-2 shadow-sm"
        style={{ borderColor: primaryColor }}
      >
        {pixData?.qrCodeBase64 ? (
          <img
            src={pixData.qrCodeBase64.startsWith("data:") ? pixData.qrCodeBase64 : `data:image/png;base64,${pixData.qrCodeBase64}`}
            alt="QR Code PIX"
            className="w-48 h-48 md:w-56 md:h-56"
          />
        ) : (
          <div className="w-48 h-48 md:w-56 md:h-56 flex items-center justify-center bg-gray-100 rounded">
            <QrCode className="h-24 w-24 text-gray-400" />
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Valor a pagar</p>
        <p className="text-2xl font-bold" style={{ color: primaryColor }}>
          R$ {amount.toFixed(2).replace(".", ",")}
        </p>
      </div>

      {/* Timer */}
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Expira em</span>
        <span 
          className="font-mono font-semibold"
          style={{ color: timeLeft < 300 ? "#ef4444" : primaryColor }}
        >
          {formatTime(timeLeft)}
        </span>
      </div>

      {/* Copy Button */}
      <Button
        onClick={copyToClipboard}
        className="w-full max-w-xs gap-2"
        style={{ 
          backgroundColor: primaryColor,
          color: "#fff",
        }}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Código Copiado!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copiar código PIX
          </>
        )}
      </Button>

      {/* Info */}
      <div className="text-center text-xs text-muted-foreground max-w-sm">
        <p>Pagamento via PIX – confirmação automática</p>
        <p className="mt-1">
          Após o pagamento, aguarde alguns segundos para a confirmação.
        </p>
      </div>
    </div>
  );
};
