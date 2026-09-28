import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBucketLabel, formatCount, formatPercent, type NetworkBucket, type NetworkSeriesPoint } from '@/lib/brandNetwork';

interface Props { series: NetworkSeriesPoint[] | undefined; bucket: NetworkBucket; loading: boolean }

export const NetworkChart = ({ series, bucket, loading }: Props) => {
  // Todos os pontos do backend são mantidos, inclusive buckets com zero.
  const data = (series ?? []).map((p) => ({ ...p, label: formatBucketLabel(p.bucketStart, bucket) }));
  const minWidth = Math.max(data.length * 28, 320);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Evolução da Rede</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !series ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <div className="h-64" style={{ minWidth }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={8} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'Conversão' ? formatPercent(value) : formatCount(value)}
                    contentStyle={{
                      borderRadius: 8, border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--background))', fontSize: 12,
                    }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="clicks" name="Cliques" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar yAxisId="left" dataKey="activations" name="Lojas criadas" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Line yAxisId="right" type="linear" dataKey="conversionPercent" name="Conversão" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
