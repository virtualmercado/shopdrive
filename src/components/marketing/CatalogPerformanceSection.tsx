import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, BarChart3, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProductClick {
  product_id: string;
  product_name: string;
  clicks: number;
}

const SD_PURPLE = "#6A1B9A";
const SD_ORANGE = "#FB8C00";

const CatalogPerformanceSection = () => {
  const { user } = useAuth();
  const { buttonBgColor } = useTheme();
  const [totalClicks, setTotalClicks] = useState(0);
  const [topProducts, setTopProducts] = useState<ProductClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchMetrics = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: clicks, error } = await supabase
          .from("catalog_pdf_clicks")
          .select("product_id, created_at")
          .eq("store_id", user.id)
          .gte("created_at", thirtyDaysAgo.toISOString());

        if (error) throw error;

        setTotalClicks(clicks?.length ?? 0);

        if (!clicks || clicks.length === 0) {
          setTopProducts([]);
          setLoading(false);
          return;
        }

        const countMap: Record<string, number> = {};
        for (const c of clicks) {
          countMap[c.product_id] = (countMap[c.product_id] || 0) + 1;
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
            clicks: count,
          }))
        );
      } catch (err) {
        console.error("Error fetching catalog metrics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [user]);

  const maxClicks = topProducts.length > 0 ? topProducts[0].clicks : 1;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Desempenho do Catálogo</CardTitle>
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
            <BarChart3 className="h-5 w-5" style={{ color: SD_PURPLE }} />
          </div>
          <div>
            <CardTitle className="text-lg">📊 Desempenho do Catálogo</CardTitle>
            <CardDescription className="text-[#515151]">
              Veja quais produtos recebem mais cliques vindos do seu catálogo PDF.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main metric */}
        <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
          <div className="p-3 rounded-full" style={{ backgroundColor: `${SD_PURPLE}15` }}>
            <Link2 className="h-6 w-6" style={{ color: SD_PURPLE }} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cliques vindos do Catálogo PDF</p>
            <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
            <p className="text-3xl font-bold text-foreground">🔗 {totalClicks}</p>
          </div>
        </div>

        {topProducts.length > 0 && (
          <>
            {/* Top product highlight */}
            <div className="p-4 rounded-lg border" style={{ borderColor: `${SD_PURPLE}40`, background: `linear-gradient(135deg, ${SD_PURPLE}08, ${SD_ORANGE}08)` }}>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  🥇 Produto mais clicado no catálogo
                </span>
              </div>
              <p className="text-lg font-bold text-foreground">{topProducts[0].product_name}</p>
              <p className="text-sm text-muted-foreground">{topProducts[0].clicks} cliques</p>
            </div>

            {/* Horizontal bar chart */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Ranking dos 10 produtos mais clicados</h4>
              <TooltipProvider delayDuration={200}>
                <div className="space-y-2">
                  {topProducts.map((p, i) => {
                    const barPercent = Math.max((p.clicks / maxClicks) * 100, 4);
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
                            {/* Rank number */}
                            <span
                              className="text-xs font-bold shrink-0 w-5 text-center rounded"
                              style={{ color: i < 3 ? SD_PURPLE : "#888" }}
                            >
                              {i + 1}
                            </span>

                            {/* Product name */}
                            <span className="text-sm text-foreground truncate w-[140px] sm:w-[200px] shrink-0" title={p.product_name}>
                              {p.product_name}
                            </span>

                            {/* Bar */}
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

                            {/* Click count */}
                            <span
                              className="text-sm font-bold shrink-0 w-8 text-right tabular-nums"
                              style={{ color: SD_PURPLE }}
                            >
                              {p.clicks}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px]">
                          <p className="font-semibold text-sm">{p.product_name}</p>
                          <p className="text-xs text-muted-foreground">{p.clicks} clique{p.clicks !== 1 ? "s" : ""}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            </div>
          </>
        )}

        {totalClicks === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum clique registrado nos últimos 30 dias. Gere e compartilhe seu catálogo PDF para começar a rastrear!
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default CatalogPerformanceSection;
