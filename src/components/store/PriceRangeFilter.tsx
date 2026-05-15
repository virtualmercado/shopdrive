import { PRICE_RANGES, PriceRangeId } from "@/lib/priceRanges";

interface PriceRangeFilterProps {
  counts: Record<PriceRangeId, number>;
  selected: PriceRangeId | null;
  onSelect: (id: PriceRangeId | null) => void;
  accentColor: string;
}

const PriceRangeFilter = ({ counts, selected, onSelect, accentColor }: PriceRangeFilterProps) => {
  return (
    <div>
      <h3 className="font-semibold text-foreground mb-4">Filtrar por Preço</h3>
      <nav className="space-y-1" aria-label="Filtro por faixa de preço">
        <button
          onClick={() => onSelect(null)}
          className="block w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-muted/50"
          style={{
            backgroundColor: selected === null ? `${accentColor}15` : "transparent",
            color: selected === null ? accentColor : "inherit",
            fontWeight: selected === null ? 600 : 400,
          }}
          aria-pressed={selected === null}
        >
          Todos os preços
        </button>
        {PRICE_RANGES.map(range => {
          const count = counts[range.id] ?? 0;
          const isActive = selected === range.id;
          return (
            <button
              key={range.id}
              onClick={() => onSelect(isActive ? null : range.id)}
              className="block w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-muted/50"
              style={{
                backgroundColor: isActive ? `${accentColor}15` : "transparent",
                color: isActive ? accentColor : "inherit",
                fontWeight: isActive ? 600 : 400,
                opacity: count === 0 && !isActive ? 0.55 : 1,
              }}
              aria-pressed={isActive}
              aria-label={`${range.label} (${count} produtos)`}
            >
              <span>{range.label}</span>
              <span className="text-muted-foreground ml-1">({count})</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default PriceRangeFilter;
