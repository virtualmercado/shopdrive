import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface StoreDetailsDialogProps {
  store: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StoreDetailsDialog = ({
  store,
  open,
  onOpenChange,
}: StoreDetailsDialogProps) => {
  if (!store) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {store.store_name || "Sem nome"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="cadastro" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="suporte">Suporte</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nome Completo</p>
                <p className="text-base">{store.full_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">CPF/CNPJ</p>
                <p className="text-base">{store.cpf_cnpj || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                <p className="text-base">{store.phone || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Endereço</p>
                <p className="text-base">{store.address || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data de Cadastro</p>
                <p className="text-base">
                  {format(new Date(store.created_at), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Última Atividade</p>
                <p className="text-base">
                  {store.last_activity
                    ? format(new Date(store.last_activity), "dd/MM/yyyy 'às' HH:mm")
                    : "-"}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Plano Atual</p>
                <p className="text-base">
                  {store.subscriptions?.[0]?.subscription_plans?.name || "Free"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge>
                  {store.subscriptions?.[0]?.status || "Inativo"}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Histórico de upgrades e downgrades não disponível
            </p>
          </TabsContent>

          <TabsContent value="pagamentos" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Histórico de pagamentos não disponível
            </p>
          </TabsContent>

          <TabsContent value="suporte" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tickets de suporte não disponíveis
            </p>
          </TabsContent>

          <TabsContent value="integracoes" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Integrações não disponíveis
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
