import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Zap,
  Users,
  TrendingUp,
  Shield,
  AlertTriangle,
  Bell,
  Mail,
  Target,
  Ban,
  ArrowUpCircle,
  Clock
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  category: 'retention' | 'growth' | 'operations';
  icon: any;
}

interface AutomationEvent {
  id: string;
  automationName: string;
  message: string;
  timestamp: Date;
  type: 'success' | 'info' | 'warning';
}

const AdminAutomations = () => {
  const [automations, setAutomations] = useState<Automation[]>([
    // Retention & Engagement
    {
      id: '1',
      name: 'Retenção por risco de churn',
      description: 'Ação automática para assinantes em risco',
      trigger: 'Score IA ≥ 70',
      action: 'Envio de cupom + criação de tarefa',
      enabled: true,
      category: 'retention',
      icon: Target
    },
    {
      id: '2',
      name: 'Reengajamento de inativos',
      description: 'Campanhas para usuários inativos',
      trigger: 'Engajamento ≤ 30 por 14 dias',
      action: 'Disparo de e-mails de onboarding',
      enabled: true,
      category: 'retention',
      icon: Mail
    },
    // Growth & Revenue
    {
      id: '3',
      name: 'Upgrade automático de plano',
      description: 'Oferta de upgrade para usuários engajados',
      trigger: 'Engajamento ≥ 85 por 60 dias',
      action: 'Oferta de plano Premium com desconto',
      enabled: false,
      category: 'growth',
      icon: ArrowUpCircle
    },
    {
      id: '4',
      name: 'Dunning reforçado',
      description: 'Lembretes extras de pagamento',
      trigger: 'Previsão de inadimplência',
      action: 'Lembretes adicionais de pagamento',
      enabled: true,
      category: 'growth',
      icon: Bell
    },
    // Operations & Security
    {
      id: '5',
      name: 'Bloqueio inteligente',
      description: 'Bloqueio após inadimplência',
      trigger: 'Fatura vencida +5 dias',
      action: 'Bloqueia acesso e notifica',
      enabled: true,
      category: 'operations',
      icon: Ban
    },
    {
      id: '6',
      name: 'Alerta de falha em integração',
      description: 'Monitoramento de APIs',
      trigger: 'Erro recorrente em API',
      action: 'Alerta admin + abertura de ticket',
      enabled: true,
      category: 'operations',
      icon: AlertTriangle
    }
  ]);

  const [events] = useState<AutomationEvent[]>([
    {
      id: '1',
      automationName: 'Bloqueio inteligente',
      message: 'Loja "Moda Fashion" bloqueada por inadimplência',
      timestamp: new Date(),
      type: 'warning'
    },
    {
      id: '2',
      automationName: 'Retenção por risco de churn',
      message: 'Cupom de desconto enviado para "Eletrônicos Plus"',
      timestamp: new Date(Date.now() - 3600000),
      type: 'success'
    },
    {
      id: '3',
      automationName: 'Dunning reforçado',
      message: 'Lembrete de pagamento enviado para 5 assinantes',
      timestamp: new Date(Date.now() - 7200000),
      type: 'info'
    },
    {
      id: '4',
      automationName: 'Alerta de falha em integração',
      message: 'Erro detectado na API dos Correios - Ticket aberto',
      timestamp: new Date(Date.now() - 10800000),
      type: 'warning'
    }
  ]);

  const toggleAutomation = (id: string) => {
    setAutomations(prev => prev.map(a => 
      a.id === id ? { ...a, enabled: !a.enabled } : a
    ));
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'retention':
        return 'Retenção e Engajamento';
      case 'growth':
        return 'Crescimento e Receita';
      case 'operations':
        return 'Operações e Segurança';
      default:
        return category;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'retention':
        return <Users className="h-5 w-5 text-blue-500" />;
      case 'growth':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'operations':
        return <Shield className="h-5 w-5 text-amber-500" />;
      default:
        return <Zap className="h-5 w-5" />;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <div className="w-2 h-2 rounded-full bg-green-500" />;
      case 'warning':
        return <div className="w-2 h-2 rounded-full bg-amber-500" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-blue-500" />;
    }
  };

  const groupedAutomations = {
    retention: automations.filter(a => a.category === 'retention'),
    growth: automations.filter(a => a.category === 'growth'),
    operations: automations.filter(a => a.category === 'operations')
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Automações Ativas</p>
                  <p className="text-2xl font-bold">
                    {automations.filter(a => a.enabled).length}/{automations.length}
                  </p>
                </div>
                <Zap className="h-8 w-8 text-[#6a1b9a]" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Execuções Hoje</p>
                  <p className="text-2xl font-bold">47</p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold text-green-600">98.5%</p>
                </div>
                <Target className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Automations by Category */}
          <div className="lg:col-span-2 space-y-6">
            {(['retention', 'growth', 'operations'] as const).map((category) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getCategoryIcon(category)}
                    {getCategoryLabel(category)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {groupedAutomations[category].map((automation) => (
                    <div 
                      key={automation.id}
                      className="flex items-start justify-between p-4 border rounded-lg bg-card"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${automation.enabled ? 'bg-[#6a1b9a]/10' : 'bg-muted'}`}>
                          <automation.icon className={`h-5 w-5 ${automation.enabled ? 'text-[#6a1b9a]' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{automation.name}</p>
                            {automation.enabled && (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                Ativo
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {automation.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              Gatilho: {automation.trigger}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Ação: {automation.action}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={automation.enabled}
                        onCheckedChange={() => toggleAutomation(automation.id)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Events Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Log de Eventos
              </CardTitle>
              <CardDescription>Execuções em tempo real</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                      {getEventIcon(event.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{event.automationName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(event.timestamp, "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAutomations;
