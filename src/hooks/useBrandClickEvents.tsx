import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from '@/components/admin/BrandDateFilter';
import { ChartGranularity } from '@/components/admin/BrandPerformanceChart';

interface ClickEvent {
  created_at: string;
  template_id: string;
  counted: boolean | null;
}

export interface AggregatedChartPoint {
  label: string;
  clicks: number;
  accounts: number;
  conversion: number;
}

export const useBrandClickEvents = (dateRange: DateRange, templateId?: string) => {
  return useQuery({
    queryKey: ['brand-click-events', dateRange.from.toISOString(), dateRange.to.toISOString(), templateId],
    queryFn: async () => {
      let query = supabase
        .from('template_click_events')
        .select('created_at, template_id, counted')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: true });

      if (templateId) {
        query = query.eq('template_id', templateId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ClickEvent[];
    },
  });
};

export function aggregateClickData(
  events: ClickEvent[],
  dateRange: DateRange,
  granularity: ChartGranularity,
  storesCreatedByTemplate?: Record<string, number>,
): AggregatedChartPoint[] {
  const points: AggregatedChartPoint[] = [];

  if (granularity === 'daily') {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    for (const day of days) {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEvents = events.filter((e) => e.created_at.startsWith(dayStr));
      const clicks = dayEvents.filter((e) => e.counted).length;
      // We don't have per-day account creation data, approximate with 0
      points.push({
        label: format(day, 'dd/MM', { locale: ptBR }),
        clicks,
        accounts: 0,
        conversion: 0,
      });
    }
  } else if (granularity === 'weekly') {
    const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to }, { weekStartsOn: 1 });
    for (const weekStart of weeks) {
      const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekEvents = events.filter((e) => {
        const d = new Date(e.created_at);
        return isWithinInterval(d, { start: weekStart, end: wEnd });
      });
      const clicks = weekEvents.filter((e) => e.counted).length;
      points.push({
        label: `${format(weekStart, 'dd/MM', { locale: ptBR })}`,
        clicks,
        accounts: 0,
        conversion: 0,
      });
    }
  } else {
    const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
    for (const monthStart of months) {
      const mEnd = endOfMonth(monthStart);
      const monthEvents = events.filter((e) => {
        const d = new Date(e.created_at);
        return isWithinInterval(d, { start: monthStart, end: mEnd });
      });
      const clicks = monthEvents.filter((e) => e.counted).length;
      points.push({
        label: format(monthStart, 'MMM/yy', { locale: ptBR }),
        clicks,
        accounts: 0,
        conversion: 0,
      });
    }
  }

  return points;
}

export function computePeriodStats(events: ClickEvent[]) {
  const totalClicks = events.filter((e) => e.counted).length;
  return { totalClicks };
}
