import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Users, DollarSign, TrendingDown, BarChart3, FileSpreadsheet } from 'lucide-react';

export default function Reports() {
  const reports = [
    {
      icon: Users,
      title: 'Relatório de Assinantes',
      description: 'Exportar lista completa de assinantes com filtros',
      color: 'bg-primary/10 text-primary',
    },
    {
      icon: DollarSign,
      title: 'Relatório de Receitas',
      description: 'Análise detalhada de receitas e MRR',
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: FileText,
      title: 'Relatório de Faturas',
      description: 'Histórico completo de faturas',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: DollarSign,
      title: 'Relatório de Pagamentos',
      description: 'Todos os pagamentos processados',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      icon: TrendingDown,
      title: 'Relatório de Churn',
      description: 'Análise de cancelamentos e churn rate',
      color: 'bg-orange-100 text-orange-600',
    },
    {
      icon: BarChart3,
      title: 'Relatório de MRR',
      description: 'Evolução da receita mensal recorrente',
      color: 'bg-teal-100 text-teal-600',
    },
    {
      icon: FileSpreadsheet,
      title: 'Logs Importantes',
      description: 'Eventos críticos do sistema',
      color: 'bg-red-100 text-red-600',
    },
  ];

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-2">Exporte relatórios detalhados em diversos formatos</p>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report, index) => {
            const Icon = report.icon;
            return (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <div className={`w-12 h-12 rounded-lg ${report.color} flex items-center justify-center mb-4`}>
                  <Icon size={24} />
                </div>
                
                <h3 className="text-lg font-semibold mb-2">{report.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download size={16} className="mr-2" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download size={16} className="mr-2" />
                    Excel
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download size={16} className="mr-2" />
                    PDF
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Scheduled Reports Section */}
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Relatórios Agendados</h3>
          <div className="text-center py-12 text-muted-foreground">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p>Nenhum relatório agendado</p>
            <p className="text-sm mt-2">Configure o envio automático de relatórios por e-mail</p>
            <Button className="mt-4">Agendar Relatório</Button>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
