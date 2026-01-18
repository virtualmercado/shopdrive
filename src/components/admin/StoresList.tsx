import { useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, Eye, Edit, Ban, Trash2 } from "lucide-react";
import { useStoresList } from "@/hooks/useStoresList";
import { StoreFilters } from "./StoreFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreDetailsDialog } from "./StoreDetailsDialog";
import { DateRange } from "react-day-picker";

export const StoresList = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedStore, setSelectedStore] = useState<any>(null);

  const { data, isLoading } = useStoresList(
    {
      search,
      status,
      plan,
      dateFrom: dateRange?.from?.toISOString(),
      dateTo: dateRange?.to?.toISOString(),
    },
    { page, pageSize }
  );

  const getStatusBadge = (store: any) => {
    const hasStoreSlug = store.store_slug;
    const subscription = store.subscriptions?.[0];
    const isPastDue = subscription?.status === "past_due";

    if (isPastDue) {
      return <Badge variant="destructive">Inadimplente</Badge>;
    }
    if (hasStoreSlug) {
      return <Badge className="bg-green-600">Ativo</Badge>;
    }
    return <Badge variant="secondary">Inativo</Badge>;
  };

  const getPlanName = (store: any) => {
    const subscription = store.subscriptions?.[0];
    const planName = subscription?.subscription_plans?.name;
    return planName || "Grátis";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <StoreFilters
        search={search}
        status={status}
        plan={plan}
        dateRange={dateRange}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onPlanChange={setPlan}
        onDateRangeChange={setDateRange}
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome da Loja</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data de Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.stores && data.stores.length > 0 ? (
              data.stores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">
                    {store.store_name || "Sem nome"}
                  </TableCell>
                  <TableCell>{store.full_name}</TableCell>
                  <TableCell>{(store.email as string) || "-"}</TableCell>
                  <TableCell>{store.phone || "-"}</TableCell>
                  <TableCell>{getPlanName(store)}</TableCell>
                  <TableCell>{getStatusBadge(store)}</TableCell>
                  <TableCell>
                    {format(new Date(store.created_at), "dd/MM/yyyy")}
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
                          onClick={() => setSelectedStore(store)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Ban className="mr-2 h-4 w-4" />
                          Suspender
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum lojista encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {page * pageSize + 1} a{" "}
              {Math.min((page + 1) * pageSize, data.totalCount)} de{" "}
              {data.totalCount} lojistas
            </p>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(0);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 itens</SelectItem>
                <SelectItem value="25">25 itens</SelectItem>
                <SelectItem value="50">50 itens</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * pageSize >= data.totalCount}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <StoreDetailsDialog
        store={selectedStore}
        open={!!selectedStore}
        onOpenChange={(open) => !open && setSelectedStore(null)}
      />
    </div>
  );
};
