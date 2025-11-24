import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
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
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["store-payments", store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const { data } = await supabase
        .from("payments")
        .select("*, invoices(*)")
        .eq("invoices.subscriber_id", store.id)
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

  const subscription = store.subscriptions?.[0];
  const plan = subscription?.subscription_plans;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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

          <TabsContent value="cadastro" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nome Completo</p>
                <p className="text-base">{store.full_name}</p>
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

          <TabsContent value="financeiro" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Plano Atual</p>
                <p className="text-lg font-semibold">{plan?.name || "Free"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status da Assinatura</p>
                <Badge variant={subscription?.status === "active" ? "default" : "secondary"}>
                  {subscription?.status || "Inativo"}
                </Badge>
              </div>
              {subscription && (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Valor</p>
                    <p className="text-base">
                      {plan?.price
                        ? new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(plan.price)
                        : "Grátis"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Renovação</p>
                    <p className="text-base">
                      {format(new Date(subscription.current_period_end), "dd/MM/yyyy")}
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="pt-4">
              <Button variant="outline">Alterar Plano</Button>
            </div>
          </TabsContent>

          <TabsContent value="pagamentos" className="space-y-4 mt-4">
            {paymentsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Gateway</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {format(new Date(payment.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(payment.amount)}
                        </TableCell>
                        <TableCell className="capitalize">{payment.gateway}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payment.status === "completed" ? "default" : "secondary"
                            }
                          >
                            {payment.status}
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

          <TabsContent value="integracoes" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground text-center py-8">
              Funcionalidade de integrações em desenvolvimento
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-row gap-2 justify-end">
          <Button variant="outline">Editar Lojista</Button>
          <Button variant="outline">Alterar Status</Button>
          <Button variant="destructive">Suspender Conta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
