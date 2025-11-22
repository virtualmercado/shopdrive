import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IntegrationConfigModal } from '@/components/admin/IntegrationConfigModal';
import { useIntegrations } from '@/hooks/useIntegrations';
import { Settings, Activity, CheckCircle, XCircle } from 'lucide-react';

export default function Integrations() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { fetchIntegrations, testIntegration } = useIntegrations();

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    const data = await fetchIntegrations();
    setIntegrations(data);
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) {
      return <Badge variant="outline">Desconectado</Badge>;
    }
    const colors = {
      connected: 'bg-green-500',
      disconnected: 'bg-red-500',
      error: 'bg-yellow-500',
    };
    return <Badge className={colors[status as keyof typeof colors] || ''}>
      {status === 'connected' ? 'Conectado' : 'Erro'}
    </Badge>;
  };

  const categories = {
    payment_gateway: 'Gateways de Pagamento',
    logistics: 'Logística e Frete',
    analytics: 'Analytics',
    marketing: 'Marketing',
  };

  const groupedIntegrations: Record<string, any[]> = integrations.reduce((acc, integration) => {
    const category = integration.type || 'outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(integration);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Integrações</h1>
          <p className="text-muted-foreground">Gerencie conexões com serviços externos</p>
        </div>

        {Object.entries(groupedIntegrations).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-xl font-semibold mb-4">
              {categories[category as keyof typeof categories] || category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((integration) => (
                <Card key={integration.id} className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{integration.name}</h3>
                      {getStatusBadge(integration.status, integration.is_active)}
                    </div>

                    {integration.last_sync && (
                      <p className="text-sm text-muted-foreground">
                        Última sincronização: {new Date(integration.last_sync).toLocaleString('pt-BR')}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      {integration.status === 'connected' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm">
                        {integration.status === 'connected' ? 'Operacional' : 'Erro na conexão'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedIntegration(integration);
                          setModalOpen(true);
                        }}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Configurar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testIntegration(integration.id)}
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Testar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {integrations.length === 0 && (
          <Card className="p-8">
            <p className="text-center text-muted-foreground">
              Nenhuma integração configurada ainda.
            </p>
          </Card>
        )}
      </div>

      <IntegrationConfigModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        integration={selectedIntegration}
      />
    </AdminLayout>
  );
}
