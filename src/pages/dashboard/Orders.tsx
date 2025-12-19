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
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useOrders();
  const { data: stats, isLoading: statsLoading } = useOrderStats();
  const updateStatus = useUpdateOrderStatus();
  const { primaryColor, buttonBgColor, buttonTextColor } = useTheme();

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
    updateStatus.mutate({ orderId, status: newStatus });
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

  const handlePrintOrder = async (order: any) => {
    try {
      // Fetch complete order data with items
      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order.id)
        .single();

      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);

      // Fetch store data
      const store = await fetchStoreData();

      // Fetch customer data if exists
      let customer = undefined;
      if (orderData?.customer_id) {
        const { data: customerData } = await supabase
          .from("customer_profiles")
          .select("*")
          .eq("id", orderData.customer_id)
          .single();
        
        if (customerData) {
          // Get customer code
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

  const handleDeleteOrder = (orderId: string) => {
    setOrderToDelete(orderId);
    setDeleteDialogOpen(true);
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
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: getLighterShade(primaryColor) }}
              >
                <Package className="h-6 w-6" style={{ color: primaryColor }} />
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
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: getLighterShade(primaryColor) }}
              >
                <Package className="h-6 w-6" style={{ color: primaryColor }} />
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
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: getLighterShade(primaryColor) }}
              >
                <Package className="h-6 w-6" style={{ color: primaryColor }} />
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
            primaryColor={primaryColor}
            buttonBgColor={buttonBgColor}
            buttonTextColor={buttonTextColor}
          />

          {/* Header */}
          <div className="p-6 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
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
          ) : filteredOrders && filteredOrders.length > 0 ? (
            <div className="divide-y">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-6 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedOrders.has(order.id)}
                        onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                      />
                    </div>

                    {/* Order Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-semibold">
                          Pedido {order.order_number || `#${order.id.slice(0, 8)}`}
                        </p>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>

                    {/* Total and Actions */}
                    <div className="text-right space-y-3">
                      <p className="text-xl font-bold" style={{ color: '#000000' }}>
                        R$ {order.total_amount.toFixed(2)}
                      </p>
                      <div className="flex gap-2 flex-wrap justify-end items-center">
                        {/* Action Icons */}
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditOrder(order)}
                            title="Editar pedido"
                          >
                            <Pencil className="h-4 w-4" style={{ color: primaryColor }} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handlePrintOrder(order)}
                            title="Imprimir pedido"
                          >
                            <Printer className="h-4 w-4" style={{ color: primaryColor }} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteOrder(order.id)}
                            title="Excluir pedido"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Status Selector */}
                        <Select
                          value={order.status}
                          onValueChange={(value) => handleStatusChange(order.id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
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
                          className="gap-2 transition-all hover:opacity-90"
                          style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
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
        primaryColor={primaryColor}
        buttonBgColor={buttonBgColor}
        buttonTextColor={buttonTextColor}
        editOrder={editOrder}
      />

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
