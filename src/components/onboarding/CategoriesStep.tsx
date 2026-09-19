import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, FolderTree, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CategoryManagementModal } from "@/components/products/CategoryManagementModal";

interface CategoriesStepProps {
  storeId: string;
  onChanged: () => void | Promise<unknown>;
}

interface CategoryRow {
  id: string;
  name: string;
  is_active: boolean;
  products: number;
}

/** Reutiliza o módulo oficial de categorias — sem CRUD paralelo. */
const CategoriesStep = ({ storeId, onChanged }: CategoriesStepProps) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    const { data: cats } = await supabase
      .from("product_categories")
      .select("id, name, is_active")
      .eq("user_id", storeId)
      .order("name");
    const list = cats ?? [];
    const counts = new Map<string, number>();
    if (list.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("category_id")
        .eq("user_id", storeId)
        .not("category_id", "is", null);
      (prods ?? []).forEach((p: { category_id: string | null }) => {
        if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
      });
    }
    setRows(list.map((c) => ({ ...c, products: counts.get(c.id) ?? 0 })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const active = rows.filter((r) => r.is_active).length;

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {active > 0 ? (
        <Badge variant="default" className="gap-1">
          <Check className="h-3 w-3" /> {active} {active === 1 ? "categoria ativa" : "categorias ativas"}
        </Badge>
      ) : (
        <p className="text-sm text-muted-foreground">
          As categorias organizam sua vitrine e ajudam o cliente a encontrar os produtos. Crie ao menos uma.
        </p>
      )}

      {rows.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between gap-2 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-muted-foreground" />
                  {c.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.products} {c.products === 1 ? "produto" : "produtos"}
                  {!c.is_active && " · inativa"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button variant={active > 0 ? "outline" : "default"} onClick={() => setModalOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        {active > 0 ? "Gerenciar categorias" : "Criar minha primeira categoria"}
      </Button>

      <CategoryManagementModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCategoryChange={async () => {
          await load();
          await onChanged();
        }}
      />
    </div>
  );
};

export default CategoriesStep;
