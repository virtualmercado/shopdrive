import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  HeadphonesIcon,
  Search,
  Filter,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Trash2
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";

interface MerchantTicket {
  id: string;
  merchant_id: string;
  message: string;
  response: string | null;
  status: string;
  created_at: string;
  answered_at: string | null;
  read_at: string | null;
  updated_at: string;
  profiles?: {
    store_name: string | null;
    email: string | null;
  };
}

const AdminSupport = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<MerchantTicket | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [sendingResponse, setSendingResponse] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState(false);

  const { data: tickets, isLoading, refetch } = useQuery({
    queryKey: ['admin-merchant-tickets', statusFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('merchant_support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: ticketsData, error } = await query.limit(50);
      if (error) throw error;

      // Fetch profiles for each unique merchant_id
      const merchantIds = [...new Set(ticketsData?.map(t => t.merchant_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, store_name, email')
        .in('id', merchantIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      return (ticketsData || []).map(ticket => ({
        ...ticket,
        profiles: profilesMap.get(ticket.merchant_id) || null
      })) as MerchantTicket[];
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-merchant-tickets-stats'],
    queryFn: async () => {
      const { count: pendingCount } = await supabase
        .from('merchant_support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: answeredCount } = await supabase
        .from('merchant_support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'answered');

      const { count: readCount } = await supabase
        .from('merchant_support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'read');

      return {
        pending: pendingCount || 0,
        answered: answeredCount || 0,
        read: readCount || 0
      };
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800">Aberto</Badge>;
      case 'answered':
        return <Badge className="bg-blue-100 text-blue-800">Em Andamento</Badge>;
      case 'read':
        return <Badge className="bg-green-100 text-green-800">Resolvido</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    const updateData: Record<string, any> = { status: newStatus };
    
    if (newStatus === 'answered') {
      updateData.answered_at = new Date().toISOString();
    } else if (newStatus === 'read') {
      updateData.read_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('merchant_support_tickets')
      .update(updateData)
      .eq('id', ticketId);

    if (error) {
      toast.error("Erro ao alterar status");
      return;
    }

    toast.success("Status atualizado com sucesso");
    refetch();
    queryClient.invalidateQueries({ queryKey: ['admin-merchant-tickets-stats'] });
    
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    }
  };

  const handleSendResponse = async () => {
    if (!selectedTicket || !responseText.trim()) return;

    setSendingResponse(true);

    const { error } = await supabase
      .from('merchant_support_tickets')
      .update({
        response: responseText.trim(),
        status: 'answered',
        answered_at: new Date().toISOString()
      })
      .eq('id', selectedTicket.id);

    if (error) {
      toast.error("Erro ao enviar resposta");
      setSendingResponse(false);
      return;
    }

    toast.success("Resposta enviada com sucesso!");
    setResponseText("");
    setSendingResponse(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['admin-merchant-tickets-stats'] });
    
    setSelectedTicket({
      ...selectedTicket,
      response: responseText.trim(),
      status: 'answered',
      answered_at: new Date().toISOString()
    });
  };

  const openTicketDialog = (ticket: MerchantTicket) => {
    setSelectedTicket(ticket);
    setResponseText(ticket.response || "");
    setExpandedMessage(false);
    setDialogOpen(true);
  };

  const handleDeleteTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from('merchant_support_tickets')
      .delete()
      .eq('id', ticketId);

    if (error) {
      toast.error("Erro ao excluir ticket");
      return;
    }

    toast.success("Ticket excluído com sucesso");
    refetch();
    queryClient.invalidateQueries({ queryKey: ['admin-merchant-tickets-stats'] });
  };

  const filteredTickets = tickets?.filter(ticket => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      ticket.message?.toLowerCase().includes(search) ||
      ticket.profiles?.store_name?.toLowerCase().includes(search) ||
      ticket.profiles?.email?.toLowerCase().includes(search)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="p-6 flex flex-row items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tickets Abertos</p>
                <p className="text-2xl font-bold text-amber-600">{stats?.pending || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Aguardando atendimento</p>
              </div>
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
          </Card>

          <Card>
            <div className="p-6 flex flex-row items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.answered || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Respondidos</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card>
            <div className="p-6 flex flex-row items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resolvidos</p>
                <p className="text-2xl font-bold text-green-600">{stats?.read || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Lidos pelo lojista</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Abertos</SelectItem>
                <SelectItem value="answered">Em Andamento</SelectItem>
                <SelectItem value="read">Resolvidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Tickets Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Assinante</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredTickets?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhum ticket encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets?.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm font-medium truncate">{ticket.message}</p>
                          <div className="mt-1">
                            {getStatusBadge(ticket.status)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {ticket.profiles?.store_name || 'Sem nome'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ticket.profiles?.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openTicketDialog(ticket)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteTicket(ticket.id)}
                            disabled={ticket.status !== 'read'}
                            className={ticket.status === 'read' 
                              ? "text-red-600 hover:text-red-700 hover:bg-red-50" 
                              : "text-muted-foreground opacity-50 cursor-not-allowed"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Ticket Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HeadphonesIcon className="h-5 w-5" />
                Detalhes do Ticket
              </DialogTitle>
            </DialogHeader>
            
            {selectedTicket && (
              <div className="space-y-4 mt-2">
                {/* Ticket info */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedTicket.profiles?.store_name || 'Lojista'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTicket.profiles?.email}
                    </p>
                  </div>
                  <Select 
                    value={selectedTicket.status} 
                    onValueChange={(value) => handleStatusChange(selectedTicket.id, value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Aberto</SelectItem>
                      <SelectItem value="answered">Em Andamento</SelectItem>
                      <SelectItem value="read">Resolvido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Message from merchant - click to expand */}
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedMessage(!expandedMessage)}
                    className="w-full p-4 bg-muted/50 text-left flex items-start justify-between gap-3 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        Mensagem do lojista:
                      </p>
                      <p className={`text-sm ${!expandedMessage ? 'line-clamp-2' : ''}`}>
                        {selectedTicket.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(selectedTicket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    {expandedMessage ? (
                      <ChevronUp className="h-4 w-4 flex-shrink-0 mt-1 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 mt-1 text-muted-foreground" />
                    )}
                  </button>

                  {/* Response area - visible when expanded */}
                  {expandedMessage && selectedTicket.response && (
                    <div className="p-4 border-t bg-blue-50/50">
                      <p className="text-xs font-semibold text-blue-800 mb-1">
                        Resposta do suporte:
                      </p>
                      <p className="text-sm text-foreground">
                        {selectedTicket.response}
                      </p>
                      {selectedTicket.answered_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Respondido em {format(new Date(selectedTicket.answered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Response input */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Responder ao ticket</label>
                  <Textarea 
                    placeholder="Digite sua resposta..."
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleSendResponse}
                      disabled={!responseText.trim() || sendingResponse}
                      className="bg-[#6a1b9a] hover:bg-[#5a1580] gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Enviar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSupport;
