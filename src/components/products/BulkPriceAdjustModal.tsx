import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  price: number;
  promotional_price?: number | null;
  category_id?: string | null;
  is_active: boolean;
}

interface Category { id: string; name: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allProducts: Product[];
  filteredProducts: Product[];
  selectedIds: string[];
  categories: Category[];
  onApplied: () => void;
}

type Scope = "all" | "filtered" | "category" | "selected";
type Op = "increase" | "decrease";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const round2 = (n: number) => Math.round(n * 100) / 100;

export const BulkPriceAdjustModal = ({
  open,
  onOpenChange,
  allProducts,
  filteredProducts,
  selectedIds,
  categories,
  onApplied,
}: Props) => {
  const [scope, setScope] = useState<Scope>("filtered");
  const [categoryId, setCategoryId] = useState<string>("");
  const [op, setOp] = useState<Op>("increase");
  const [percent, setPercent] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const targets = useMemo<Product[]>(() => {
    switch (scope) {
      case "all":
        return allProducts;
      case "filtered":
        return filteredProducts;
      case "category":
        return categoryId ? allProducts.filter((p) => p.category_id === categoryId) : [];
      case "selected":
        return allProducts.filter((p) => selectedIds.includes(p.id));
    }
  }, [scope, categoryId, allProducts, filteredProducts, selectedIds]);

  const pct = Number(String(percent).replace(",", "."));
  const validPct = !Number.isNaN(pct) && pct > 0;
  const factor = op === "increase" ? 1 + pct / 100 : 1 - pct / 100;

  const previews = targets.map((p) => ({
    name: p.name,
    current: Number(p.price || 0),
    next: round2(Number(p.price || 0) * factor),
  }));

  const wouldProduceInvalid = targets.some(
    (p) => round2(Number(p.price || 0) * factor) <= 0
  );

  const canApply = validPct && targets.length > 0 && !wouldProduceInvalid && !submitting;

  const handleApply = async () => {
    if (!canApply) return;
    if (!confirm("Confirmar reajuste de preços? Essa alteração atualizará os preços dos produtos selecionados e será refletida na loja pública.")) return;

    setSubmitting(true);
    try {
      const updates = targets.map((p) => ({
        id: p.id,
        newPrice: round2(Number(p.price || 0) * factor),
      }));

      const chunkSize = 50;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map((u) =>
            supabase.from("products").update({ price: u.newPrice }).eq("id", u.id)
          )
        );
      }

      toast({
        title: "Reajuste aplicado",
        description: `${updates.length} produto(s) atualizados com sucesso.`,
      });
      onApplied();
      onOpenChange(false);
      setPercent("");
    } catch (e) {
      console.error(e);
      toast({
        title: "Erro",
        description: "Não foi possível aplicar o reajuste.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 sm:max-w-none w-[95vw] md:w-[90vw] lg:w-[min(1100px,95vw)] lg:min-w-[900px] max-h-[90vh] flex flex-col overflow-hidden"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Reajustar preços</DialogTitle>
          <DialogDescription>
            Aplique acréscimo ou desconto em massa. A alteração será refletida na loja pública.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[35%_65%]">
            {/* Configurações */}
            <div className="p-6 space-y-5 md:border-r border-b md:border-b-0">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Escopo</Label>
                <RadioGroup
                  value={scope}
                  onValueChange={(v) => setScope(v as Scope)}
                  className="flex flex-col gap-2"
                >
                  <label className="flex items-center gap-2 border rounded-md p-2.5 cursor-pointer hover:bg-accent/40 text-sm">
                    <RadioGroupItem value="all" /> Todos ({allProducts.length})
                  </label>
                  <label className="flex items-center gap-2 border rounded-md p-2.5 cursor-pointer hover:bg-accent/40 text-sm">
                    <RadioGroupItem value="category" /> Categoria
                  </label>
                  <label className="flex items-center gap-2 border rounded-md p-2.5 cursor-pointer hover:bg-accent/40 text-sm">
                    <RadioGroupItem value="filtered" /> Filtrados ({filteredProducts.length})
                  </label>
                  <label className="flex items-center gap-2 border rounded-md p-2.5 cursor-pointer hover:bg-accent/40 text-sm">
                    <RadioGroupItem value="selected" /> Selecionados ({selectedIds.length})
                  </label>
                </RadioGroup>
                {scope === "category" && (
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="mt-2"><SelectValue placeholder="Escolha uma categoria" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tipo de reajuste</Label>
                <Select value={op} onValueChange={(v) => setOp(v as Op)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Acréscimo (+)</SelectItem>
                    <SelectItem value="decrease">Desconto (−)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Percentual (%)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  placeholder="Ex.: 10"
                />
                <p className="text-xs text-muted-foreground">Exemplos: 5, 10, 15</p>
              </div>
            </div>

            {/* Prévia */}
            <div className="p-6 space-y-3 min-w-0">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span><strong>{targets.length}</strong> produto(s) afetados</span>
                  <span>
                    Operação:{" "}
                    <strong>{op === "increase" ? "Acréscimo (+)" : "Desconto (−)"}</strong>
                  </span>
                  <span>
                    Percentual: <strong>{validPct ? `${pct}%` : "—"}</strong>
                  </span>
                </div>
                {wouldProduceInvalid && (
                  <p className="text-destructive mt-2 text-xs">
                    Operação bloqueada: pelo menos um produto ficaria com preço ≤ 0.
                  </p>
                )}
              </div>

              <div className="rounded-md border">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <span>Produto</span>
                  <span className="text-right w-24">Preço atual</span>
                  <span className="text-right w-24">Novo preço</span>
                </div>
                <div className="max-h-[350px] overflow-y-auto">
                  {previews.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      Nenhum produto no escopo selecionado.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {previews.map((p, i) => (
                        <li
                          key={i}
                          className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-sm items-center"
                        >
                          <span className="truncate" title={p.name}>{p.name}</span>
                          <span className="text-right w-24 text-muted-foreground whitespace-nowrap">
                            {formatBRL(p.current)}
                          </span>
                          <span className="text-right w-24 font-medium whitespace-nowrap">
                            {formatBRL(p.next)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleApply} disabled={!canApply}>
            {submitting ? "Aplicando..." : "Confirmar reajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
