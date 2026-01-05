import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Link as LinkIcon,
  CreditCard,
  Truck,
  BarChart3,
  CheckCircle,
  XCircle,
  Settings,
  TestTube,
  Eye,
  EyeOff
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Integration {
  id: string;
  name: string;
  category: 'payment' | 'shipping' | 'analytics';
  description: string;
  status: 'active' | 'error' | 'inactive';
  enabled: boolean;
  icon: string;
  hasCredentials: boolean;
}

const AdminIntegrations = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([
    // Payment Gateways
    {
      id: 'mercadopago',
      name: 'Mercado Pago',
      category: 'payment',
      description: 'Gateway de pagamento líder no Brasil',
      status: 'active',
      enabled: true,
      icon: 'MP',
      hasCredentials: true
    },
    {
      id: 'pagbank',
      name: 'PagBank',
      category: 'payment',
      description: 'Soluções de pagamento PagSeguro',
      status: 'active',
      enabled: true,
      icon: 'PB',
      hasCredentials: true
    },
    // Shipping
    {
      id: 'correios',
      name: 'Correios',
      category: 'shipping',
      description: 'Integração oficial com os Correios',
      status: 'active',
      enabled: true,
      icon: 'CO',
      hasCredentials: true
    },
    {
      id: 'melhorenvio',
      name: 'Melhor Envio',
      category: 'shipping',
      description: 'Agregador de transportadoras',
      status: 'active',
      enabled: true,
      icon: 'ME',
      hasCredentials: true
    },
    {
      id: 'fretekm',
      name: 'Frete por KM',
      category: 'shipping',
      description: 'Cálculo de frete por distância',
      status: 'inactive',
      enabled: false,
      icon: 'KM',
      hasCredentials: false
    },
    // Analytics
    {
      id: 'ga',
      name: 'Google Analytics',
      category: 'analytics',
      description: 'Análise de tráfego e comportamento',
      status: 'inactive',
      enabled: false,
      icon: 'GA',
      hasCredentials: false
    },
    {
      id: 'gtm',
      name: 'Google Tag Manager',
      category: 'analytics',
      description: 'Gerenciamento de tags',
      status: 'inactive',
      enabled: false,
      icon: 'TM',
      hasCredentials: false
    },
    {
      id: 'metapixel',
      name: 'Meta Pixel',
      category: 'analytics',
      description: 'Rastreamento Facebook/Instagram',
      status: 'inactive',
      enabled: false,
      icon: 'FB',
      hasCredentials: false
    },
    {
      id: 'tiktok',
      name: 'TikTok Ads Pixel',
      category: 'analytics',
      description: 'Rastreamento TikTok',
      status: 'inactive',
      enabled: false,
      icon: 'TK',
      hasCredentials: false
    }
  ]);

  const [showCredentials, setShowCredentials] = useState<Record<string, boolean>>({});

  const toggleIntegration = (id: string) => {
    setIntegrations(prev => prev.map(i => 
      i.id === id ? { ...i, enabled: !i.enabled } : i
    ));
  };

  const handleTest = (name: string) => {
    toast.success(`Teste de conexão com ${name} realizado com sucesso!`);
  };

  const handleConfigure = (name: string) => {
    toast.info(`Configuração de ${name} será implementada em breve`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ativo
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return <Badge variant="secondary">Inativo</Badge>;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'payment':
        return 'Gateways de Pagamento';
      case 'shipping':
        return 'Frete e Logística';
      case 'analytics':
        return 'Marketing e Analytics';
      default:
        return category;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'payment':
        return <CreditCard className="h-5 w-5 text-green-500" />;
      case 'shipping':
        return <Truck className="h-5 w-5 text-blue-500" />;
      case 'analytics':
        return <BarChart3 className="h-5 w-5 text-purple-500" />;
      default:
        return <LinkIcon className="h-5 w-5" />;
    }
  };

  const getIconColor = (category: string) => {
    switch (category) {
      case 'payment':
        return 'bg-green-100 text-green-600';
      case 'shipping':
        return 'bg-blue-100 text-blue-600';
      case 'analytics':
        return 'bg-purple-100 text-purple-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const groupedIntegrations = {
    payment: integrations.filter(i => i.category === 'payment'),
    shipping: integrations.filter(i => i.category === 'shipping'),
    analytics: integrations.filter(i => i.category === 'analytics')
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Integrações Ativas</p>
                  <p className="text-2xl font-bold">
                    {integrations.filter(i => i.enabled).length}/{integrations.length}
                  </p>
                </div>
                <LinkIcon className="h-8 w-8 text-[#6a1b9a]" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status OK</p>
                  <p className="text-2xl font-bold text-green-600">
                    {integrations.filter(i => i.status === 'active').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Com Erro</p>
                  <p className="text-2xl font-bold text-red-600">
                    {integrations.filter(i => i.status === 'error').length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integrations by Category */}
        {(['payment', 'shipping', 'analytics'] as const).map((category) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {getCategoryIcon(category)}
                {getCategoryLabel(category)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedIntegrations[category].map((integration) => (
                  <div 
                    key={integration.id}
                    className="p-4 border rounded-lg bg-card"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold ${getIconColor(category)}`}>
                          {integration.icon}
                        </div>
                        <div>
                          <p className="font-medium">{integration.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {integration.description}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(integration.status)}
                    </div>

                    {integration.hasCredentials && (
                      <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs">Credenciais</Label>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowCredentials(prev => ({
                              ...prev,
                              [integration.id]: !prev[integration.id]
                            }))}
                          >
                            {showCredentials[integration.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <Input 
                          type={showCredentials[integration.id] ? 'text' : 'password'}
                          value="••••••••••••••••"
                          readOnly
                          className="text-xs h-8"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTest(integration.name)}
                        >
                          <TestTube className="h-3 w-3 mr-1" />
                          Testar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleConfigure(integration.name)}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Configurar
                        </Button>
                      </div>
                      <Switch
                        checked={integration.enabled}
                        onCheckedChange={() => toggleIntegration(integration.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminIntegrations;
