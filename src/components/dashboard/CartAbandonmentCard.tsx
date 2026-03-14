import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

const SD_PURPLE = "#6A1B9A";
const SD_ORANGE = "#FB8C00";

const CartAbandonmentCard = () => {
  const { user } = useAuth();
  const [carts, setCarts] = useState(0);
  const [purchases, setPurchases] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const since = thirtyDaysAgo.toISOString();

        const [cartsRes, purchasesRes] = await Promise.all([
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

        setCarts(cartsRes.count ?? 0);
        setPurchases(purchasesRes.count ?? 0);
      } catch (err) {
        console.error("Error fetching cart abandonment:", err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [user]);

  const abandonmentRate = carts > 0 ? Math.round(((carts - purchases) / carts) * 100) : 0;
  const hasData = carts > 0 || purchases > 0;

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-base font-medium text-foreground">Abandono de carrinho</h3>
        <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : hasData ? (
        <div className="space-y-4">
          {/* Abandonment rate */}
          <div className="flex items-center justify-center">
            <span
              className="text-4xl font-bold"
              style={{ color: abandonmentRate > 70 ? "#ef4444" : abandonmentRate > 40 ? SD_ORANGE : "#22c55e" }}
            >
              {abandonmentRate}%
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground mb-1">Carrinhos criados</p>
              <p className="text-lg font-semibold" style={{ color: SD_PURPLE }}>
                {carts}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground mb-1">Compras realizadas</p>
              <p className="text-lg font-semibold" style={{ color: "#22c55e" }}>
                {purchases}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Dados insuficientes para calcular o abandono de carrinho.
        </p>
      )}
    </Card>
  );
};

export default CartAbandonmentCard;
