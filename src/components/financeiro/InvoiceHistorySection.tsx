import { useState, useEffect } from "react";
import { Receipt, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

interface UpcomingInvoice {
  id: string; // virtual id "upcoming"
  due_date: string;
  amount: number;
  plan: string | null;
  status: "upcoming";
  payment_method: string | null;
  isVirtual: true;
}

type Row = (Invoice & { isVirtual?: false }) | UpcomingInvoice;

const ITEMS_PER_PAGE = 12;

const GRACE_DAYS = 37;

// Statuses considered "open/aguardando pagamento" before expiry
const OPEN_STATUSES = new Set(["pending", "overdue", "failed", "rejected"]);
// Statuses that are terminal / not payable regardless of date
const TERMINAL_STATUSES = new Set(["paid", "cancelled", "refunded", "exempt", "expired"]);

const daysSince = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

/** Effective status applied on the client for display/eligibility only. */
const getEffectiveStatus = (status: string, dueDate: string): string => {
  if (status === "upcoming") return "upcoming";
  if (TERMINAL_STATUSES.has(status)) return status;
  if (OPEN_STATUSES.has(status) && daysSince(dueDate) > GRACE_DAYS) {
    return "expired";
  }
  return status;
};

const isPayable = (effectiveStatus: string, subscriptionStatus?: string) => {
  // Subscription already downgraded / ended → never payable
  if (subscriptionStatus && ["cancelled", "canceled", "ended"].includes(subscriptionStatus)) {
    return false;
  }
  if (effectiveStatus === "upcoming") return true;
  if (OPEN_STATUSES.has(effectiveStatus)) return true;
  return false;
};

// Sort priority: upcoming → open (asc by due) → paid (desc) → expired (desc)
const sortPriority = (effectiveStatus: string): number => {
  if (effectiveStatus === "upcoming") return 0;
  if (OPEN_STATUSES.has(effectiveStatus)) return 1;
  if (effectiveStatus === "paid") return 2;
  if (effectiveStatus === "expired") return 3;
  return 4;
};

const getStatusBadge = (status: string) => {
  const baseClasses = "text-white font-normal text-xs py-1 rounded text-center w-[160px] inline-block";

  switch (status) {
    case "pending":
    case "overdue":
    case "failed":
    case "rejected":
      return <Badge className={`bg-orange-400 hover:bg-orange-400 ${baseClasses}`}>Aguardando pagamento</Badge>;
    case "paid":
      return <Badge className={`bg-green-500 hover:bg-green-500 ${baseClasses}`}>Paga</Badge>;
    case "expired":
      return <Badge className={`bg-gray-500 hover:bg-gray-500 ${baseClasses}`}>Expirada</Badge>;
    case "cancelled":
      return <Badge className={`bg-gray-500 hover:bg-gray-500 ${baseClasses}`}>Cancelada</Badge>;
    case "refunded":
      return <Badge className={`bg-blue-500 hover:bg-blue-500 ${baseClasses}`}>Reembolsado</Badge>;
    case "exempt":
      return <Badge className={`bg-gray-400 hover:bg-gray-400 ${baseClasses}`}>Isenta</Badge>;
    case "upcoming":
      return <Badge className={`bg-blue-500 hover:bg-blue-500 ${baseClasses}`}>A vencer</Badge>;
    default:
      return <Badge className={`bg-gray-400 hover:bg-gray-400 ${baseClasses}`}>{status}</Badge>;
  }
};


const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("pt-BR");

const formatMethod = (m: string | null) =>
  m === "credit_card" ? "Cartão" : m === "pix" ? "PIX" : m === "boleto" ? "Boleto" : "—";

export const InvoiceHistorySection = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingInvoice | null>(null);
  const [subscription, setSubscription] = useState<{
    plan_id: string;
    billing_cycle: string;
    status: string;
    no_charge: boolean | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: invData, error: invErr }, { data: subData }] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, due_date, amount, plan, status, payment_method, mp_payment_id, paid_at, created_at")
          .eq("subscriber_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("master_subscriptions")
          .select("plan_id, billing_cycle, status, no_charge, current_period_end, payment_method")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (invErr) throw invErr;
      const list = (invData as Invoice[]) || [];
      setInvoices(list);

      // Próxima fatura a vencer (virtual) — só quando NÃO há fatura pendente em aberto
      if (subData && !subData.no_charge && subData.status === "active" && subData.current_period_end) {
        const hasOpenInvoice = list.some((i) =>
          ["pending", "overdue"].includes(i.status)
        );
        const dueDate = new Date(subData.current_period_end);
        const isFuture = dueDate.getTime() > Date.now();
        if (!hasOpenInvoice && isFuture) {
          const planPrices: Record<string, number> = { pro: 29.97, premium: 49.97 };
          const monthly = planPrices[subData.plan_id?.toLowerCase()] ?? 0;
          const amount = subData.billing_cycle === "annual" ? monthly * 12 * 0.7 : monthly;
          setUpcoming({
            id: "upcoming",
            due_date: subData.current_period_end,
            amount,
            plan: subData.plan_id,
            status: "upcoming",
            payment_method: subData.payment_method ?? null,
            isVirtual: true,
          });
        } else {
          setUpcoming(null);
        }
        setSubscription({
          plan_id: subData.plan_id,
          billing_cycle: subData.billing_cycle,
          status: subData.status,
          no_charge: subData.no_charge,
        });
      } else {
        setUpcoming(null);
        setSubscription(
          subData
            ? {
                plan_id: subData.plan_id,
                billing_cycle: subData.billing_cycle,
                status: subData.status,
                no_charge: subData.no_charge,
              }
            : null
        );
      }
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

  const handlePayInvoice = (row: Row) => {
    const planId =
      (row.plan || subscription?.plan_id || "pro").toLowerCase();
    const cycle =
      (subscription?.billing_cycle || "monthly") === "annual" ? "anual" : "mensal";
    const invoiceParam = row.id !== "upcoming" ? `&fatura=${row.id}` : "";
    navigate(
      `/gestor/checkout-assinatura?plano=${planId}&ciclo=${cycle}&origem=regularizar&flow=pay_invoice${invoiceParam}`
    );
  };

  // Compose rows: upcoming on top + invoices
  const allRows: Row[] = upcoming ? [upcoming, ...invoices] : invoices;

  const totalPages = Math.ceil(allRows.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentInvoices = allRows.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
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
          <h2 className="text-lg font-semibold text-foreground">Histórico de faturas</h2>
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
              <TableHead className="font-semibold text-gray-700 text-sm py-3">Situação</TableHead>
              <TableHead className="font-semibold text-gray-700 text-sm py-3 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando faturas...
                </TableCell>
              </TableRow>
            ) : currentInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Seu histórico será exibido aqui após a primeira cobrança registrada.
                </TableCell>
              </TableRow>
            ) : (
              currentInvoices.map((invoice, index) => {
                const isVirtual = (invoice as UpcomingInvoice).isVirtual === true;
                const canPay = PAYABLE_STATUSES.has(invoice.status);
                return (
                  <TableRow
                    key={invoice.id}
                    className={`border-b border-gray-100 ${
                      isVirtual
                        ? "bg-blue-50/40"
                        : index % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50/50"
                    }`}
                  >
                    <TableCell className="text-gray-600 py-3">{formatDate(invoice.due_date)}</TableCell>
                    <TableCell className="text-gray-600 py-3">{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell className="text-gray-600 py-3 uppercase">{invoice.plan || "—"}</TableCell>
                    <TableCell className="text-gray-600 py-3">{formatMethod(invoice.payment_method)}</TableCell>
                    <TableCell className="py-3">{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="py-3 text-right">
                      {canPay ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-2"
                          onClick={() => handlePayInvoice(invoice)}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Pagar fatura
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
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
