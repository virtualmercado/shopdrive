import { AdminLayout } from "@/components/layout/AdminLayout";
import { GestorStatCard } from "@/components/admin/GestorStatCard";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { useGestorStats } from "@/hooks/useGestorStats";
import {
  Users,
  UserPlus,
  AlertTriangle,
  DollarSign,
} from "lucide-react";

const Gestor = () => {
  const { data: stats, isLoading } = useGestorStats();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <GestorStatCard
            icon={Users}
            title="Assinantes"
            value={stats?.totalStores || 0}
            subtitle={`${stats?.activeStores || 0} ativos`}
            loading={isLoading}
          />
          <GestorStatCard
            icon={UserPlus}
            title="Novos assinantes"
            value={stats?.newStoresThisMonth || 0}
            subtitle="Este mês"
            loading={isLoading}
          />
          <GestorStatCard
            icon={AlertTriangle}
            title="Faturas em atraso"
            value={stats?.delinquentStores || 0}
            subtitle="Requer atenção"
            loading={isLoading}
          />
          <GestorStatCard
            icon={DollarSign}
            title="Faturamentos"
            value={
              stats?.monthlyRevenue
                ? new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(stats.monthlyRevenue)
                : "R$ 0,00"
            }
            subtitle="Este mês"
            loading={isLoading}
          />
        </div>

        {/* Revenue Chart */}
        <RevenueChart
          currentPeriodData={stats?.currentPeriodData || []}
          previousPeriodData={stats?.previousPeriodData || []}
          totalRevenue={stats?.monthlyRevenue || 0}
          percentageChange={stats?.revenueChange || 0}
          loading={isLoading}
        />
      </div>
    </AdminLayout>
  );
};

export default Gestor;
