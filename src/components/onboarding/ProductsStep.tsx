import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Package, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProductsStepProps {
  storeId: string;
}

/** Reutiliza integralmente o cadastro real de produtos — nada fictício é criado. */
const ProductsStep = ({ storeId }: ProductsStepProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ count: activeCount }, { count: totalCount }] = await Promise.all([
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("user_id", storeId)
          .eq("is_active", true),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", storeId),
      ]);
      setActive(activeCount ?? 0);
      setTotal(totalCount ?? 0);
      setLoading(false);
    })();
  }, [storeId]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={active >= 1 ? "default" : "outline"} className="gap-1">
          {active >= 1 && <Check className="h-3 w-3" />} Produtos ativos: {active}
        </Badge>
        <Badge variant="outline">Produtos cadastrados: {total}</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        {active >= 3
          ? "Sua vitrine já tem variedade suficiente para atrair clientes."
          : active >= 1
          ? "Requisito mínimo atendido. Com 3 ou mais produtos sua vitrine fica ainda mais atraente — mas não é obrigatório."
          : "Cadastre pelo menos um produto real para sua loja poder vender."}
      </p>

      <Button
        variant={active >= 1 ? "outline" : "default"}
        onClick={() => navigate("/lojista/products")}
      >
        {active >= 1 ? <Package className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
        {active >= 1 ? "Gerenciar meus produtos" : "Cadastrar meu primeiro produto"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Ao voltar para esta página, seu progresso é recalculado automaticamente.
      </p>
    </div>
  );
};

export default ProductsStep;
