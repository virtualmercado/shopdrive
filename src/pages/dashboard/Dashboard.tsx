import { Card } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Package, ShoppingCart, DollarSign, TrendingUp, MapPin, Users, Calendar, Wallet } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useSalesByState, useSalesByGender, useSalesByAgeRange, useRevenueStats } from "@/hooks/useDashboardCharts";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const CHART_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F", "#FFBB28", "#FF8042", "#0088FE", "#00C49F"];

const Dashboard = () => {
  const { primaryColor } = useTheme();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: salesByState, isLoading: stateLoading } = useSalesByState();
  const { data: salesByGender, isLoading: genderLoading } = useSalesByGender();
  const { data: salesByAgeRange, isLoading: ageLoading } = useSalesByAgeRange();
  const { data: revenueStats, isLoading: revenueLoading } = useRevenueStats();
  
  const getLighterShade = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const lighterR = Math.min(255, r + 40);
    const lighterG = Math.min(255, g + 40);
    const lighterB = Math.min(255, b + 40);
    return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const statsCards = [
    {
      icon: DollarSign,
      label: "Vendas do Mês",
      value: stats ? formatCurrency(stats.monthlySales) : "R$ 0,00",
    },
    {
      icon: ShoppingCart,
      label: "Pedidos",
      value: stats?.totalOrders?.toString() || "0",
    },
    {
      icon: Package,
      label: "Produtos",
      value: stats?.totalProducts?.toString() || "0",
    },
    {
      icon: TrendingUp,
      label: "Taxa de Conversão",
      value: stats ? `${stats.conversionRate}%` : "0%",
    }
  ];

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius * 1.2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#666"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs"
      >
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="h-12 w-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: getLighterShade(primaryColor) }}
                >
                  <stat.icon className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              {statsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-bold">{stat.value}</p>
              )}
            </Card>
          ))}
        </div>

        {/* Charts Grid - 2 per row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Chart 1 - Sales by State */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div 
                className="flex items-center justify-center w-8 h-8 rounded"
                style={{ backgroundColor: getLighterShade(primaryColor) }}
              >
                <MapPin className="h-4 w-4" style={{ color: primaryColor }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: primaryColor }}>
                Vendas por Estado / últimos 30 dias
              </h3>
            </div>
            {stateLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-48 w-48 rounded-full" />
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByState}
                      dataKey="count"
                      nameKey="state"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      labelLine={true}
                      label={renderCustomLabel}
                    >
                      {salesByState?.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [`${value} pedidos`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Chart 2 - Sales by Gender */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div 
                className="flex items-center justify-center w-8 h-8 rounded"
                style={{ backgroundColor: getLighterShade(primaryColor) }}
              >
                <Users className="h-4 w-4" style={{ color: primaryColor }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: primaryColor }}>
                Vendas por gênero / últimos 30 dias
              </h3>
            </div>
            {genderLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-48 w-48 rounded-full" />
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByGender}
                      dataKey="count"
                      nameKey="gender"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      labelLine={true}
                      label={renderCustomLabel}
                    >
                      {salesByGender?.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index === 0 ? "#FF69B4" : index === 1 ? "#4169E1" : "#808080"} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [`${value} pedidos`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Chart 3 - Sales by Age Range */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div 
                className="flex items-center justify-center w-8 h-8 rounded"
                style={{ backgroundColor: getLighterShade(primaryColor) }}
              >
                <Calendar className="h-4 w-4" style={{ color: primaryColor }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: primaryColor }}>
                Vendas por faixa etária / últimos 30 dias
              </h3>
            </div>
            {ageLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-48 w-48 rounded-full" />
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByAgeRange}
                      dataKey="count"
                      nameKey="range"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      labelLine={true}
                      label={renderCustomLabel}
                    >
                      {salesByAgeRange?.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [`${value} pedidos`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Card 4 - Revenue Stats (2 stacked cards) */}
          <div className="flex flex-col gap-6">
            <Card className="p-6 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div 
                  className="flex items-center justify-center w-8 h-8 rounded"
                  style={{ backgroundColor: getLighterShade(primaryColor) }}
                >
                  <Wallet className="h-4 w-4" style={{ color: primaryColor }} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: primaryColor }}>
                  Faturamento / últimos 30 dias
                </h3>
              </div>
              <div className="flex items-center justify-center h-[80px]">
                {revenueLoading ? (
                  <Skeleton className="h-10 w-40" />
                ) : (
                  <p className="text-3xl font-bold text-foreground">
                    {formatCurrency(revenueStats?.totalRevenue || 0)}
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-6 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div 
                  className="flex items-center justify-center w-8 h-8 rounded"
                  style={{ backgroundColor: getLighterShade(primaryColor) }}
                >
                  <TrendingUp className="h-4 w-4" style={{ color: primaryColor }} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: primaryColor }}>
                  Faturamento médio dia / últimos 30 dias
                </h3>
              </div>
              <div className="flex items-center justify-center h-[80px]">
                {revenueLoading ? (
                  <Skeleton className="h-10 w-40" />
                ) : (
                  <p className="text-3xl font-bold text-foreground">
                    {formatCurrency(revenueStats?.averageDailyRevenue || 0)}
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
