import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { StatCard } from '@/components/admin/StatCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { InvoiceDetailsModal } from '@/components/admin/InvoiceDetailsModal';
import { PaymentDetailsModal } from '@/components/admin/PaymentDetailsModal';
import { useInvoices } from '@/hooks/useInvoices';
import { usePayments } from '@/hooks/usePayments';
import { supabase } from '@/integrations/supabase/client';
import { FileText, DollarSign, AlertCircle, TrendingUp, Eye } from 'lucide-react';

export default function Invoices() {
  const [stats, setStats] = useState({
    openInvoices: 0,
    overdueInvoices: 0,
    pendingPayments: 0,
    recoveryRate: 0,
  });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dunningSettings, setDunningSettings] = useState<any>({});
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const { fetchInvoices } = useInvoices();
  const { fetchPayments } = usePayments();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const invoicesData = await fetchInvoices();
    const paymentsData = await fetchPayments();
    setInvoices(invoicesData);
    setPayments(paymentsData);

    const { data: settings } = await supabase
      .from('dunning_settings')
      .select('*')
      .single();
    
    if (settings) {
      setDunningSettings(settings);
    }

    const openInvoices = invoicesData.filter((i: any) => i.status === 'pending').length;
    const overdueInvoices = invoicesData.filter((i: any) => i.status === 'overdue').length;
    const pendingPayments = paymentsData.filter((p: any) => p.status === 'pending').length;

    setStats({
      openInvoices,
      overdueInvoices,
      pendingPayments,
      recoveryRate: 0,
    });
  };

  const saveDunningSettings = async () => {
    await supabase
      .from('dunning_settings')
      .upsert(dunningSettings);
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500',
      paid: 'bg-green-500',
      overdue: 'bg-red-500',
      cancelled: 'bg-gray-500',
    };
    return <Badge className={colors[status as keyof typeof colors] || ''}>{status}</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Faturas e Pagamentos</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Faturas em Aberto" value={stats.openInvoices} icon={FileText} />
          <StatCard title="Faturas Vencidas" value={stats.overdueInvoices} icon={AlertCircle} />
          <StatCard title="Pagamentos Pendentes" value={stats.pendingPayments} icon={DollarSign} />
          <StatCard title="Taxa de Recuperação" value={`${stats.recoveryRate}%`} icon={TrendingUp} />
        </div>

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices">Faturas</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
            <TabsTrigger value="dunning">Dunning</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Assinante</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.id.slice(0, 8)}</TableCell>
                      <TableCell>{invoice.profiles?.full_name}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(invoice.reference_period_start).toLocaleDateString('pt-BR')} -{' '}
                        {new Date(invoice.reference_period_end).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-semibold">R$ {Number(invoice.amount).toFixed(2)}</TableCell>
                      <TableCell>{new Date(invoice.due_date).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setInvoiceModalOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="payments">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Fatura</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Valor Bruto</TableHead>
                    <TableHead>Taxas</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">{payment.id.slice(0, 8)}</TableCell>
                      <TableCell className="font-mono text-sm">{payment.invoice_id.slice(0, 8)}</TableCell>
                      <TableCell>{payment.gateway}</TableCell>
                      <TableCell>R$ {Number(payment.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-red-600">R$ {Number(payment.gateway_fee).toFixed(2)}</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        R$ {Number(payment.net_amount).toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setPaymentModalOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="dunning" className="space-y-4">
            <div className="border rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold">Configurações de Cobrança Automática</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Período de Carência (dias)</Label>
                  <Input
                    type="number"
                    value={dunningSettings.grace_period_days || 7}
                    onChange={(e) =>
                      setDunningSettings({ ...dunningSettings, grace_period_days: parseInt(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tentativas Automáticas</Label>
                  <Input
                    type="number"
                    value={dunningSettings.max_retry_attempts || 3}
                    onChange={(e) =>
                      setDunningSettings({ ...dunningSettings, max_retry_attempts: parseInt(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>E-mails Automáticos</Label>
                  <Switch
                    checked={dunningSettings.email_notifications_enabled}
                    onCheckedChange={(checked) =>
                      setDunningSettings({ ...dunningSettings, email_notifications_enabled: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Banner no Painel</Label>
                  <Switch
                    checked={dunningSettings.banner_enabled}
                    onCheckedChange={(checked) =>
                      setDunningSettings({ ...dunningSettings, banner_enabled: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Bloqueio Automático</Label>
                  <Switch
                    checked={dunningSettings.auto_block_enabled}
                    onCheckedChange={(checked) =>
                      setDunningSettings({ ...dunningSettings, auto_block_enabled: checked })
                    }
                  />
                </div>
              </div>

              <Button onClick={saveDunningSettings}>Salvar Configurações</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <InvoiceDetailsModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        invoice={selectedInvoice}
      />

      <PaymentDetailsModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        payment={selectedPayment}
      />
    </AdminLayout>
  );
}
