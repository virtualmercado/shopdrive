import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
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
        <Badge className="bg-orange-500 hover:bg-orange-500 text-white font-normal text-xs px-3 py-1">
          Aguardando pagamento
        </Badge>
      );
    case "paid":
      return (
        <Badge className="bg-green-500 hover:bg-green-500 text-white font-normal text-xs px-3 py-1">
          Paga
        </Badge>
      );
    case "exempt":
      return (
        <Badge className="bg-gray-400 hover:bg-gray-400 text-white font-normal text-xs px-3 py-1">
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
  const plans = ["Pro", "Premium", "Pro", "Grátis"];
  const statuses: Invoice["status"][] = ["paid", "pending", "exempt"];
  const invoices: Invoice[] = [];

  for (let i = 1; i <= 5; i++) {
    const randomPlan = plans[Math.floor(Math.random() * plans.length)];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
    const year = 2024 + Math.floor(Math.random() * 2);

    invoices.push({
      id: `FAT-${String(i).padStart(5, "0")}`,
      dueDate: `${year}-${month}-15`,
      amount: randomPlan === "Grátis" ? 0 : randomPlan === "Pro" ? 49.9 : 99.9,
      plan: randomPlan,
      status: randomPlan === "Grátis" ? "exempt" : randomStatus,
    });
  }

  return invoices;
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
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">
            Histórico de faturas
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Histórico dos seus pagamentos dentro da plataforma
        </p>
      </div>

      {/* Invoices Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-foreground">ID</TableHead>
              <TableHead className="font-semibold text-foreground">Vencimento</TableHead>
              <TableHead className="font-semibold text-foreground">Valor</TableHead>
              <TableHead className="font-semibold text-foreground">Plano</TableHead>
              <TableHead className="font-semibold text-foreground">Situação</TableHead>
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
              currentInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">
                    {invoice.id}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(invoice.dueDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCurrency(invoice.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invoice.plan}
                  </TableCell>
                  <TableCell>
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
