import { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReportFilterModal } from '@/components/admin/ReportFilterModal';
import { Users, DollarSign, FileText, CreditCard, TrendingDown, BarChart3, FileSpreadsheet } from 'lucide-react';

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<{ type: string; title: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const reports = [
    {
      type: 'subscribers',
      title: 'Relatório de Assinantes',
      description: 'Exportar lista completa de assinantes com filtros',
      icon: Users,
      color: 'text-purple-600',
    },
    {
      type: 'revenue',
      title: 'Relatório de Receitas',
      description: 'Análise detalhada de receitas e MRR',
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      type: 'invoices',
      title: 'Relatório de Faturas',
      description: 'Histórico completo de faturas',
      icon: FileText,
      color: 'text-blue-600',
    },
    {
      type: 'payments',
      title: 'Relatório de Pagamentos',
      description: 'Todos os pagamentos processados',
      icon: CreditCard,
      color: 'text-purple-600',
    },
    {
      type: 'churn',
      title: 'Relatório de Churn',
      description: 'Análise de cancelamentos e churn rate',
      icon: TrendingDown,
      color: 'text-orange-600',
    },
    {
      type: 'mrr',
      title: 'Relatório de MRR',
      description: 'Evolução da receita mensal recorrente',
      icon: BarChart3,
      color: 'text-teal-600',
    },
    {
      type: 'logs',
      title: 'Logs Importantes',
      description: 'Eventos críticos do sistema',
      icon: FileSpreadsheet,
      color: 'text-red-600',
    },
  ];

  const openReportModal = (type: string, title: string) => {
    setSelectedReport({ type, title });
    setModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Exporte relatórios detalhados em diversos formatos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <Card key={report.type} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className={`${report.color}`}>
                  <report.icon className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">{report.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
                  <Button
                    size="sm"
                    onClick={() => openReportModal(report.type, report.title)}
                  >
                    Configurar e Gerar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Relatórios Agendados</h3>
          <p className="text-muted-foreground text-center py-8">
            Nenhum relatório agendado. Configure o envio automático.
          </p>
        </Card>
      </div>

      {selectedReport && (
        <ReportFilterModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          reportType={selectedReport.type}
          reportTitle={selectedReport.title}
        />
      )}
    </AdminLayout>
  );
}
