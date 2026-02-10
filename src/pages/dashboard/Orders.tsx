import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Package, Eye, Pencil, Printer, Trash2 } from "lucide-react";
import { useOrders, useOrderStats, useUpdateOrderStatus, useOrderDetails } from "@/hooks/useOrders";
import { OrderDetailsDialog } from "@/components/orders/OrderDetailsDialog";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderFilters } from "@/components/orders/OrderFilters";
import { CreateOrderModal } from "@/components/orders/CreateOrderModal";
import { printOrderA4 } from "@/components/orders/OrderPrintA4";
import PrintFormatDialog from "@/components/orders/PrintFormatDialog";
import ThermalReceiptPrintDialog from "@/components/orders/ThermalReceiptPrintDialog";
import { printShippingLabel } from "@/components/orders/ShippingLabelPrint";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ITEMS_PER_PAGE = 50;

const Orders = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [storeData, setStoreData] = useState<any>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<any>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useOrders();
  const { data: stats, isLoading: statsLoading } = useOrderStats();
  const updateStatus = useUpdateOrderStatus();

  // Fetch store data for printing
  const fetchStoreData = async () => {
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    return data;
  };

  const getLighterShade = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const lighterR = Math.min(255, r + 40);
    const lighterG = Math.min(255, g + 40);
    const lighterB = Math.min(255, b + 40);
    return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    let filtered = [...orders];
    
    // Search by customer name
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.customer_name.toLowerCase().includes(term) ||
        order.customer_email.toLowerCase().includes(term)
      );
    }
    
    // Date filters
    if (filterType === "day" && selectedDate) {
      const start = startOfDay(selectedDate);
      const end = endOfDay(selectedDate);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= start && orderDate <= end;
      });
    } else if (filterType === "month" && selectedMonth && selectedYear) {
      const monthDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= start && orderDate <= end;
      });
    } else if (filterType === "year" && selectedYear) {
      const yearDate = new Date(parseInt(selectedYear), 0, 1);
      const start = startOfYear(yearDate);
      const end = endOfYear(yearDate);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= start && orderDate <= end;
      });
    } else if (filterType === "period" && startDate && endDate) {
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= start && orderDate <= end;
      });
    }
    
    return filtered;
  }, [orders, searchTerm, filterType, selectedDate, selectedMonth, selectedYear, startDate, endDate]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, selectedDate, selectedMonth, selectedYear, startDate, endDate]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const handleViewDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailsOpen(true);
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    // Check if it's the print shipping label action
    if (newStatus === "print_shipping_label") {
      const order = orders?.find((o) => o.id === orderId);
      if (order) {
        handlePrintShippingLabel(order);
      }
      return;
    }
    // Get current order status for stock control
    const order = orders?.find((o) => o.id === orderId);
    updateStatus.mutate({ orderId, status: newStatus, previousStatus: order?.status });
  };

  const handleCreateOrder = () => {
    setEditOrder(null);
    setCreateOrderOpen(true);
  };

  const handleEditOrder = async (order: any) => {
    // Fetch order items
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);
    
    setEditOrder({ ...order, order_items: items || [] });
    setCreateOrderOpen(true);
  };

  const handlePrintClick = (order: any) => {
    setPrintOrder(order);
    setPrintDialogOpen(true);
  };

  const handlePrintA4 = async () => {
    const order = printOrder;
    if (!order) return;
    try {
      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order.id)
        .single();

      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);

      const store = await fetchStoreData();

      let customer = undefined;
      if (orderData?.customer_id) {
        const { data: customerData } = await supabase
          .from("customer_profiles")
          .select("*")
          .eq("id", orderData.customer_id)
          .single();
        
        if (customerData) {
          const { data: storeCustomer } = await supabase
            .from("store_customers")
            .select("customer_code")
            .eq("customer_id", orderData.customer_id)
            .eq("store_owner_id", user!.id)
            .single();
          
          customer = {
            ...customerData,
            customer_code: storeCustomer?.customer_code,
          };
        }
      }

      await printOrderA4({
        order: { ...orderData, order_items: itemsData || [] },
        store: store || {},
        customer,
      });

      toast({ title: "Sucesso", description: "PDF gerado com sucesso!" });
    } catch (error) {
      console.error("Error printing order:", error);
      toast({ title: "Erro", description: "Erro ao gerar PDF do pedido.", variant: "destructive" });
    }
  };

  const [thermalPrintOrderId, setThermalPrintOrderId] = useState<string | null>(null);

  const handlePrintThermal = () => {
    if (!printOrder) return;
    setThermalPrintOrderId(printOrder.id);
  };
  const handlePrintShippingLabel = async (order: any) => {
    try {
      // Fetch store data
      const store = await fetchStoreData();

      // Initialize customer with full_name
      let customer: {
        full_name: string;
        street?: string;
        number?: string;
        complement?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
        cep?: string;
      } = { full_name: order.customer_name };
      
      if (order.customer_id) {
        const { data: customerData } = await supabase
          .from("customer_profiles")
          .select("*")
          .eq("id", order.customer_id)
          .single();
        
        if (customerData) {
          // Get customer's default address
          const { data: addressData } = await supabase
            .from("customer_addresses")
            .select("*")
            .eq("customer_id", order.customer_id)
            .eq("is_default", true)
            .single();
          
          customer = {
            full_name: customerData.full_name,
            street: addressData?.street,
            number: addressData?.number,
            complement: addressData?.complement,
            neighborhood: addressData?.neighborhood,
            city: addressData?.city,
            state: addressData?.state,
            cep: addressData?.cep,
          };
        }
      }

      printShippingLabel({
        order: {
          id: order.id,
          order_number: order.order_number,
          created_at: order.created_at,
        },
        store: store || {},
        customer,
      });

      toast({ title: "Sucesso", description: "Etiqueta de envio gerada com sucesso!" });
    } catch (error) {
      console.error("Error printing shipping label:", error);
      toast({ title: "Erro", description: "Erro ao gerar etiqueta de envio.", variant: "destructive" });
    }
  };

  const handleDeleteOrder = (order: any) => {
    // Check if order can be deleted
    if (order.order_source === 'online') {
      toast({
        title: "Exclusão não permitida",
        description: "Pedidos gerados pela loja online não podem ser excluídos.",
        variant: "destructive",
      });
      return;
    }
    
    if (order.status === 'delivered') {
      toast({
        title: "Exclusão não permitida",
        description: "Pedidos com status 'Entregue' não podem ser excluídos.",
        variant: "destructive",
      });
      return;
    }
    
    setOrderToDelete(order.id);
    setDeleteDialogOpen(true);
  };

  // Helper function to check if order can be deleted
  const canDeleteOrder = (order: any): boolean => {
    return order.order_source === 'manual' && order.status !== 'delivered';
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    
    try {
      // Delete order items first
      await supabase.from("order_items").delete().eq("order_id", orderToDelete);
      
      // Delete order
      const { error } = await supabase.from("orders").delete().eq("id", orderToDelete);
      
      if (error) throw error;
      
      toast({ title: "Sucesso", description: "Pedido excluído com sucesso!" });
      refetchOrders();
      queryClient.invalidateQueries({ queryKey: ["order-stats"] });
    } catch (error) {
      console.error("Error deleting order:", error);
      toast({ title: "Erro", description: "Erro ao excluir pedido.", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

  const handleOrderCreated = () => {
    refetchOrders();
    queryClient.invalidateQueries({ queryKey: ["order-stats"] });
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.totalOrders || 0}</p>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Pagos</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.paidOrders || 0}</p>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Processamento</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stats?.processingOrders || 0}</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Orders List */}
        <Card className="overflow-hidden">
          {/* Filters Section */}
          <OrderFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onIncludeOrder={handleCreateOrder}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            selectedMonth={selectedMonth}
            onSelectedMonthChange={setSelectedMonth}
            selectedYear={selectedYear}
            onSelectedYearChange={setSelectedYear}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />

          {/* Header */}
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={paginatedOrders.length > 0 && selectedOrders.size === paginatedOrders.length}
                onCheckedChange={handleSelectAll}
              />
              <h2 className="text-xl font-bold">Pedidos</h2>
              <span className="text-sm text-muted-foreground">
                ({filteredOrders.length} {filteredOrders.length === 1 ? "pedido" : "pedidos"})
              </span>
            </div>
          </div>

          {ordersLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : paginatedOrders && paginatedOrders.length > 0 ? (
            <>
              <div className="divide-y">
              {paginatedOrders.map((order) => (
                  <div key={order.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Checkbox */}
                      <div className="pt-1 shrink-0">
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                        />
                      </div>

                      {/* Order Content - Full width container */}
                      <div className="flex-1 min-w-0 space-y-3">
                        {/* Mobile: Stack vertically, Desktop: Side by side */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          {/* Order Info */}
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm sm:text-base break-words">
                                Pedido {order.order_number || `#${order.id.slice(0, 8)}`}
                              </p>
                              <OrderStatusBadge status={order.status} />
                            </div>
                            <p className="text-sm text-muted-foreground break-words">{order.customer_name}</p>
                            <p className="text-sm text-muted-foreground break-all">{order.customer_email}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>

                          {/* Total - Right aligned on desktop, left on mobile */}
                          <div className="shrink-0">
                            <p className="text-lg sm:text-xl font-bold" style={{ color: '#000000' }}>
                              R$ {order.total_amount.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Actions row - Always at bottom, responsive */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Action Icons */}
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditOrder(order)}
                              title="Editar pedido"
                            >
                              <Pencil className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handlePrintClick(order)}
                              title="Imprimir pedido"
                            >
                              <Printer className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${canDeleteOrder(order) ? 'text-destructive hover:text-destructive' : 'text-muted-foreground cursor-not-allowed opacity-50'}`}
                              onClick={() => handleDeleteOrder(order)}
                              disabled={!canDeleteOrder(order)}
                              title={
                                order.order_source === 'online' 
                                  ? "Pedidos gerados pela loja online não podem ser excluídos" 
                                  : order.status === 'delivered' 
                                    ? "Pedidos com status 'Entregue' não podem ser excluídos" 
                                    : "Excluir pedido"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Status Selector */}
                          <Select
                            value={order.status}
                            onValueChange={(value) => handleStatusChange(order.id, value)}
                          >
                            <SelectTrigger className="w-[130px] sm:w-[140px] shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="paid">Pago</SelectItem>
                              <SelectItem value="processing">Processando</SelectItem>
                              <SelectItem value="shipped">Enviado</SelectItem>
                              <SelectItem value="delivered">Entregue</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                              <Separator className="my-1" />
                              <SelectItem value="print_shipping_label" className="leading-tight whitespace-pre-line">
                                {"Imprimir etiqueta\nde envio"}
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {/* View Details Button */}
                          <Button
                            size="sm"
                            className="gap-2 transition-all hover:opacity-90 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                            onClick={() => handleViewDetails(order.id)}
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-4 border-t flex justify-center items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="border-primary text-primary"
                  >
                    Anterior
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, index) => (
                      typeof page === 'number' ? (
                        <Button
                          key={index}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className={`min-w-[36px] ${currentPage === page ? 'bg-primary text-primary-foreground' : 'border-primary text-primary'}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ) : (
                        <span key={index} className="px-2 text-muted-foreground">...</span>
                      )
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="border-primary text-primary"
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum pedido encontrado</p>
            </div>
          )}
        </Card>
      </div>

      {/* Modals */}
      <OrderDetailsDialog
        orderId={selectedOrderId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <CreateOrderModal
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
        onOrderCreated={handleOrderCreated}
        editOrder={editOrder}
      />

      <PrintFormatDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        onSelectA4={handlePrintA4}
        onSelectThermal={handlePrintThermal}
      />

      {thermalPrintOrderId && (
        <ThermalReceiptPrintDialog
          orderId={thermalPrintOrderId}
          onClose={() => setThermalPrintOrderId(null)}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Orders;
