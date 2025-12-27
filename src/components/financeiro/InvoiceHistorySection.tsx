import { useState, useEffect } from "react";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export interface Invoice {
  id: string;
  dueDate: string;
  amount: number;
  plan: string;
  status: "pending" | "paid" | "exempt";
}

interface InvoiceHistorySectionProps {
  invoices?: Invoice[];
}

const ITEMS_PER_PAGE = 50;

const getStatusBadge = (status: Invoice["status"]) => {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-orange-400 hover:bg-orange-400 text-white font-normal text-xs px-3 py-1 rounded">
          Aguardando pagamento
        </Badge>
      );
    case "paid":
      return (
        <Badge className="bg-green-500 hover:bg-green-500 text-white font-normal text-xs px-3 py-1 rounded">
          Paga
        </Badge>
      );
    case "exempt":
      return (
        <Badge className="bg-gray-400 hover:bg-gray-400 text-white font-normal text-xs px-3 py-1 rounded">
          Isenta
        </Badge>
      );
    default:
      return null;
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

// Mock data for demonstration - will be replaced with real data from master panel
const generateMockInvoices = (): Invoice[] => {
  const invoicesData = [
    { id: "2548925", date: "2026-11-01", amount: 49.97, plan: "PREMIUM", status: "pending" as const },
    { id: "2533921", date: "2026-10-01", amount: 29.97, plan: "PRO", status: "paid" as const },
    { id: "2437922", date: "2026-09-01", amount: 29.97, plan: "PRO", status: "paid" as const },
    { id: "2433181", date: "2026-08-01", amount: 29.97, plan: "PRO", status: "paid" as const },
    { id: "2333427", date: "2026-07-01", amount: 29.97, plan: "PRO", status: "paid" as const },
    { id: "2236944", date: "2026-06-01", amount: 29.97, plan: "PRO", status: "paid" as const },
    { id: "2233907", date: "2026-05-01", amount: 0, plan: "GRÁTIS", status: "exempt" as const },
  ];

  return invoicesData.map((inv) => ({
    id: inv.id,
    dueDate: inv.date,
    amount: inv.amount,
    plan: inv.plan,
    status: inv.status,
  }));
};

export const InvoiceHistorySection = ({
  invoices: propInvoices,
}: InvoiceHistorySectionProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    // Use provided invoices or generate mock data
    if (propInvoices && propInvoices.length > 0) {
      setInvoices(propInvoices);
    } else {
      setInvoices(generateMockInvoices());
    }
  }, [propInvoices]);

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
              <TableHead className="font-semibold text-gray-700 text-sm py-3">ID</TableHead>
              <TableHead className="font-semibold text-gray-700 text-sm py-3">Vencimento</TableHead>
              <TableHead className="font-semibold text-gray-700 text-sm py-3">Valor</TableHead>
              <TableHead className="font-semibold text-gray-700 text-sm py-3">Plano</TableHead>
              <TableHead className="font-semibold text-gray-700 text-sm py-3 text-right">Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma fatura encontrada
                </TableCell>
              </TableRow>
            ) : (
              currentInvoices.map((invoice, index) => (
                <TableRow 
                  key={invoice.id} 
                  className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  <TableCell className="font-medium text-gray-800 py-3">
                    {invoice.id}
                  </TableCell>
                  <TableCell className="text-gray-600 py-3">
                    {formatDate(invoice.dueDate)}
                  </TableCell>
                  <TableCell className="text-gray-600 py-3">
                    {formatCurrency(invoice.amount)}
                  </TableCell>
                  <TableCell className="text-gray-600 py-3">
                    {invoice.plan}
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

      {/* View All Link */}
      <div className="text-center">
        <button className="text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors">
          Ver todo o histórico de faturas
        </button>
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
