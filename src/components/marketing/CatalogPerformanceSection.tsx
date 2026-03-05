import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Trophy, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";
import { useTheme } from "@/contexts/ThemeContext";

interface ProductClick {
  product_id: string;
  product_name: string;
  clicks: number;
}

const CatalogPerformanceSection = () => {
  const { user } = useAuth();
  const { buttonBgColor } = useTheme();
  const [totalClicks, setTotalClicks] = useState(0);
  const [topProducts, setTopProducts] = useState<ProductClick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchMetrics = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get all clicks for last 30 days
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

        // Aggregate by product_id
        const countMap: Record<string, number> = {};
        for (const c of clicks) {
          countMap[c.product_id] = (countMap[c.product_id] || 0) + 1;
        }

        // Sort and take top 5
        const sorted = Object.entries(countMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        // Fetch product names
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
          <CardTitle className="text-lg">📊 Desempenho do Catálogo</CardTitle>
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
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
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
          <div className="p-3 rounded-full" style={{ backgroundColor: `${buttonBgColor}15` }}>
            <Link2 className="h-6 w-6" style={{ color: buttonBgColor }} />
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
            <div className="p-4 rounded-lg border" style={{ borderColor: `${buttonBgColor}40` }}>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  🥇 Produto mais clicado no catálogo
                </span>
              </div>
              <p className="text-lg font-bold text-foreground">{topProducts[0].product_name}</p>
              <p className="text-sm text-muted-foreground">{topProducts[0].clicks} cliques</p>
            </div>

            {/* Ranking */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Ranking de produtos</h4>
              {topProducts.map((p, i) => (
                <div key={p.product_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[70%] text-foreground">{p.product_name}</span>
                    <span className="font-semibold text-foreground">{p.clicks}</span>
                  </div>
                  <Progress
                    value={(p.clicks / maxClicks) * 100}
                    className="h-2"
                  />
                </div>
              ))}
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
