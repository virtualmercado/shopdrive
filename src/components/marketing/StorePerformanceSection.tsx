import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProductView {
  product_id: string;
  product_name: string;
  views: number;
}

const SD_PURPLE = "#6A1B9A";
const SD_ORANGE = "#FB8C00";

const StorePerformanceSection = () => {
  const { user } = useAuth();
  const [totalViews, setTotalViews] = useState(0);
  const [topProducts, setTopProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchMetrics = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: views, error } = await supabase
          .from("store_product_views")
          .select("product_id, created_at")
          .eq("store_id", user.id)
          .gte("created_at", thirtyDaysAgo.toISOString());

        if (error) throw error;

        setTotalViews(views?.length ?? 0);

        if (!views || views.length === 0) {
          setTopProducts([]);
          setLoading(false);
          return;
        }

        const countMap: Record<string, number> = {};
        for (const v of views) {
          countMap[v.product_id] = (countMap[v.product_id] || 0) + 1;
        }

        const sorted = Object.entries(countMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        const productIds = sorted.map(([id]) => id);
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);

        const nameMap: Record<string, string> = {};
        products?.forEach((p) => {
          nameMap[p.id] = p.name;
        });

        setTopProducts(
          sorted.map(([id, count]) => ({
            product_id: id,
            product_name: nameMap[id] || "Produto removido",
            views: count,
          }))
        );
      } catch (err) {
        console.error("Error fetching store view metrics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [user]);

  const maxViews = topProducts.length > 0 ? topProducts[0].views : 1;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Desempenho da Loja</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full" style={{ backgroundColor: `${SD_PURPLE}15` }}>
            <Eye className="h-5 w-5" style={{ color: SD_PURPLE }} />
          </div>
          <div>
            <CardTitle className="text-lg">Desempenho da Loja</CardTitle>
            <CardDescription className="text-[#515151]">
              Veja quais produtos recebem mais visualizações na sua loja pública.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main metric */}
        <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
          <div className="p-3 rounded-full" style={{ backgroundColor: `${SD_PURPLE}15` }}>
            <Eye className="h-6 w-6" style={{ color: SD_PURPLE }} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Visualizações de produtos</p>
            <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
            <p className="text-3xl font-bold text-foreground">👁️ {totalViews}</p>
          </div>
        </div>

        {topProducts.length > 0 && (
          <>
            {/* Top product highlight */}
            <div className="p-4 rounded-lg border" style={{ borderColor: `${SD_PURPLE}40`, background: `linear-gradient(135deg, ${SD_PURPLE}08, ${SD_ORANGE}08)` }}>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  Produto mais visualizado
                </span>
              </div>
              <p className="text-lg font-bold text-foreground">{topProducts[0].product_name}</p>
              <p className="text-sm text-muted-foreground">{topProducts[0].views} visualizações</p>
            </div>

            {/* Horizontal bar chart */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Ranking dos 10 produtos mais visualizados</h4>
              <TooltipProvider delayDuration={200}>
                <div className="space-y-2">
                  {topProducts.map((p, i) => {
                    const barPercent = Math.max((p.views / maxViews) * 100, 4);
                    const isHovered = hoveredIndex === i;

                    return (
                      <Tooltip key={p.product_id}>
                        <TooltipTrigger asChild>
                          <div
                            className="flex items-center gap-3 group cursor-default transition-all duration-200 rounded-md px-2 py-1.5"
                            style={{
                              backgroundColor: isHovered ? `${SD_PURPLE}08` : "transparent",
                            }}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                          >
                            <span
                              className="text-xs font-bold shrink-0 w-5 text-center rounded"
                              style={{ color: i < 3 ? SD_PURPLE : "#888" }}
                            >
                              {i + 1}
                            </span>

                            <span className="text-sm text-foreground truncate w-[140px] sm:w-[200px] shrink-0" title={p.product_name}>
                              {p.product_name}
                            </span>

                            <div className="flex-1 h-7 rounded-md overflow-hidden bg-muted/50 relative">
                              <div
                                className="h-full rounded-md transition-all duration-300 ease-out"
                                style={{
                                  width: `${barPercent}%`,
                                  background: `linear-gradient(90deg, ${SD_PURPLE}, ${SD_ORANGE})`,
                                  opacity: isHovered ? 1 : 0.85,
                                  boxShadow: isHovered ? `0 2px 8px ${SD_PURPLE}40` : "none",
                                }}
                              />
                            </div>

                            <span
                              className="text-sm font-bold shrink-0 w-8 text-right tabular-nums"
                              style={{ color: SD_PURPLE }}
                            >
                              {p.views}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px]">
                          <p className="font-semibold text-sm">{p.product_name}</p>
                          <p className="text-xs text-muted-foreground">{p.views} visualizaç{p.views !== 1 ? "ões" : "ão"}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            </div>
          </>
        )}

        {totalViews === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma visualização registrada nos últimos 30 dias. Compartilhe sua loja para começar a rastrear!
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StorePerformanceSection;
