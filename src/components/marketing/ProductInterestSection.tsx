import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProductInterest {
  product_id: string;
  product_name: string;
  views: number;
  sales: number;
  rate: number;
}

const SD_PURPLE = "#6A1B9A";
const SD_ORANGE = "#FB8C00";

const ProductInterestSection = () => {
  const { user } = useAuth();
  const [topProducts, setTopProducts] = useState<ProductInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchInterestMetrics = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const since = thirtyDaysAgo.toISOString();

        // Fetch views
        const { data: views } = await supabase
          .from("store_product_views")
          .select("product_id")
          .eq("store_id", user.id)
          .gte("created_at", since);

        // Fetch confirmed order IDs
        const paidStatuses = ["paid", "delivered", "shipped", "confirmed", "completed"];
        const { data: orders } = await supabase
          .from("orders")
          .select("id")
          .eq("store_owner_id", user.id)
          .in("status", paidStatuses)
          .gte("created_at", since);

        if (!views || views.length === 0) {
          setTopProducts([]);
          setLoading(false);
          return;
        }

        // Count views per product
        const viewMap: Record<string, number> = {};
        for (const v of views) {
          viewMap[v.product_id] = (viewMap[v.product_id] || 0) + 1;
        }

        // Count sales per product from order_items
        const salesMap: Record<string, number> = {};
        if (orders && orders.length > 0) {
          const orderIds = orders.map((o) => o.id);
          const { data: orderItems } = await supabase
            .from("order_items")
            .select("product_id, quantity")
            .in("order_id", orderIds);

          if (orderItems) {
            for (const item of orderItems) {
              if (viewMap[item.product_id] !== undefined) {
                salesMap[item.product_id] = (salesMap[item.product_id] || 0) + item.quantity;
              }
            }
          }
        }

        // Fetch product names
        const allProductIds = Object.keys(viewMap);
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .in("id", allProductIds);

        const nameMap: Record<string, string> = {};
        products?.forEach((p) => { nameMap[p.id] = p.name; });

        const interestList: ProductInterest[] = allProductIds
          .map((pid) => {
            const v = viewMap[pid] || 0;
            const s = salesMap[pid] || 0;
            return {
              product_id: pid,
              product_name: nameMap[pid] || "Produto removido",
              views: v,
              sales: s,
              rate: v > 0 ? (s / v) * 100 : 0,
            };
          })
          .filter((p) => p.rate > 0)
          .sort((a, b) => b.rate - a.rate)
          .slice(0, 5);

        setTopProducts(interestList);
      } catch (err) {
        console.error("Error fetching interest metrics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInterestMetrics();
  }, [user]);

  const maxRate = topProducts.length > 0 ? topProducts[0].rate : 1;
  const bestProduct = topProducts.length > 0 ? topProducts[0] : null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Taxa de Interesse dos Produtos</CardTitle>
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
            <TrendingUp className="h-5 w-5" style={{ color: SD_PURPLE }} />
          </div>
          <div>
            <CardTitle className="text-lg">Taxa de Interesse dos Produtos</CardTitle>
            <CardDescription className="text-[#515151]">
              Mede a conversão de visualizações em vendas por produto.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Best conversion product highlight */}
        {bestProduct ? (
          <div
            className="p-4 rounded-lg border"
            style={{
              borderColor: `${SD_PURPLE}40`,
              background: `linear-gradient(135deg, ${SD_PURPLE}08, ${SD_ORANGE}08)`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-muted-foreground">
                Produto com melhor taxa de conversão
              </span>
            </div>
            <p className="text-lg font-bold text-foreground break-words">{bestProduct.product_name}</p>
            <p className="text-sm font-semibold" style={{ color: SD_PURPLE }}>
              {bestProduct.rate.toFixed(1)}% de conversão
            </p>
            <p className="text-xs text-muted-foreground">
              {bestProduct.sales} {bestProduct.sales === 1 ? "venda" : "vendas"} / {bestProduct.views} {bestProduct.views === 1 ? "visualização" : "visualizações"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Ainda não há dados suficientes para identificar o produto com melhor conversão.
          </p>
        )}

        {/* Interest rate ranking */}
        {topProducts.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              Ranking dos 5 produtos com maior taxa de interesse
            </h4>
            <TooltipProvider delayDuration={200}>
              <div className="space-y-2">
                {topProducts.map((p, i) => {
                  const barPercent = Math.max((p.rate / maxRate) * 100, 4);
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

                          <span
                            className="text-sm text-foreground truncate w-[120px] sm:w-[180px] shrink-0"
                            title={p.product_name}
                          >
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
                            className="text-sm font-bold shrink-0 w-10 text-right tabular-nums"
                            style={{ color: SD_PURPLE }}
                          >
                            {p.rate.toFixed(0)}%
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px]">
                        <p className="font-semibold text-sm">{p.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.rate.toFixed(1)}% — {p.sales} {p.sales === 1 ? "venda" : "vendas"} / {p.views} {p.views === 1 ? "visualização" : "visualizações"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </div>
        ) : (
          !bestProduct && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ainda não há dados suficientes para calcular a taxa de interesse dos produtos. Compartilhe sua loja para começar a acompanhar o desempenho!
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
};

export default ProductInterestSection;
