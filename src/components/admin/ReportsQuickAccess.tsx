import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, DollarSign, AlertTriangle, Plug } from "lucide-react";
import { Link } from "react-router-dom";

const reports = [
  {
    icon: BarChart3,
    title: "Performance de Lojistas",
    description: "Análise detalhada do desempenho",
    link: "/gestor/relatorios?type=performance",
  },
  {
    icon: TrendingUp,
    title: "Adesões Mensais",
    description: "Crescimento e novos cadastros",
    link: "/gestor/relatorios?type=adesoes",
  },
  {
    icon: DollarSign,
    title: "Relatório Financeiro",
    description: "Receitas e projeções",
    link: "/gestor/relatorios?type=financeiro",
  },
  {
    icon: AlertTriangle,
    title: "Inadimplência",
    description: "Análise de pagamentos atrasados",
    link: "/gestor/relatorios?type=inadimplencia",
  },
  {
    icon: Plug,
    title: "Integrações Ativas",
    description: "Status das conexões",
    link: "/gestor/relatorios?type=integracoes",
  },
];

export const ReportsQuickAccess = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatórios Essenciais</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => {
            const Icon = report.icon;
            return (
              <Link key={report.title} to={report.link}>
                <Button
                  variant="outline"
                  className="w-full h-auto flex flex-col items-start p-4 hover:bg-muted"
                >
                  <Icon className="h-6 w-6 mb-2 text-primary" />
                  <h3 className="font-semibold text-left">{report.title}</h3>
                  <p className="text-sm text-muted-foreground text-left">
                    {report.description}
                  </p>
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
