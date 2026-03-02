import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreDomainTab } from "./StoreDomainTab";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

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
  const queryClient = useQueryClient();

  const { data: masterSub, isLoading: subLoading, refetch: refetchSub } = useQuery({
    queryKey: ["store-master-subscription", store?.id],
    queryFn: async () => {
      if (!store?.id) return null;
      const { data } = await supabase
        .from("master_subscriptions")
        .select("*")
        .eq("user_id", store.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!store?.id && open,
  });

  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ["store-invoices", store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("subscriber_id", store.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!store?.id && open,
  });

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["store-tickets", store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("customer_id", store.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!store?.id && open,
  });

  if (!store) return null;

  const getPlanName = () => {
    if (!masterSub) return "Grátis";
    const pid = masterSub.plan_id;
    if (pid === "premium") return "Premium";
    if (pid === "pro") return "Pro";
    if (pid === "gratis") return "Grátis";
    return pid || "Grátis";
  };

  const getSubStatus = () => {
    if (!masterSub) return "Inativo";
    if (masterSub.plan_id === "gratis") return "Grátis";
    if (masterSub.status === "cancelled" && masterSub.downgrade_reason === "payment_failed") return "Grátis";
    if (masterSub.status === "active") return "Ativo";
    if (masterSub.status === "past_due") return "Inadimplente";
    if (masterSub.status === "pending") return "Pendente";
    return "Inativo";
  };

  const getSubStatusVariant = () => {
    const s = getSubStatus();
    if (s === "Ativo") return "default" as const;
    if (s === "Inadimplente") return "destructive" as const;
    return "secondary" as const;
  };

  const handleRefresh = async () => {
    await Promise.all([refetchSub(), refetchInvoices()]);
    queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
    toast.success("Dados atualizados com sucesso");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {store.store_name || "Sem nome"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="cadastro" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="suporte">Suporte</TabsTrigger>
            <TabsTrigger value="dominio">Domínio</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nome Completo</p>
                <p className="text-base">{store.full_name || store.store_name || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">E-mail</p>
                <p className="text-base">{store.email || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">CPF/CNPJ</p>
                <p className="text-base">{store.cpf_cnpj || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                <p className="text-base">{store.phone || "-"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Endereço</p>
                <p className="text-base">{store.address || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Slug da Loja</p>
                <p className="text-base">{store.store_slug || "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data de Cadastro</p>
                <p className="text-base">
                  {store.created_at ? format(new Date(store.created_at), "dd/MM/yyyy 'às' HH:mm") : "-"}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-4 mt-4">
            {subLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plano Atual</p>
                  <p className="text-lg font-semibold">{getPlanName()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status da Assinatura</p>
                  <Badge variant={getSubStatusVariant()}>
                    {getSubStatus()}
                  </Badge>
                </div>
                {masterSub && masterSub.plan_id !== "gratis" && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Valor Mensal</p>
                      <p className="text-base">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(masterSub.monthly_price || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Ciclo</p>
                      <p className="text-base capitalize">{masterSub.billing_cycle || "-"}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pagamentos" className="space-y-4 mt-4">
            {invoicesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : invoices && invoices.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice: any) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          {format(new Date(invoice.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="capitalize">{invoice.plan || "-"}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(invoice.amount)}
                        </TableCell>
                        <TableCell className="capitalize">{invoice.payment_method || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invoice.status === "paid" ? "default" :
                              invoice.status === "pending" ? "secondary" : "destructive"
                            }
                          >
                            {invoice.status === "paid" ? "Pago" :
                             invoice.status === "pending" ? "Pendente" : invoice.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum pagamento registrado
              </p>
            )}
          </TabsContent>

          <TabsContent value="suporte" className="space-y-4 mt-4">
            {ticketsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : tickets && tickets.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket: any) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono">{ticket.ticket_number}</TableCell>
                        <TableCell>{ticket.subject}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              ticket.priority === "high"
                                ? "destructive"
                                : ticket.priority === "medium"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {ticket.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge>{ticket.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(ticket.created_at), "dd/MM/yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum ticket de suporte registrado
              </p>
            )}
          </TabsContent>

          <TabsContent value="dominio" className="space-y-4 mt-4">
            <StoreDomainTab storeId={store.id} />
          </TabsContent>

          <TabsContent value="integracoes" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground text-center py-8">
              Funcionalidade de integrações em desenvolvimento
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}