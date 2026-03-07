import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  MousePointerClick,
  Users,
  TrendingUp,
  Package,
  Send,
  Loader2,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
} from 'recharts';
import { BrandTemplate } from '@/hooks/useBrandTemplates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BrandReportPreviewModalProps {
  template: BrandTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartData?: { label: string; clicks: number; accounts: number; conversion: number }[];
  periodLabel?: string;
}

const FALLBACK_EMAIL = 'suporte@shopdrive.com.br';

const BrandReportPreviewModal = ({
  template,
  open,
  onOpenChange,
  chartData = [],
  periodLabel,
}: BrandReportPreviewModalProps) => {
  const [isSending, setIsSending] = useState(false);

  if (!template) return null;

  const clicks = template.link_clicks || 0;
  const accounts = template.stores_created || 0;
  const conversion = clicks > 0 ? Math.round((accounts / clicks) * 100) : 0;
  const products = template.products_count || 0;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const subject = `[TESTE] Relatório mensal da marca ${template.name} — ${monthKey}`;

  // We don't have the profile email on the client, so indicate fallback may be used
  const recipientNote = 'Email da marca (ou suporte@shopdrive.com.br se não configurado)';

  const handleSend = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-brand-reports', {
        body: { template_id: template.id, report_type: 'manual_test' },
      });

      if (error) {
        const errorBody = typeof error === 'object' && 'message' in error ? error.message : String(error);
        toast.error(`Erro ao enviar relatório: ${errorBody}`);
        return;
      }

      if (data?.error) {
        toast.error(`Erro: ${data.error}`);
        return;
      }

      const result = data?.results?.[0];
      if (result?.status === 'sent') {
        if (result?.used_fallback) {
          toast.warning('Marca sem email. Relatório enviado para suporte@shopdrive.com.br.');
        } else {
          toast.success('Relatório enviado com sucesso!');
        }
        onOpenChange(false);
      } else if (result?.status === 'skipped') {
        toast.info(`Relatório já enviado este mês: ${result?.detail || ''}`);
      } else {
        toast.error(`Falha: ${result?.detail || 'erro desconhecido'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao enviar: ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  const metricCards = [
    { label: 'Cliques', value: clicks, icon: MousePointerClick, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Contas', value: accounts, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Conversão', value: `${conversion}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Produtos', value: products, icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pré-visualização do Relatório
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Email metadata */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="font-medium text-muted-foreground w-20">Assunto:</span>
              <span className="text-foreground">{subject}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-medium text-muted-foreground w-20">Para:</span>
              <span className="text-foreground">{recipientNote}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-medium text-muted-foreground w-20">Cópia:</span>
              <span className="text-foreground">{FALLBACK_EMAIL}</span>
            </div>
            {periodLabel && (
              <div className="flex gap-2">
                <span className="font-medium text-muted-foreground w-20">Período:</span>
                <span className="text-foreground">{periodLabel}</span>
              </div>
            )}
          </div>

          {/* Email preview body */}
          <div className="rounded-lg border bg-background p-6 space-y-5">
            {/* Header */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-foreground">Relatório mensal — {template.name}</h2>
              <p className="text-sm text-muted-foreground">Período: {monthKey}</p>
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Envio de teste
              </Badge>
            </div>

            <Separator />

            {/* Metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {metricCards.map((m) => (
                <Card key={m.label} className="border">
                  <CardContent className="p-3 text-center">
                    <div className={`inline-flex p-2 rounded-lg ${m.bg} mb-2`}>
                      <m.icon className={`h-4 w-4 ${m.color}`} />
                    </div>
                    <p className="text-lg font-bold text-foreground">{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Chart preview */}
            {chartData.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Desempenho no período</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Bar yAxisId="left" dataKey="clicks" name="Cliques" fill="hsl(217, 91%, 60%)" radius={[3, 3, 0, 0]} barSize={20} />
                      <Bar yAxisId="left" dataKey="accounts" name="Contas" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} barSize={20} />
                      <Line yAxisId="right" type="monotone" dataKey="conversion" name="Conversão %" stroke="hsl(263, 70%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Template details */}
            <div className="rounded-lg bg-muted/30 p-4 space-y-1 text-sm">
              <p><span className="text-muted-foreground">Template:</span> <strong>{template.template_slug || '—'}</strong></p>
              <p><span className="text-muted-foreground">Status:</span> <strong>{template.status}</strong></p>
              <p><span className="text-muted-foreground">Link ativo:</span> <strong>{template.is_link_active ? 'Sim' : 'Não'}</strong></p>
              <p><span className="text-muted-foreground">Última atualização:</span> <strong>{format(new Date(template.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BrandReportPreviewModal;
