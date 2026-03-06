import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SD_PURPLE = "#6A1B9A";

interface OriginData {
  label: string;
  key: string;
  count: number;
  percentage: number;
  tooltip: string;
}

const ORIGIN_CONFIG: Record<string, { label: string; tooltip: string }> = {
  store: { label: "Loja online", tooltip: "Pedidos realizados diretamente na loja pública." },
  catalog: { label: "Catálogo PDF", tooltip: "Pedidos originados a partir de cliques no catálogo." },
  manual: { label: "Pedidos manuais", tooltip: "Pedidos criados manualmente pelo lojista no painel." },
};

const SalesOriginCard = () => {
  const { user } = useAuth();
  const [data, setData] = useState<OriginData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const paidStatuses = ["paid", "delivered", "shipped", "confirmed", "completed"];

        const { data: orders, error } = await supabase
          .from("orders")
          .select("order_source")
          .eq("store_owner_id", user.id)
          .in("status", paidStatuses)
          .gte("created_at", thirtyDaysAgo.toISOString());

        if (error) throw error;

        const countMap: Record<string, number> = { store: 0, catalog: 0, manual: 0 };
        orders?.forEach((o) => {
          const src = o.order_source || "store";
          countMap[src] = (countMap[src] || 0) + 1;
        });

        const total = Object.values(countMap).reduce((s, c) => s + c, 0);

        const result: OriginData[] = ["store", "catalog", "manual"]
          .map((key) => ({
            key,
            label: ORIGIN_CONFIG[key].label,
            tooltip: ORIGIN_CONFIG[key].tooltip,
            count: countMap[key],
            percentage: total > 0 ? Math.round((countMap[key] / total) * 100) : 0,
          }))
          .filter((d) => d.count > 0);

        setData(result);
      } catch (err) {
        console.error("Error fetching sales origin:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const maxCount = data.length > 0 ? Math.max(...data.map((d) => d.count), 1) : 1;

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="p-2 rounded-full" style={{ backgroundColor: `${SD_PURPLE}15` }}>
          <ShoppingBag className="h-5 w-5" style={{ color: SD_PURPLE }} />
        </div>
        <div>
          <h3 className="text-base font-medium text-foreground">Origem das vendas</h3>
          <p className="text-sm text-muted-foreground">De onde vieram as vendas confirmadas nos últimos 30 dias</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Skeleton className="h-24 w-full" />
        </div>
      ) : data.length > 0 ? (
        <TooltipProvider delayDuration={100}>
          <div className="space-y-3">
            {data.map((item) => {
              const barPercent = Math.max((item.count / maxCount) * 100, 8);
              return (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col gap-1 rounded-md px-2 py-1.5 -mx-2 cursor-default transition-all duration-200 hover:bg-muted/40 hover:shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                        <span className="text-xs font-semibold text-muted-foreground">{item.percentage}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-7 bg-muted/50 rounded-sm overflow-hidden">
                          <div
                            className="h-full transition-all duration-500 ease-out rounded-sm"
                            style={{
                              width: `${barPercent}%`,
                              backgroundColor: SD_PURPLE,
                            }}
                          />
                        </div>
                        <span
                          className="text-sm font-bold shrink-0 tabular-nums min-w-[50px] text-right"
                          style={{ color: SD_PURPLE }}
                        >
                          {item.count}
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-center max-w-[220px]">
                    <p className="font-medium text-xs">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma venda confirmada nos últimos 30 dias.
        </p>
      )}
    </Card>
  );
};

export default SalesOriginCard;
