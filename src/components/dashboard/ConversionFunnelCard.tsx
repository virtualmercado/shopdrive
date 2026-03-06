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
  storeVisits: number;
  productViews: number;
  addToCarts: number;
  purchases: number;
}

const calcRate = (numerator: number, denominator: number): string | null => {
  if (denominator === 0) return null;
  const rate = (numerator / denominator) * 100;
  return rate % 1 === 0 ? `${rate}%` : `${rate.toFixed(1)}%`;
};

const ConversionFunnelCard = () => {
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

        const [visitsRes, viewsRes, cartsRes, purchasesRes] = await Promise.all([
          supabase
            .from("store_events")
            .select("id", { count: "exact", head: true })
            .eq("store_id", user.id)
            .eq("event_type", "store_visit")
            .gte("created_at", since),
          supabase
            .from("store_events")
            .select("id", { count: "exact", head: true })
            .eq("store_id", user.id)
            .eq("event_type", "product_view")
            .gte("created_at", since),
          supabase
            .from("store_events")
            .select("id", { count: "exact", head: true })
            .eq("store_id", user.id)
            .eq("event_type", "add_to_cart")
            .gte("created_at", since),
          supabase
            .from("store_events")
            .select("id", { count: "exact", head: true })
            .eq("store_id", user.id)
            .eq("event_type", "purchase")
            .gte("created_at", since),
        ]);

        setData({
          storeVisits: visitsRes.count ?? 0,
          productViews: viewsRes.count ?? 0,
          addToCarts: cartsRes.count ?? 0,
          purchases: purchasesRes.count ?? 0,
        });
      } catch (err) {
        console.error("Error fetching conversion funnel:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFunnel();
  }, [user]);

  const maxValue = data
    ? Math.max(data.storeVisits, data.productViews, data.addToCarts, data.purchases, 1)
    : 1;

  const steps = data
    ? [
        { label: "Visitas na loja", value: data.storeVisits, unit: "visitas" },
        { label: "Visualizações de produto", value: data.productViews, unit: "visualizações" },
        { label: "Adições ao carrinho", value: data.addToCarts, unit: "adições" },
        { label: "Compras confirmadas", value: data.purchases, unit: "pedidos" },
      ]
    : [];

  const hasData = data && (data.storeVisits > 0 || data.productViews > 0 || data.addToCarts > 0 || data.purchases > 0);
  const totalRate = data ? calcRate(data.purchases, data.storeVisits) : null;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full" style={{ backgroundColor: `${SD_PURPLE}15` }}>
            <TrendingUp className="h-5 w-5" style={{ color: SD_PURPLE }} />
          </div>
          <div>
            <h3 className="text-base font-medium text-foreground">Funil de Conversão da Loja</h3>
            <p className="text-sm text-muted-foreground">
              Jornada do cliente: visita → visualização → carrinho → compra (últimos 30 dias)
            </p>
          </div>
        </div>
        {!loading && hasData && totalRate && (
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
      ) : hasData ? (
        <TooltipProvider delayDuration={100}>
          <div className="space-y-1">
            {steps.map((step, i) => {
              const barPercent = Math.max((step.value / maxValue) * 100, 6);
              const conversionRate = i > 0 ? calcRate(step.value, steps[i - 1].value) : null;

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
                        <span className="text-xs font-medium text-muted-foreground">
                          {step.label}
                        </span>
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
                      <p className="text-xs text-muted-foreground">
                        {step.value} {step.unit}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Compartilhe sua loja para começar a acompanhar o funil de conversão.
        </p>
      )}
    </Card>
  );
};

export default ConversionFunnelCard;
