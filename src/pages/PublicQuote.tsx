import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Printer, Download, MessageCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { printQuoteA4 } from "@/components/quotes/QuotePrintA4";

const PublicQuote = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [store, setStore] = useState<any>(null);

  useEffect(() => {
    if (token) loadQuote();
  }, [token]);

  const loadQuote = async () => {
    try {
      // Get link
      const { data: link, error: linkErr } = await supabase
        .from("quote_public_links")
        .select("quote_id, is_enabled, expires_at")
        .eq("public_token", token!)
        .maybeSingle();

      if (linkErr || !link) {
        setError("Orçamento indisponível.");
        return;
      }

      if (!link.is_enabled || (link.expires_at && new Date(link.expires_at) < new Date())) {
        setError("Este link expirou ou foi desativado.");
        return;
      }

      // Get quote
      const { data: quoteData, error: quoteErr } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", link.quote_id)
        .single();

      if (quoteErr || !quoteData) {
        setError("Orçamento não encontrado.");
        return;
      }

      // Get items
      const { data: itemsData } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quoteData.id);

      // Get store profile
      const { data: storeData } = await supabase
        .from("profiles")
        .select("store_name, store_logo_url, email, phone, whatsapp_number, address, address_city, address_state")
        .eq("id", quoteData.store_owner_id)
        .single();

      setQuote(quoteData);
      setItems(itemsData || []);
      setStore(storeData);
    } catch {
      setError("Erro ao carregar orçamento.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handlePDF = async () => {
    if (!quote || !store) return;
    await printQuoteA4({ quote: { ...quote, quote_items: items }, store });
  };

  const handleWhatsApp = () => {
    if (!store?.whatsapp_number) return;
    const phone = store.whatsapp_number.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá! Vi o orçamento ${quote.quote_number} e gostaria de mais informações.`);
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl p-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-xl font-bold">Orçamento indisponível</h1>
          <p className="text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(quote.valid_until) < new Date();
  const validDate = format(new Date(quote.valid_until + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
  const issuedDate = format(new Date(quote.issued_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Actions bar - hidden on print */}
        <div className="flex gap-2 justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDF}>
            <Download className="h-4 w-4 mr-1" /> Baixar PDF
          </Button>
          {store?.whatsapp_number && (
            <Button variant="outline" size="sm" onClick={handleWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
            </Button>
          )}
        </div>

        <Card className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              {store?.store_logo_url && (
                <img src={store.store_logo_url} alt="Logo" className="h-12 w-12 object-contain rounded" />
              )}
              <div>
                <h1 className="text-xl font-bold">{store?.store_name || "Loja"}</h1>
                {store?.phone && <p className="text-sm text-muted-foreground">Tel: {store.phone}</p>}
                {store?.email && <p className="text-sm text-muted-foreground">{store.email}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold">ORÇAMENTO {quote.quote_number}</h2>
              <p className="text-sm text-muted-foreground">Emissão: {issuedDate}</p>
              <div className="flex items-center gap-2 justify-end mt-1">
                <span className="text-sm">Validade: {validDate}</span>
                {isExpired && <Badge variant="destructive">Expirado</Badge>}
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer */}
          <div className="my-4 space-y-1">
            <h3 className="font-semibold text-sm">CLIENTE</h3>
            <p>{quote.customer_name}</p>
            {quote.customer_phone && <p className="text-sm text-muted-foreground">Tel: {quote.customer_phone}</p>}
            {quote.customer_email && <p className="text-sm text-muted-foreground">{quote.customer_email}</p>}
            {quote.delivery_address && <p className="text-sm text-muted-foreground">Endereço: {quote.delivery_address}</p>}
          </div>

          <Separator />

          {/* Items */}
          <div className="my-4">
            <h3 className="font-semibold text-sm mb-3">ITENS</h3>
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted px-3 py-2 text-xs font-semibold grid grid-cols-12 gap-2">
                <span className="col-span-1">#</span>
                <span className="col-span-5">Produto</span>
                <span className="col-span-2 text-center">Qtd</span>
                <span className="col-span-2 text-right">Unit.</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              {items.map((item, i) => (
                <div key={item.id} className="px-3 py-2 text-sm grid grid-cols-12 gap-2 border-t">
                  <span className="col-span-1">{i + 1}</span>
                  <span className="col-span-5 truncate">{item.name}</span>
                  <span className="col-span-2 text-center">{item.quantity}</span>
                  <span className="col-span-2 text-right">R$ {Number(item.unit_price).toFixed(2)}</span>
                  <span className="col-span-2 text-right font-medium">R$ {Number(item.line_total).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm mt-4">
            <div className="flex justify-between"><span>Subtotal</span><span>R$ {Number(quote.subtotal).toFixed(2)}</span></div>
            {quote.discount > 0 && <div className="flex justify-between"><span>Desconto</span><span>- R$ {Number(quote.discount).toFixed(2)}</span></div>}
            {quote.shipping_fee > 0 && <div className="flex justify-between"><span>Frete</span><span>R$ {Number(quote.shipping_fee).toFixed(2)}</span></div>}
            <Separator />
            <div className="flex justify-between text-lg font-bold pt-2">
              <span>Total</span>
              <span>R$ {Number(quote.total).toFixed(2)}</span>
            </div>
          </div>

          {quote.payment_method_hint && (
            <p className="text-sm text-muted-foreground mt-3">Forma de pagamento sugerida: {quote.payment_method_hint}</p>
          )}

          {quote.notes && (
            <div className="mt-4 p-3 bg-muted/50 rounded-md">
              <h3 className="font-semibold text-sm mb-1">Observações</h3>
              <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Este orçamento é válido até {validDate}. Após esta data, os valores poderão ser alterados.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default PublicQuote;
