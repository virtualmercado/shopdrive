import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users,
  Search,
  MoreHorizontal,
  Eye,
  Ban,
  RefreshCw,
  ArrowUpCircle,
  History,
  Package
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";

const AdminSubscribers = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: subscribers, isLoading, refetch } = useQuery({
    queryKey: ['admin-subscribers', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          id,
          store_name,
          email,
          created_at,
          store_slug
        `)
        .not('store_slug', 'is', null)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`store_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data: profiles, error } = await query.limit(50);

      if (error) throw error;

      // Get subscription info for each profile
      const subscriberData = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('status, subscription_plans(name)')
            .eq('user_id', profile.id)
            .single();

          const { count: productCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          return {
            ...profile,
            planName: (subscription?.subscription_plans as any)?.name || 'Sem plano',
            subscriptionStatus: subscription?.status || 'inactive',
            productCount: productCount || 0
          };
        })
      );

      return subscriberData;
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'past_due':
        return <Badge className="bg-amber-100 text-amber-800">Inadimplente</Badge>;
      default:
        return <Badge variant="secondary">Inativo</Badge>;
    }
  };

  const handleAction = (action: string, subscriberId: string, storeName: string) => {
    toast.info(`Ação "${action}" para ${storeName} será implementada em breve`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Gerenciar Assinantes</h2>
            <p className="text-sm text-muted-foreground">
              {subscribers?.length || 0} assinantes cadastrados
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Subscribers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : subscribers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum assinante encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  subscribers?.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell>
                        <div className="font-medium">{subscriber.store_name || 'Sem nome'}</div>
                        <div className="text-xs text-muted-foreground">
                          /{subscriber.store_slug}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {subscriber.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{subscriber.planName}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {subscriber.productCount}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(subscriber.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(subscriber.subscriptionStatus)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleAction('view', subscriber.id, subscriber.store_name || '')}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar Loja
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAction('upgrade', subscriber.id, subscriber.store_name || '')}
                            >
                              <ArrowUpCircle className="h-4 w-4 mr-2" />
                              Alterar Plano
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAction('history', subscriber.id, subscriber.store_name || '')}
                            >
                              <History className="h-4 w-4 mr-2" />
                              Histórico Financeiro
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAction('suspend', subscriber.id, subscriber.store_name || '')}
                              className="text-amber-600"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Suspender / Reativar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAction('block', subscriber.id, subscriber.store_name || '')}
                              className="text-destructive"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Bloquear Acesso
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscribers;
