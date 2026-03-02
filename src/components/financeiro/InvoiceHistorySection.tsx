import { useState, useEffect } from "react";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Invoice {
  id: string;
  due_date: string;
  amount: number;
  plan: string | null;
  status: string;
  payment_method: string | null;
  mp_payment_id: string | null;
  paid_at: string | null;
  created_at: string;
}

const ITEMS_PER_PAGE = 12;

const getStatusBadge = (status: string) => {
  const baseClasses = "text-white font-normal text-xs py-1 rounded text-center w-[140px] inline-block";
  
  switch (status) {
    case "pending":
      return (
        <Badge className={`bg-orange-400 hover:bg-orange-400 ${baseClasses}`}>
          Aguardando pagamento
        </Badge>
      );
    case "paid":
      return (
        <Badge className={`bg-green-500 hover:bg-green-500 ${baseClasses}`}>
          Paga
        </Badge>
      );
    case "rejected":
      return (
        <Badge className={`bg-red-500 hover:bg-red-500 ${baseClasses}`}>
          Recusado
        </Badge>
      );
    case "expired":
    case "cancelled":
      return (
        <Badge className={`bg-gray-500 hover:bg-gray-500 ${baseClasses}`}>
          Expirado
        </Badge>
      );
    case "refunded":
      return (
        <Badge className={`bg-blue-500 hover:bg-blue-500 ${baseClasses}`}>
          Reembolsado
        </Badge>
      );
    case "exempt":
      return (
        <Badge className={`bg-gray-400 hover:bg-gray-400 ${baseClasses}`}>
          Isenta
        </Badge>
      );
    default:
      return (
        <Badge className={`bg-gray-400 hover:bg-gray-400 ${baseClasses}`}>
          {status}
        </Badge>
      );
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR");
};

export const InvoiceHistorySection = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    fetchInvoices();
  }, [user]);

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, due_date, amount, plan, status, payment_method, mp_payment_id, paid_at, created_at")
        .eq("subscriber_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices((data as Invoice[]) || []);
    } catch (error) {
      console.error("Erro ao buscar faturas:", error);
      toast({
        title: "Erro ao carregar faturas",
        description: "Não foi possível carregar o histórico de faturas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(invoices.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentInvoices = invoices.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => handlePageChange(i)}
            isActive={currentPage === i}
            className="cursor-pointer"
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
            <Receipt className="h-4 w-4 text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Histórico de faturas
          </h2>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          Histórico dos seus pagamentos dentro da plataforma
        </p>
      </div>

      {/* Invoices Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-200">
              <TableHead className="font-semibold text-gray-700 text-sm py-3">Vencimento</TableHead>
              <TableHead className="font-semibold text-gray-700 text-sm py-3">Valor</TableHead>
              <TableHead className="font-semibold text-gray-700 text-sm py-3">Plano</TableHead>
              <TableHead className="font-semibold text-gray-700 text-sm py-3">Método</TableHead>
              <TableHead className="font-semibold text-gray-700 text-sm py-3 text-right">Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando faturas...
                </TableCell>
              </TableRow>
            ) : currentInvoices.length === 0 ? (
              <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Seu histórico será exibido aqui após a primeira cobrança registrada.
                </TableCell>
              </TableRow>
            ) : (
              currentInvoices.map((invoice, index) => (
                <TableRow 
                  key={invoice.id} 
                  className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  <TableCell className="text-gray-600 py-3">
                    {formatDate(invoice.due_date)}
                  </TableCell>
                  <TableCell className="text-gray-600 py-3">
                    {formatCurrency(invoice.amount)}
                  </TableCell>
                  <TableCell className="text-gray-600 py-3 uppercase">
                    {invoice.plan || "—"}
                  </TableCell>
                  <TableCell className="text-gray-600 py-3">
                    {invoice.payment_method === "credit_card"
                      ? "Cartão"
                      : invoice.payment_method === "pix"
                      ? "PIX"
                      : invoice.payment_method === "boleto"
                      ? "Boleto"
                      : "—"}
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    {getStatusBadge(invoice.status)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={`cursor-pointer ${currentPage === 1 ? "pointer-events-none opacity-50" : ""}`}
                />
              </PaginationItem>
              
              {renderPaginationItems()}
              
              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={`cursor-pointer ${currentPage === totalPages ? "pointer-events-none opacity-50" : ""}`}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};
