import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useConvertQuoteToOrder, Quote } from "@/hooks/useQuotes";
import { ArrowRightLeft, AlertTriangle, CheckCircle } from "lucide-react";

interface ConvertQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
}

export const ConvertQuoteModal = ({ open, onOpenChange, quote }: ConvertQuoteModalProps) => {
  const convert = useConvertQuoteToOrder();
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [useCurrentPrices, setUseCurrentPrices] = useState(false);
  const [stockCheck, setStockCheck] = useState<Record<string, { available: number; needed: number }>>({});

  useEffect(() => {
    if (open && quote?.quote_items) {
      checkStock();
    }
  }, [open, quote]);

  const checkStock = async () => {
    if (!quote?.quote_items) return;
    const productIds = quote.quote_items.filter((i) => i.product_id).map((i) => i.product_id!);
    if (productIds.length === 0) return;

    const { data } = await supabase.from("products").select("id, stock").in("id", productIds);
    const map: Record<string, { available: number; needed: number }> = {};
    for (const item of quote.quote_items) {
      if (item.product_id && data) {
        const product = data.find((p: any) => p.id === item.product_id);
        map[item.product_id] = {
          available: product?.stock ?? 0,
          needed: item.quantity,
        };
      }
    }
    setStockCheck(map);
  };

  const handleConvert = () => {
    if (!quote) return;
    convert.mutate(
      { quoteId: quote.id, paymentMethod, useCurrentPrices },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const hasStockIssue = Object.values(stockCheck).some((s) => s.available < s.needed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Converter Orçamento em Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Orçamento <strong>{quote?.quote_number}</strong> será convertido em pedido real. O estoque será debitado.
          </p>

          {/* Stock check */}
          {quote?.quote_items && quote.quote_items.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Conferência de Estoque</Label>
              <div className="border rounded-md overflow-hidden">
                {quote.quote_items.map((item, i) => {
                  const stock = item.product_id ? stockCheck[item.product_id] : null;
                  const isOk = !stock || stock.available >= stock.needed;
                  return (
                    <div key={i} className="px-3 py-2 text-sm flex justify-between items-center border-b last:border-b-0">
                      <span className="truncate flex-1">{item.name} (x{item.quantity})</span>
                      {item.product_id ? (
                        <Badge className={isOk ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {isOk ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                          {stock ? `${stock.available} disp.` : "..."}
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground">Item livre</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              {hasStockIssue && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Alguns itens possuem estoque insuficiente.
                </p>
              )}
            </div>
          )}

          <div>
            <Label className="text-sm">Forma de pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="credito">Cartão de Crédito</SelectItem>
                <SelectItem value="debito">Cartão de Débito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="current-prices"
              checked={useCurrentPrices}
              onCheckedChange={(v) => setUseCurrentPrices(v as boolean)}
            />
            <Label htmlFor="current-prices" className="text-sm">
              Atualizar para preços atuais do catálogo
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConvert} disabled={convert.isPending}>
            {convert.isPending ? "Convertendo..." : "Converter em Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
