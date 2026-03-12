import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PeriodComparisonIndicatorProps {
  current: number;
  previous: number;
  type: 'currency' | 'count' | 'percentage';
}

export const PeriodComparisonIndicator = ({ current, previous, type }: PeriodComparisonIndicatorProps) => {
  if (type === 'percentage') {
    const diff = current - previous;
    const rounded = Math.round(diff * 10) / 10;

    if (rounded === 0) {
      return (
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Minus className="h-3 w-3" />
          <span>Estável vs período anterior</span>
        </div>
      );
    }

    // For inadimplência: increase is bad (red), decrease is good (green)
    const isPositive = rounded < 0;
    const color = isPositive ? 'text-green-600' : 'text-red-600';
    const Icon = rounded > 0 ? TrendingUp : TrendingDown;
    const sign = rounded > 0 ? '+' : '';

    return (
      <div className={`flex items-center gap-1 mt-1 text-xs ${color}`}>
        <Icon className="h-3 w-3" />
        <span>{sign}{rounded} p.p. vs período anterior</span>
      </div>
    );
  }

  if (type === 'count') {
    const diff = current - previous;

    if (diff === 0) {
      return (
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Minus className="h-3 w-3" />
          <span>Estável vs período anterior</span>
        </div>
      );
    }

    const sign = diff > 0 ? '+' : '';
    const color = diff > 0 ? 'text-green-600' : 'text-red-600';
    const Icon = diff > 0 ? TrendingUp : TrendingDown;

    return (
      <div className={`flex items-center gap-1 mt-1 text-xs ${color}`}>
        <Icon className="h-3 w-3" />
        <span>{sign}{diff} vs período anterior</span>
      </div>
    );
  }

  // currency - show percentage change
  if (previous === 0 && current === 0) {
    return (
      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>Estável vs período anterior</span>
      </div>
    );
  }

  if (previous === 0) {
    return (
      <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
        <TrendingUp className="h-3 w-3" />
        <span>Novo vs período anterior</span>
      </div>
    );
  }

  const pctChange = ((current - previous) / previous) * 100;
  const rounded = Math.round(pctChange);

  if (rounded === 0) {
    return (
      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>Estável vs período anterior</span>
      </div>
    );
  }

  const sign = rounded > 0 ? '+' : '';
  const color = rounded > 0 ? 'text-green-600' : 'text-red-600';
  const Icon = rounded > 0 ? TrendingUp : TrendingDown;

  return (
    <div className={`flex items-center gap-1 mt-1 text-xs ${color}`}>
      <Icon className="h-3 w-3" />
      <span>{sign}{rounded}% vs período anterior</span>
    </div>
  );
};

// For cancelamentos: increase is bad, decrease is good (inverted logic)
export const CancellationComparisonIndicator = ({ current, previous }: { current: number; previous: number }) => {
  const diff = current - previous;

  if (diff === 0) {
    return (
      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>Estável vs período anterior</span>
      </div>
    );
  }

  const sign = diff > 0 ? '+' : '';
  // Inverted: more cancellations = bad (red), fewer = good (green)
  const color = diff > 0 ? 'text-red-600' : 'text-green-600';
  const Icon = diff > 0 ? TrendingUp : TrendingDown;

  return (
    <div className={`flex items-center gap-1 mt-1 text-xs ${color}`}>
      <Icon className="h-3 w-3" />
      <span>{sign}{diff} vs período anterior</span>
    </div>
  );
};
