import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

export type ChartGranularity = 'daily' | 'weekly' | 'monthly';

interface BrandPerformanceChartProps {
  data: { label: string; clicks: number; accounts: number; conversion: number }[];
  granularity: ChartGranularity;
  onGranularityChange: (g: ChartGranularity) => void;
}

const BrandPerformanceChart = ({ data, granularity, onGranularityChange }: BrandPerformanceChartProps) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Sem dados de desempenho para o período selecionado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Desempenho por Período
        </CardTitle>
        <Tabs value={granularity} onValueChange={(v) => onGranularityChange(v as ChartGranularity)}>
          <TabsList className="h-8">
            <TabsTrigger value="daily" className="text-xs px-2 h-6">Diário</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs px-2 h-6">Semanal</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs px-2 h-6">Mensal</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--background))',
                  fontSize: 12,
                }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="clicks" name="Cliques" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} barSize={24} />
              <Bar yAxisId="left" dataKey="accounts" name="Contas" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} barSize={24} />
              <Line yAxisId="right" type="monotone" dataKey="conversion" name="Conversão %" stroke="hsl(263, 70%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default BrandPerformanceChart;
