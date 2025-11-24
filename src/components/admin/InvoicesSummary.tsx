import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

export const InvoicesSummary = () => {
  const { data } = useQuery({
    queryKey: ["invoices-summary"],
    queryFn: async () => {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const { count: totalInvoices } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfMonth.toISOString());

      const { count: paidInvoices } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("status", "paid")
        .gte("created_at", startOfMonth.toISOString());

      const { count: overdueInvoices } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("status", "overdue");

      const { data: monthlyPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "paid")
        .gte("created_at", startOfMonth.toISOString());

      const projectedRevenue = monthlyPayments?.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      ) || 0;

      return {
        totalInvoices: totalInvoices || 0,
        paidInvoices: paidInvoices || 0,
        overdueInvoices: overdueInvoices || 0,
        projectedRevenue,
      };
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faturas e Pagamentos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Faturas Geradas</p>
              <p className="text-2xl font-bold">{data?.totalInvoices || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Faturas Pagas</p>
              <p className="text-2xl font-bold">{data?.paidInvoices || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm text-muted-foreground">Atrasadas</p>
              <p className="text-2xl font-bold">{data?.overdueInvoices || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Projeção</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(data?.projectedRevenue || 0)}
              </p>
            </div>
          </div>
        </div>
        <Link to="/gestor/faturas">
          <Button variant="outline" className="w-full">
            Ver Todas as Faturas
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};
