import { AdminLayout } from "@/components/layout/AdminLayout";
import { StatCard } from "@/components/admin/StatCard";
import { StoresList } from "@/components/admin/StoresList";
import { InvoicesSummary } from "@/components/admin/InvoicesSummary";
import { ReportsQuickAccess } from "@/components/admin/ReportsQuickAccess";
import { IntegrationsSummary } from "@/components/admin/IntegrationsSummary";
import { SupportSummary } from "@/components/admin/SupportSummary";
import { useGestorStats } from "@/hooks/useGestorStats";
import {
  Users,
  UserCheck,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  FileText,
  Calculator,
} from "lucide-react";

const Gestor = () => {
  const { data: stats, isLoading } = useGestorStats();

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral da plataforma VirtualMercado
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <StatCard
            icon={Users}
            title="Total de Lojistas"
            value={stats?.totalStores || 0}
            color="primary"
            loading={isLoading}
          />
          <StatCard
            icon={UserCheck}
            title="Lojistas Ativos"
            value={stats?.activeStores || 0}
            color="success"
            loading={isLoading}
          />
          <StatCard
            icon={AlertTriangle}
            title="Inadimplentes"
            value={stats?.delinquentStores || 0}
            color="danger"
            loading={isLoading}
          />
          <StatCard
            icon={TrendingUp}
            title="Novos no Mês"
            value={stats?.newStoresThisMonth || 0}
            trend={stats?.newStoresTrend && stats.newStoresTrend > 0 ? "up" : "down"}
            trendValue={
              stats?.newStoresTrend
                ? `${stats.newStoresTrend.toFixed(1)}%`
                : undefined
            }
            loading={isLoading}
          />
          <StatCard
            icon={DollarSign}
            title="Faturamento Mensal"
            value={
              stats?.monthlyRevenue
                ? new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(stats.monthlyRevenue)
                : "R$ 0,00"
            }
            color="success"
            loading={isLoading}
          />
          <StatCard
            icon={FileText}
            title="Faturas Pendentes"
            value={stats?.pendingInvoices || 0}
            color="warning"
            loading={isLoading}
          />
          <StatCard
            icon={Calculator}
            title="Ticket Médio"
            value={
              stats?.avgTicket
                ? new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(stats.avgTicket)
                : "R$ 0,00"
            }
            color="info"
            loading={isLoading}
          />
        </div>

        {/* Gestão de Lojistas */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Gestão de Lojistas</h2>
          <StoresList />
        </div>

        {/* Resumos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InvoicesSummary />
          <SupportSummary />
        </div>

        {/* Relatórios e Integrações */}
        <ReportsQuickAccess />
        <IntegrationsSummary />
      </div>
    </AdminLayout>
  );
};

export default Gestor;
