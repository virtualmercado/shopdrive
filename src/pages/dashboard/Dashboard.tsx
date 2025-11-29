import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Package, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const [primaryColor, setPrimaryColor] = useState("#6a1b9a");
  useEffect(() => {
    const fetchPrimaryColor = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("primary_color")
        .eq("id", user.id)
        .single();

      if (profile?.primary_color) {
        setPrimaryColor(profile.primary_color);
      }
    };

    fetchPrimaryColor();
  }, []);

  const stats = [
    {
      icon: DollarSign,
      label: "Vendas do Mês",
      value: "R$ 12.450,00",
      change: "+23.5%",
      positive: true
    },
    {
      icon: ShoppingCart,
      label: "Pedidos",
      value: "156",
      change: "+12.3%",
      positive: true
    },
    {
      icon: Package,
      label: "Produtos",
      value: "45",
      change: "+5",
      positive: true
    },
    {
      icon: TrendingUp,
      label: "Taxa de Conversão",
      value: "3.2%",
      change: "+0.8%",
      positive: true
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="h-12 w-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <stat.icon className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <span className={`text-sm font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Recent Orders */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Pedidos Recentes</h2>
          <div className="space-y-4">
            {[1, 2, 3].map((_, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Pedido #{1234 + index}</p>
                  <p className="text-sm text-muted-foreground">Cliente Exemplo {index + 1}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">R$ 299,90</p>
                  <span className="inline-block px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                    Pago
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;