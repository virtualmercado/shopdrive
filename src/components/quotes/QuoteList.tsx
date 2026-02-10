import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QuoteStatusBadge } from "./QuoteStatusBadge";
import { CreateQuoteModal } from "./CreateQuoteModal";
import { ConvertQuoteModal } from "./ConvertQuoteModal";
import { printQuoteA4 } from "./QuotePrintA4";
import { useQuotes, useQuoteDetails, useUpdateQuoteStatus, useDeleteQuote, Quote } from "@/hooks/useQuotes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Eye, Pencil, Printer, Link2, ArrowRightLeft, Trash2, FileText,
  MoreHorizontal, CheckCircle, XCircle,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const QuoteList = () => {
  const { user } = useAuth();
  const { data: quotes, isLoading } = useQuotes();
  const updateStatus = useUpdateQuoteStatus();
  const deleteQuote = useDeleteQuote();

  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [convertQuote, setConvertQuote] = useState<Quote | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);

  const { data: editQuoteData } = useQuoteDetails(editQuoteId);

  const handleEdit = (quoteId: string) => {
    setEditQuoteId(quoteId);
    setEditModalOpen(true);
  };

  const handlePrintPDF = async (quote: Quote) => {
    try {
      const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", quote.id);
      const { data: store } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      await printQuoteA4({ quote: { ...quote, quote_items: items || [] }, store: store || {} });
    } catch {
      toast({ title: "Erro", description: "Erro ao gerar PDF.", variant: "destructive" });
    }
  };

  const handleCopyLink = async (quoteId: string) => {
    const { data: link } = await supabase
      .from("quote_public_links")
      .select("public_token")
      .eq("quote_id", quoteId)
      .eq("is_enabled", true)
      .maybeSingle();

    if (link) {
      const url = `${window.location.origin}/public/orcamento/${link.public_token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: "O link do orçamento foi copiado." });
    } else {
      // Create link
      const { data: newLink } = await supabase
        .from("quote_public_links")
        .insert({ quote_id: quoteId })
        .select()
        .single();
      if (newLink) {
        const url = `${window.location.origin}/public/orcamento/${newLink.public_token}`;
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado!", description: "Link público criado e copiado." });
      }
    }
  };

  const handleDelete = (quoteId: string) => {
    setQuoteToDelete(quoteId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (quoteToDelete) {
      deleteQuote.mutate(quoteToDelete);
    }
    setDeleteDialogOpen(false);
    setQuoteToDelete(null);
  };

  const canConvert = (q: Quote) => ["open", "approved"].includes(q.status) && new Date(q.valid_until) >= new Date();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <div className="p-12 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhum orçamento encontrado</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y">
        {quotes.map((quote) => (
          <div key={quote.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm sm:text-base">
                    {quote.quote_number || `ORC-${quote.id.slice(0, 8)}`}
                  </p>
                  <QuoteStatusBadge status={quote.status} />
                </div>
                <p className="text-sm text-muted-foreground">{quote.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  Emissão: {format(new Date(quote.issued_at), "dd/MM/yyyy", { locale: ptBR })}
                  {" · "}
                  Validade: {format(new Date(quote.valid_until + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-lg sm:text-xl font-bold">R$ {Number(quote.total).toFixed(2)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(quote.id)} title="Editar">
                  <Pencil className="h-4 w-4 text-primary" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrintPDF(quote)} title="PDF A4">
                  <Printer className="h-4 w-4 text-primary" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyLink(quote.id)} title="Copiar link">
                  <Link2 className="h-4 w-4 text-primary" />
                </Button>
                {canConvert(quote) && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConvertQuote(quote)} title="Converter em pedido">
                    <ArrowRightLeft className="h-4 w-4 text-primary" />
                  </Button>
                )}
              </div>

              {/* Status change dropdown */}
              {!["converted", "expired"].includes(quote.status) && (
                <Select
                  value={quote.status}
                  onValueChange={(value) => updateStatus.mutate({ quoteId: quote.id, status: value })}
                >
                  <SelectTrigger className="w-[130px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="open">Em aberto</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Recusado</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(quote.id)}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrintPDF(quote)}>
                    <Printer className="h-4 w-4 mr-2" /> PDF A4
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCopyLink(quote.id)}>
                    <Link2 className="h-4 w-4 mr-2" /> Copiar link público
                  </DropdownMenuItem>
                  {canConvert(quote) && (
                    <DropdownMenuItem onClick={() => setConvertQuote(quote)}>
                      <ArrowRightLeft className="h-4 w-4 mr-2" /> Converter em Pedido
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(quote.id)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      <CreateQuoteModal
        open={editModalOpen}
        onOpenChange={(open) => {
          setEditModalOpen(open);
          if (!open) setEditQuoteId(null);
        }}
        editQuote={editQuoteData}
      />

      <ConvertQuoteModal
        open={!!convertQuote}
        onOpenChange={(open) => { if (!open) setConvertQuote(null); }}
        quote={convertQuote}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Orçamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
