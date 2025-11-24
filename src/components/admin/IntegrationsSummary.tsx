import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Smartphone, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const integrations = [
  { name: "Mercado Pago", count: 245, icon: CreditCard },
  { name: "PagSeguro", count: 180, icon: CreditCard },
  { name: "Pix Automático", count: 320, icon: Zap },
  { name: "WhatsApp", count: 410, icon: Smartphone },
];

export const IntegrationsSummary = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrações Mais Usadas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 mb-4">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            return (
              <div
                key={integration.name}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-medium">{integration.name}</span>
                </div>
                <span className="text-lg font-bold">{integration.count}</span>
              </div>
            );
          })}
        </div>
        <Link to="/gestor/integracoes">
          <Button variant="outline" className="w-full">
            Gerenciar Integrações
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};
