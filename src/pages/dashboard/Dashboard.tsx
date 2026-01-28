import { Card } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Package, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useSalesByState, useSalesByGender, useSalesByAgeRange, useRevenueStats, useTopProducts, useTopCustomers } from "@/hooks/useDashboardCharts";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import DashboardNewsCarousel from "@/components/dashboard/DashboardNewsCarousel";

const CHART_COLORS = ["#5B9BD5", "#ED7D31", "#A5A5A5", "#FFC000", "#70AD47", "#9E480E", "#997300", "#636363", "#264478", "#4472C4"];

const Dashboard = () => {
  const { primaryColor } = useTheme();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: salesByState, isLoading: stateLoading } = useSalesByState();
  const { data: salesByGender, isLoading: genderLoading } = useSalesByGender();
  const { data: salesByAgeRange, isLoading: ageLoading } = useSalesByAgeRange();
  const { data: revenueStats, isLoading: revenueLoading } = useRevenueStats();
  const { data: topProducts, isLoading: productsLoading } = useTopProducts();
  const { data: topCustomers, isLoading: customersLoading } = useTopCustomers();
  
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

  // Custom label renderer for pie charts - format: "percentage% name"
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius * 1.25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    const percentValue = Math.round(percent * 100);

    return (
      <text
        x={x}
        y={y}
        fill="#666"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs"
      >
        {`${percentValue}% `}
        <tspan fill="#999">{name}</tspan>
      </text>
    );
  };

  // Gender chart colors: Blue for Masculino, Green for Feminino
  const getGenderColor = (gender: string) => {
    if (gender === "Feminino") return "#5B9BD5";
    if (gender === "Masculino") return "#70AD47";
    return "#A5A5A5";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* News Carousel */}
        <DashboardNewsCarousel />
        
        {/* Stats Grid - Unchanged */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="h-12 w-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  <stat.icon className="h-6 w-6 text-white" />
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
          {/* Chart 1 - Sales by State - Horizontal Bar Chart */}
          <Card className="p-6">
            <h3 className="text-base font-medium text-foreground mb-4">
              Vendas por Estado / últimos 30 dias
            </h3>
            {stateLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesByState?.slice().sort((a, b) => a.count - b.count)}
                    layout="vertical"
                    margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
                  >
                    <XAxis 
                      type="number" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666', fontSize: 11 }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="state" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666', fontSize: 11 }}
                      width={80}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} pedidos`, 'Vendas']}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#5B9BD5" 
                      radius={[0, 4, 4, 0]}
                      label={{
                        position: 'right',
                        fill: '#666',
                        fontSize: 11,
                        formatter: (value: number) => {
                          const total = salesByState?.reduce((sum, item) => sum + item.count, 0) || 1;
                          return `${Math.round((value / total) * 100)}%`;
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Chart 2 - Sales by Gender */}
          <Card className="p-6">
            <h3 className="text-base font-medium text-foreground mb-4">
              Vendas por gênero / últimos 30 dias
            </h3>
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
                      outerRadius={90}
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {salesByGender?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getGenderColor(entry.gender)} />
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

          {/* Chart 3 - Sales by Age Range - Bar Chart */}
          <Card className="p-6">
            <h3 className="text-base font-medium text-foreground mb-4">
              Vendas por faixa etária / últimos 30 dias
            </h3>
            {ageLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesByAgeRange}
                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                  >
                    <XAxis 
                      dataKey="range" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666', fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} pedidos`, 'Vendas']}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#5B9BD5" 
                      radius={[4, 4, 0, 0]}
                      label={{
                        position: 'top',
                        fill: '#666',
                        fontSize: 12,
                        formatter: (value: number) => {
                          const total = salesByAgeRange?.reduce((sum, item) => sum + item.count, 0) || 1;
                          return `${Math.round((value / total) * 100)}%`;
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Chart 4 - Top 10 Products - Horizontal Bar Chart */}
          <Card className="p-6">
            <h3 className="text-base font-medium text-foreground mb-4">
              Top 10 produtos mais vendidos / últimos 30 dias
            </h3>
            {productsLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProducts?.slice().reverse()}
                    layout="vertical"
                    margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                  >
                    <XAxis 
                      type="number" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666', fontSize: 11 }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666', fontSize: 10 }}
                      width={120}
                      tickFormatter={(value) => value.length > 18 ? `${value.substring(0, 18)}...` : value}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} unidades`, 'Quantidade']}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar 
                      dataKey="quantity" 
                      fill="#5B9BD5" 
                      radius={[0, 4, 4, 0]}
                      label={{
                        position: 'right',
                        fill: '#666',
                        fontSize: 11
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Chart 5 - Top 10 Customers - Horizontal Bar Chart */}
          <Card className="p-6">
            <h3 className="text-base font-medium text-foreground mb-4">
              Top 10 clientes que mais compraram / últimos 6 meses
            </h3>
            {customersLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topCustomers?.slice().reverse()}
                    layout="vertical"
                    margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
                  >
                    <XAxis 
                      type="number" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666', fontSize: 11 }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#666', fontSize: 10 }}
                      width={120}
                      tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Total']}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar 
                      dataKey="totalValue" 
                      fill="#70AD47" 
                      radius={[0, 4, 4, 0]}
                      label={{
                        position: 'right',
                        fill: '#666',
                        fontSize: 10,
                        formatter: (value: number) => formatCurrency(value)
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Card 6 - Revenue Stats (2 stacked cards) - Last position */}
          <div className="flex flex-col gap-8">
            <Card className="p-6 flex-1 flex flex-col justify-center min-h-[148px]">
              <h3 className="text-base font-medium text-muted-foreground text-center mb-6">
                Faturamento / últimos 30 dias
              </h3>
              <div className="flex items-center justify-center flex-1">
                {revenueLoading ? (
                  <Skeleton className="h-10 w-40" />
                ) : (
                  <p 
                    className="text-3xl font-medium"
                    style={{ color: primaryColor }}
                  >
                    {formatCurrency(revenueStats?.totalRevenue || 0)}
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-6 flex-1 flex flex-col justify-center min-h-[148px]">
              <h3 className="text-base font-medium text-muted-foreground text-center mb-6">
                Faturamento médio dia / últimos 30 dias
              </h3>
              <div className="flex items-center justify-center flex-1">
                {revenueLoading ? (
                  <Skeleton className="h-10 w-40" />
                ) : (
                  <p 
                    className="text-3xl font-medium"
                    style={{ color: primaryColor }}
                  >
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
