import { AdminLayout } from '@/components/layout/AdminLayout';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FileText, DollarSign, Settings, Search } from 'lucide-react';

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dunningSettings, setDunningSettings] = useState({
    gracePeriod: 7,
    maxRetries: 3,
    autoEmails: true,
    bannerEnabled: true,
    autoBlock: true,
  });

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Faturas e Pagamentos</h1>
          <p className="text-muted-foreground mt-2">Gerencie faturas, pagamentos e configurações de cobrança</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded">
                <FileText className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faturas em Aberto</p>
                <p className="text-2xl font-bold">R$ 0,00</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded">
                <FileText className="text-red-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Faturas Vencidas</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded">
                <DollarSign className="text-orange-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagamentos Pendentes</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded">
                <DollarSign className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Recuperação</p>
                <p className="text-2xl font-bold">0%</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="invoices" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="invoices">Faturas</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
            <TabsTrigger value="dunning">Dunning</TabsTrigger>
          </TabsList>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    placeholder="Buscar faturas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button>
                  <FileText size={16} className="mr-2" />
                  Gerar Fatura
                </Button>
              </div>

              <div className="text-center py-12 text-muted-foreground">
                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                <p>Nenhuma fatura encontrada</p>
                <p className="text-sm mt-2">As faturas aparecerão aqui quando forem criadas</p>
              </div>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    placeholder="Buscar pagamentos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button>
                  <DollarSign size={16} className="mr-2" />
                  Registrar Pagamento Manual
                </Button>
              </div>

              <div className="text-center py-12 text-muted-foreground">
                <DollarSign size={48} className="mx-auto mb-4 opacity-20" />
                <p>Nenhum pagamento registrado</p>
                <p className="text-sm mt-2">Os pagamentos aparecerão aqui quando forem processados</p>
              </div>
            </Card>
          </TabsContent>

          {/* Dunning Tab */}
          <TabsContent value="dunning" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Settings size={24} className="text-primary" />
                <h3 className="text-xl font-semibold">Configurações de Cobrança Automática</h3>
              </div>

              <div className="space-y-6 max-w-2xl">
                <div className="space-y-2">
                  <Label htmlFor="gracePeriod">Período de Carência (dias)</Label>
                  <Input
                    id="gracePeriod"
                    type="number"
                    value={dunningSettings.gracePeriod}
                    onChange={(e) => setDunningSettings({ ...dunningSettings, gracePeriod: parseInt(e.target.value) })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Tempo de espera antes de iniciar a cobrança automática
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxRetries">Tentativas Automáticas</Label>
                  <Input
                    id="maxRetries"
                    type="number"
                    value={dunningSettings.maxRetries}
                    onChange={(e) => setDunningSettings({ ...dunningSettings, maxRetries: parseInt(e.target.value) })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Número máximo de tentativas de cobrança automática
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label htmlFor="autoEmails">E-mails Automáticos</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enviar e-mails de cobrança automaticamente
                    </p>
                  </div>
                  <Switch
                    id="autoEmails"
                    checked={dunningSettings.autoEmails}
                    onCheckedChange={(checked) => setDunningSettings({ ...dunningSettings, autoEmails: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label htmlFor="banner">Banner no Painel</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Mostrar banner de cobrança no painel do assinante
                    </p>
                  </div>
                  <Switch
                    id="banner"
                    checked={dunningSettings.bannerEnabled}
                    onCheckedChange={(checked) => setDunningSettings({ ...dunningSettings, bannerEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label htmlFor="autoBlock">Bloqueio Automático</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Bloquear automaticamente após período de carência
                    </p>
                  </div>
                  <Switch
                    id="autoBlock"
                    checked={dunningSettings.autoBlock}
                    onCheckedChange={(checked) => setDunningSettings({ ...dunningSettings, autoBlock: checked })}
                  />
                </div>

                <Button className="w-full">Salvar Configurações</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
