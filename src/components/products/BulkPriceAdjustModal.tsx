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

  const previews = targets.slice(0, 5).map((p) => ({
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

      // Batch update in chunks to avoid huge requests
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reajustar preços</DialogTitle>
          <DialogDescription>
            Aplique acréscimo ou desconto em massa. A alteração será refletida na loja pública.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Escopo</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 border rounded p-2 cursor-pointer">
                <RadioGroupItem value="all" /> Todos ({allProducts.length})
              </label>
              <label className="flex items-center gap-2 border rounded p-2 cursor-pointer">
                <RadioGroupItem value="filtered" /> Filtrados ({filteredProducts.length})
              </label>
              <label className="flex items-center gap-2 border rounded p-2 cursor-pointer">
                <RadioGroupItem value="category" /> Categoria
              </label>
              <label className="flex items-center gap-2 border rounded p-2 cursor-pointer">
                <RadioGroupItem value="selected" /> Selecionados ({selectedIds.length})
              </label>
            </RadioGroup>
            {scope === "category" && (
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Escolha uma categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={op} onValueChange={(v) => setOp(v as Op)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Acréscimo (+)</SelectItem>
                  <SelectItem value="decrease">Desconto (−)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Percentual (%)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="Ex.: 10"
              />
            </div>
          </div>

          <div className="rounded border p-3 bg-muted/30 text-sm">
            <div className="font-medium mb-1">
              Prévia — {targets.length} produto(s) afetados
              {validPct && ` · ${op === "increase" ? "+" : "−"}${pct}%`}
            </div>
            {previews.length === 0 ? (
              <p className="text-muted-foreground">Nenhum produto no escopo selecionado.</p>
            ) : (
              <ul className="space-y-1">
                {previews.map((p, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatBRL(p.current)} → <strong className="text-foreground">{formatBRL(p.next)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {wouldProduceInvalid && (
              <p className="text-destructive mt-2">
                Operação bloqueada: pelo menos um produto ficaria com preço ≤ 0.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleApply} disabled={!canApply}>
            {submitting ? "Aplicando..." : "Confirmar reajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
