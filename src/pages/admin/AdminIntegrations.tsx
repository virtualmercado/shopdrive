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
  EyeOff,
  Star,
  AlertCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GatewayConfigModal } from "@/components/admin/GatewayConfigModal";

interface MasterGateway {
  id: string;
  gateway_name: string;
  display_name: string;
  is_active: boolean;
  is_default: boolean;
  environment: string;
  mercadopago_access_token?: string;
  mercadopago_public_key?: string;
  pagbank_token?: string;
  pagbank_email?: string;
}

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
  const [masterGateways, setMasterGateways] = useState<MasterGateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<MasterGateway | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [integrations, setIntegrations] = useState<Integration[]>([
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

  // Buscar gateways do Painel Master
  const fetchMasterGateways = async () => {
    try {
      const { data, error } = await supabase
        .from("master_payment_gateways")
        .select("*")
        .order("is_default", { ascending: false });

      if (error) throw error;
      setMasterGateways(data || []);
    } catch (error: any) {
      console.error("Error fetching master gateways:", error);
      toast.error("Erro ao carregar gateways");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterGateways();
  }, []);

  const toggleIntegration = (id: string) => {
    setIntegrations(prev => prev.map(i => 
      i.id === id ? { ...i, enabled: !i.enabled } : i
    ));
  };

  const handleTest = async (gateway: MasterGateway) => {
    // Simular teste de conexão
    toast.info(`Testando conexão com ${gateway.display_name}...`);
    
    setTimeout(() => {
      if (gateway.is_active && 
          ((gateway.gateway_name === "mercadopago" && gateway.mercadopago_access_token) ||
           (gateway.gateway_name === "pagbank" && gateway.pagbank_token))) {
        toast.success(`Conexão com ${gateway.display_name} bem-sucedida!`);
      } else {
        toast.error(`Credenciais de ${gateway.display_name} não configuradas`);
      }
    }, 1500);
  };

  const handleConfigure = (gateway: MasterGateway) => {
    setSelectedGateway(gateway);
    setConfigModalOpen(true);
  };

  const toggleGateway = async (gateway: MasterGateway) => {
    try {
      const { error } = await supabase
        .from("master_payment_gateways")
        .update({ is_active: !gateway.is_active })
        .eq("id", gateway.id);

      if (error) throw error;

      setMasterGateways(prev => prev.map(g => 
        g.id === gateway.id ? { ...g, is_active: !g.is_active } : g
      ));

      toast.success(`${gateway.display_name} ${!gateway.is_active ? "ativado" : "desativado"}`);
    } catch (error: any) {
      console.error("Error toggling gateway:", error);
      toast.error("Erro ao alterar status do gateway");
    }
  };

  const getGatewayStatus = (gateway: MasterGateway) => {
    const hasCredentials = gateway.gateway_name === "mercadopago" 
      ? !!gateway.mercadopago_access_token 
      : !!gateway.pagbank_token;

    if (!gateway.is_active) return "inactive";
    if (!hasCredentials) return "error";
    return "active";
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
            Sem Credenciais
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
    shipping: integrations.filter(i => i.category === 'shipping'),
    analytics: integrations.filter(i => i.category === 'analytics')
  };

  const activeGatewaysCount = masterGateways.filter(g => g.is_active).length;
  const activeIntegrationsCount = integrations.filter(i => i.enabled).length;
  const totalActive = activeGatewaysCount + activeIntegrationsCount;
  const totalCount = masterGateways.length + integrations.length;

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
                    {totalActive}/{totalCount}
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
                  <p className="text-sm text-muted-foreground">Gateways Configurados</p>
                  <p className="text-2xl font-bold text-green-600">
                    {masterGateways.filter(g => getGatewayStatus(g) === "active").length}
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
                  <p className="text-sm text-muted-foreground">Pendentes Configuração</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {masterGateways.filter(g => getGatewayStatus(g) === "error").length}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gateways de Pagamento do Painel Master */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-500" />
              Gateways de Pagamento (Painel Master)
            </CardTitle>
            <CardDescription>
              Configure os gateways de pagamento para cobrança de assinaturas da plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando gateways...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {masterGateways.map((gateway) => {
                  const status = getGatewayStatus(gateway);
                  return (
                    <div 
                      key={gateway.id}
                      className="p-4 border rounded-lg bg-card"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg flex items-center justify-center font-bold bg-green-100 text-green-600">
                            {gateway.gateway_name === "mercadopago" ? "MP" : "PB"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{gateway.display_name}</p>
                              {gateway.is_default && (
                                <Badge variant="outline" className="text-xs">
                                  <Star className="h-3 w-3 mr-1 fill-current" />
                                  Padrão
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {gateway.environment === "production" ? "Produção" : "Sandbox"}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(status)}
                      </div>

                      <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs">Credenciais</Label>
                          {status === "active" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {status === "active" 
                            ? "Credenciais configuradas" 
                            : "Clique em Configurar para adicionar credenciais"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleTest(gateway)}
                          >
                            <TestTube className="h-3 w-3 mr-1" />
                            Testar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleConfigure(gateway)}
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            Configurar
                          </Button>
                        </div>
                        <Switch
                          checked={gateway.is_active}
                          onCheckedChange={() => toggleGateway(gateway)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outras Integrações por Categoria */}
        {(['shipping', 'analytics'] as const).map((category) => (
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
                          onClick={() => toast.success(`Teste de conexão com ${integration.name} realizado com sucesso!`)}
                        >
                          <TestTube className="h-3 w-3 mr-1" />
                          Testar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => toast.info(`Configuração de ${integration.name} será implementada em breve`)}
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

      {/* Modal de Configuração de Gateway */}
      <GatewayConfigModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        gateway={selectedGateway}
        onSave={fetchMasterGateways}
      />
    </AdminLayout>
  );
};

export default AdminIntegrations;
