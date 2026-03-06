import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

const SD_PURPLE = "#6A1B9A";
const SD_ORANGE = "#FB8C00";

interface FunnelData {
  catalogClicks: number;
  productViews: number;
  sales: number;
}

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

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="p-2 rounded-full" style={{ backgroundColor: `${SD_PURPLE}15` }}>
          <TrendingUp className="h-5 w-5" style={{ color: SD_PURPLE }} />
        </div>
        <div>
          <h3 className="text-base font-medium text-foreground">Funil de Interesse da Loja</h3>
          <p className="text-sm text-[#515151]">Jornada do cliente: catálogo → visualização → venda (últimos 30 dias)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Skeleton className="h-24 w-full" />
        </div>
      ) : data && (data.catalogClicks > 0 || data.productViews > 0 || data.sales > 0) ? (
        <div className="space-y-1">
          {steps.map((step, i) => {
            const barPercent = Math.max((step.value / maxValue) * 100, 6);
            return (
              <div key={step.label}>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-8 rounded-md overflow-hidden bg-muted/50">
                      <div
                        className="h-full rounded-md transition-all duration-500 ease-out"
                        style={{
                          width: `${barPercent}%`,
                          background: `linear-gradient(90deg, ${SD_PURPLE}, ${SD_ORANGE})`,
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    <span
                      className="text-sm font-bold shrink-0 tabular-nums min-w-[60px] text-right"
                      style={{ color: SD_PURPLE }}
                    >
                      {step.value} {step.unit.slice(0, 1) === "c" ? "" : ""}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{step.value} {step.unit}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Compartilhe sua loja e seu catálogo PDF para começar a acompanhar o funil de interesse.
        </p>
      )}
    </Card>
  );
};

export default InterestFunnelCard;
