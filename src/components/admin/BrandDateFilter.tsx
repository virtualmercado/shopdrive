import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type PeriodPreset = 'today' | '7d' | '15d' | '30d' | 'this_month' | 'last_month' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

interface BrandDateFilterProps {
  value: PeriodPreset;
  dateRange: DateRange;
  onChange: (preset: PeriodPreset, range: DateRange) => void;
}

export function getDateRangeForPreset(preset: PeriodPreset): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case '7d':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '15d':
      return { from: startOfDay(subDays(now, 14)), to: endOfDay(now) };
    case '30d':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    default:
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
}

export function getPeriodLabel(preset: PeriodPreset, range: DateRange): string {
  const labels: Record<string, string> = {
    today: 'Hoje',
    '7d': 'Últimos 7 dias',
    '15d': 'Últimos 15 dias',
    '30d': 'Últimos 30 dias',
    this_month: 'Este mês',
    last_month: 'Mês passado',
  };
  if (preset !== 'custom') return labels[preset] || '';
  return `${format(range.from, 'dd/MM/yyyy')} — ${format(range.to, 'dd/MM/yyyy')}`;
}

const BrandDateFilter = ({ value, dateRange, onChange }: BrandDateFilterProps) => {
  const [customFrom, setCustomFrom] = useState<Date | undefined>(dateRange.from);
  const [customTo, setCustomTo] = useState<Date | undefined>(dateRange.to);

  const handlePresetChange = (preset: string) => {
    const p = preset as PeriodPreset;
    if (p === 'custom') {
      onChange(p, dateRange);
      return;
    }
    onChange(p, getDateRangeForPreset(p));
  };

  const applyCustomRange = () => {
    if (customFrom && customTo) {
      onChange('custom', { from: startOfDay(customFrom), to: endOfDay(customTo) });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Selecionar período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="15d">Últimos 15 dias</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
          <SelectItem value="this_month">Este mês</SelectItem>
          <SelectItem value="last_month">Mês passado</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>

      {value === 'custom' && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('w-[130px] justify-start text-left font-normal', !customFrom && 'text-muted-foreground')}>
                <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'Início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={setCustomFrom}
                disabled={(d) => d > new Date()}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-sm">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('w-[130px] justify-start text-left font-normal', !customTo && 'text-muted-foreground')}>
                <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                {customTo ? format(customTo, 'dd/MM/yyyy') : 'Fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={setCustomTo}
                disabled={(d) => d > new Date() || (customFrom ? d < customFrom : false)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={applyCustomRange} disabled={!customFrom || !customTo}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
};

export default BrandDateFilter;
