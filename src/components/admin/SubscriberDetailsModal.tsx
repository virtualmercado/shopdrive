import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SubscriberDetailsModalProps {
  open: boolean;
  onClose: () => void;
  subscriber: any;
}

export const SubscriberDetailsModal = ({
  open,
  onClose,
  subscriber,
}: SubscriberDetailsModalProps) => {
  if (!subscriber) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Assinante</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="cadastro" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="faturas">Faturas</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome Completo</label>
                <p className="text-foreground">{subscriber.full_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-foreground">{subscriber.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                <p className="text-foreground">{subscriber.phone || 'Não informado'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">CPF/CNPJ</label>
                <p className="text-foreground">{subscriber.cpf_cnpj || 'Não informado'}</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Endereço</label>
                <p className="text-foreground">{subscriber.address || 'Não informado'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome da Loja</label>
                <p className="text-foreground">{subscriber.store_name || 'Não definido'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Store Slug</label>
                <p className="text-foreground">{subscriber.store_slug || 'Não definido'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Data de Cadastro</label>
                <p className="text-foreground">
                  {new Date(subscriber.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Última Atividade</label>
                <p className="text-foreground">
                  {subscriber.last_activity
                    ? formatDistanceToNow(new Date(subscriber.last_activity), {
                        addSuffix: true,
                        locale: ptBR,
                      })
                    : 'Nunca'}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="planos">
            <div className="space-y-4">
              {subscriber.subscriptions?.map((sub: any) => (
                <div key={sub.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">
                      {sub.subscription_plans?.name || 'Plano não definido'}
                    </h4>
                    <Badge>{sub.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Período: {new Date(sub.current_period_start).toLocaleDateString('pt-BR')} -{' '}
                    {new Date(sub.current_period_end).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="faturas">
            <p className="text-muted-foreground">Faturas serão exibidas aqui</p>
          </TabsContent>

          <TabsContent value="pagamentos">
            <p className="text-muted-foreground">Pagamentos serão exibidos aqui</p>
          </TabsContent>

          <TabsContent value="eventos">
            <p className="text-muted-foreground">Eventos serão exibidos aqui</p>
          </TabsContent>

          <TabsContent value="auditoria">
            <p className="text-muted-foreground">Logs de auditoria serão exibidos aqui</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
