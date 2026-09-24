import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cartesian, comboKey, type VariantLimits, type VariantOptionGroup } from "@/lib/productVariants";

export interface VariantCellState {
  stock: number;
  active: boolean;
  sku?: string;
}

interface Props {
  groups: VariantOptionGroup[];
  state: Record<string, VariantCellState>;
  onChange: (next: Record<string, VariantCellState>) => void;
  limits: VariantLimits;
}

export function VariantMatrixEditor({ groups, state, onChange, limits }: Props) {
  const { toast } = useToast();
  const [bulk, setBulk] = useState("");
  const combos = useMemo(() => cartesian(groups), [groups]);
  const overLimit = combos.length > limits.max_variants;

  const cell = (key: string): VariantCellState => state[key] ?? { stock: 0, active: true };
  const update = (key: string, patch: Partial<VariantCellState>) =>
    onChange({ ...state, [key]: { ...cell(key), ...patch } });

  const total = combos.reduce((sum, c) => {
    const s = cell(comboKey(c.map((x) => x.id)));
    return s.active ? sum + (s.stock || 0) : sum;
  }, 0);

  if (overLimit) {
    return (
      <p className="text-sm text-destructive">
        Essas variações geram {combos.length} combinações. O limite é {limits.max_variants} por produto — reduza a
        quantidade de valores.
      </p>
    );
  }

  const applyBulk = () => {
    const n = Math.round(Number(bulk));
    if (!Number.isFinite(n) || n < 0) return;
    const next = { ...state };
    combos.forEach((c) => {
      const k = comboKey(c.map((x) => x.id));
      next[k] = { ...cell(k), stock: n };
    });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Combinações e estoque ({combos.length})</p>
        <p className="text-xs text-muted-foreground">Estoque total: {total} un.</p>
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          min="0"
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          placeholder="Estoque para todas"
          className="text-sm h-8 max-w-[180px]"
        />
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={applyBulk}>
          Definir para todas
        </Button>
      </div>
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {combos.map((c) => {
          const key = comboKey(c.map((x) => x.id));
          const s = cell(key);
          return (
            <div
              key={key}
              className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_90px_1fr_auto] gap-2 items-center p-2 rounded-md border ${s.active ? "" : "opacity-60"}`}
            >
              <span className="text-sm font-medium break-words">{c.map((x) => x.value).join(" / ")}</span>
              <Input
                type="number"
                min="0"
                aria-label={`Estoque ${c.map((x) => x.value).join(" / ")}`}
                value={String(s.stock)}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value || 0));
                  if (!Number.isFinite(n) || n < 0) return;
                  update(key, { stock: n });
                }}
                className="text-sm h-8 w-20 sm:w-full"
              />
              <div className="flex items-center gap-1 min-w-0 col-span-1">
                <span className="text-xs text-muted-foreground truncate">{s.sku || "SKU gerado ao salvar"}</span>
                {s.sku && (
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-muted"
                    aria-label="Copiar SKU"
                    onClick={() => {
                      navigator.clipboard.writeText(s.sku!);
                      toast({ title: "SKU copiado!", description: s.sku });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <label className="flex items-center gap-1 text-xs justify-end">
                <Switch checked={s.active} onCheckedChange={(v) => update(key, { active: v })} />
                {s.active ? "Ativa" : "Inativa"}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
