import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SD_PURPLE = "#6A1B9A";

interface FunnelData {
  catalogClicks: number;
  productViews: number;
  sales: number;
}

const calcRate = (numerator: number, denominator: number): string | null => {
  if (denominator === 0) return null;
  const rate = (numerator / denominator) * 100;
  return rate % 1 === 0 ? `${rate}%` : `${rate.toFixed(1)}%`;
};

const InterestFunnelCard = () => {
  const { user } = useAuth();
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchFunnel = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const since = thirtyDaysAgo.toISOString();

        const [catalogRes, viewsRes, ordersRes] = await Promise.all([
          supabase
            .from("catalog_pdf_clicks")
            .select("id", { count: "exact", head: true })
            .eq("store_id", user.id)
            .gte("created_at", since),
          supabase
            .from("store_product_views")
            .select("id", { count: "exact", head: true })
            .eq("store_id", user.id)
            .gte("created_at", since),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("store_owner_id", user.id)
            .in("status", ["paid", "delivered", "shipped", "confirmed", "completed"])
            .in("order_source", ["store", "catalog"])
            .gte("created_at", since),
        ]);

        setData({
          catalogClicks: catalogRes.count ?? 0,
          productViews: viewsRes.count ?? 0,
          sales: ordersRes.count ?? 0,
        });
      } catch (err) {
        console.error("Error fetching funnel data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFunnel();
  }, [user]);

  const maxValue = data ? Math.max(data.catalogClicks, data.productViews, data.sales, 1) : 1;

  const steps = data
    ? [
        { label: "Cliques no Catálogo PDF", value: data.catalogClicks, unit: "cliques" },
        { label: "Visualizações de Produtos", value: data.productViews, unit: "visualizações" },
        { label: "Vendas Confirmadas", value: data.sales, unit: "pedidos" },
      ]
    : [];

  const totalRate = data ? calcRate(data.sales, data.catalogClicks) : null;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full" style={{ backgroundColor: `${SD_PURPLE}15` }}>
            <TrendingUp className="h-5 w-5" style={{ color: SD_PURPLE }} />
          </div>
          <div>
            <h3 className="text-base font-medium text-foreground">Funil de Interesse da Loja</h3>
            <p className="text-sm text-muted-foreground">Jornada do cliente: catálogo → visualização → venda (últimos 30 dias)</p>
          </div>
        </div>
        {!loading && data && (data.catalogClicks > 0 || data.productViews > 0 || data.sales > 0) && totalRate && (
          <Badge
            className="shrink-0 text-xs font-semibold border-none px-2.5 py-1"
            style={{ backgroundColor: `${SD_PURPLE}15`, color: SD_PURPLE }}
          >
            Conversão: {totalRate}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Skeleton className="h-24 w-full" />
        </div>
      ) : data && (data.catalogClicks > 0 || data.productViews > 0 || data.sales > 0) ? (
        <TooltipProvider delayDuration={100}>
          <div className="space-y-1">
            {steps.map((step, i) => {
              const barPercent = Math.max((step.value / maxValue) * 100, 6);
              const conversionRate =
                i > 0 ? calcRate(step.value, steps[i - 1].value) : null;

              return (
                <div key={step.label}>
                  {i > 0 && (
                    <div className="flex items-center justify-center gap-1.5 py-1">
                      <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
                      {conversionRate && (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {conversionRate}
                        </span>
                      )}
                    </div>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col gap-1 rounded-md px-2 py-1.5 -mx-2 cursor-default transition-all duration-200 hover:bg-muted/40 hover:shadow-sm">
                        <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-8 bg-muted/50 rounded-sm overflow-hidden">
                            <div
                              className="h-full transition-all duration-500 ease-out rounded-sm"
                              style={{
                                width: `${barPercent}%`,
                                backgroundColor: SD_PURPLE,
                              }}
                            />
                          </div>
                          <span
                            className="text-sm font-bold shrink-0 tabular-nums min-w-[60px] text-right"
                            style={{ color: SD_PURPLE }}
                          >
                            {step.value}
                          </span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-center">
                      <p className="font-medium text-xs">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.value} {step.unit}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Compartilhe sua loja e seu catálogo PDF para começar a acompanhar o funil de interesse.
        </p>
      )}
    </Card>
  );
};

export default InterestFunnelCard;
