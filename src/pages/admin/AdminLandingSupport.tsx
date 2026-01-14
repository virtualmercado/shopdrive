import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { 
  Globe,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Copy,
  Mail,
  FileText,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Archive,
  Loader2,
  Headset,
  CreditCard,
  Shield,
  Handshake,
  User,
  Calendar,
  Tag,
  ExternalLink
} from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

interface LandingTicket {
  id: string;
  protocolo: string;
  canal_origem: string;
  categoria: string;
  nome: string;
  email: string;
  loja_url_ou_nome: string | null;
  tipo_problema: string | null;
  cpf_cnpj: string | null;
  empresa: string | null;
  mensagem: string;
  status: string;
  prioridade: string;
  responsavel: string | null;
  notas_internas: string | null;
  created_at: string;
  updated_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface ResponseTemplate {
  id: string;
  categoria: string;
  assunto: string;
  mensagem: string;
}

const categoryMap: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  suporte_lojista: { label: "Suporte ao Lojista", icon: Headset, color: "bg-blue-100 text-blue-800" },
  financeiro_cobrancas: { label: "Financeiro e Cobranças", icon: CreditCard, color: "bg-green-100 text-green-800" },
  lgpd_privacidade: { label: "Privacidade e LGPD", icon: Shield, color: "bg-purple-100 text-purple-800" },
  comercial_parcerias: { label: "Comercial e Parcerias", icon: Handshake, color: "bg-amber-100 text-amber-800" },
};

const statusMap: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-red-100 text-red-800" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-800" },
  aguardando_cliente: { label: "Aguardando Cliente", color: "bg-yellow-100 text-yellow-800" },
  resolvido: { label: "Resolvido", color: "bg-green-100 text-green-800" },
  arquivado: { label: "Arquivado", color: "bg-gray-100 text-gray-800" },
};

const prioridadeMap: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-gray-100 text-gray-800" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-800" },
  alta: { label: "Alta", color: "bg-red-100 text-red-800" },
};

const AdminLandingSupport = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<LandingTicket | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notasInternas, setNotasInternas] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [generatedResponse, setGeneratedResponse] = useState("");
  const [activeTab, setActiveTab] = useState("tickets");
  const [editingTemplate, setEditingTemplate] = useState<ResponseTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Fetch tickets
  const { data: tickets, isLoading: loadingTickets, refetch } = useQuery({
    queryKey: ['landing-tickets', statusFilter, categoryFilter, prioridadeFilter],
    queryFn: async () => {
      let query = supabase
        .from('tickets_landing_page' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (categoryFilter !== 'all') {
        query = query.eq('categoria', categoryFilter);
      }
      if (prioridadeFilter !== 'all') {
        query = query.eq('prioridade', prioridadeFilter);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as unknown as LandingTicket[];
    }
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['landing-tickets-stats'],
    queryFn: async () => {
      const statuses = ['novo', 'em_andamento', 'aguardando_cliente', 'resolvido', 'arquivado'];
      const counts: Record<string, number> = {};

      for (const status of statuses) {
        const { count } = await supabase
          .from('tickets_landing_page' as any)
          .select('*', { count: 'exact', head: true })
          .eq('status', status);
        counts[status] = count || 0;
      }

      return counts;
    }
  });

  // Fetch templates
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['response-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_response_templates' as any)
        .select('*')
        .order('categoria');
      if (error) throw error;
      return data as unknown as ResponseTemplate[];
    }
  });

  // Update ticket mutation
  const updateTicketMutation = useMutation({
    mutationFn: async (updates: Partial<LandingTicket> & { id: string }) => {
      const { error } = await supabase
        .from('tickets_landing_page' as any)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', updates.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['landing-tickets-stats'] });
      toast.success("Ticket atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar ticket");
    }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (template: ResponseTemplate) => {
      const { error } = await supabase
        .from('landing_response_templates' as any)
        .update({
          assunto: template.assunto,
          mensagem: template.mensagem,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['response-templates'] });
      toast.success("Template atualizado com sucesso!");
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar template");
    }
  });

  const filteredTickets = tickets?.filter(ticket => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      ticket.protocolo?.toLowerCase().includes(search) ||
      ticket.nome?.toLowerCase().includes(search) ||
      ticket.email?.toLowerCase().includes(search) ||
      ticket.mensagem?.toLowerCase().includes(search)
    );
  });

  const openTicketSheet = (ticket: LandingTicket) => {
    setSelectedTicket(ticket);
    setNotasInternas(ticket.notas_internas || "");
    setResponsavel(ticket.responsavel || "");
    setGeneratedResponse("");
    setSheetOpen(true);
  };

  const handleStatusChange = (ticketId: string, newStatus: string) => {
    updateTicketMutation.mutate({ id: ticketId, status: newStatus });
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    }
  };

  const handlePrioridadeChange = (ticketId: string, newPrioridade: string) => {
    updateTicketMutation.mutate({ id: ticketId, prioridade: newPrioridade });
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, prioridade: newPrioridade });
    }
  };

  const handleSaveNotes = () => {
    if (!selectedTicket) return;
    updateTicketMutation.mutate({ 
      id: selectedTicket.id, 
      notas_internas: notasInternas,
      responsavel: responsavel 
    });
    setSelectedTicket({ 
      ...selectedTicket, 
      notas_internas: notasInternas,
      responsavel: responsavel 
    });
  };

  const generateResponse = () => {
    if (!selectedTicket) return;
    const template = templates?.find(t => t.categoria === selectedTicket.categoria);
    if (!template) {
      toast.error("Template não encontrado para esta categoria");
      return;
    }

    let response = template.mensagem
      .replace(/{protocolo}/g, selectedTicket.protocolo)
      .replace(/{nome}/g, selectedTicket.nome);

    setGeneratedResponse(response);
    toast.success("Resposta gerada! Copie e envie por e-mail.");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const openEmailClient = () => {
    if (!selectedTicket) return;
    const template = templates?.find(t => t.categoria === selectedTicket.categoria);
    const subject = template?.assunto
      .replace(/{protocolo}/g, selectedTicket.protocolo)
      .replace(/{nome}/g, selectedTicket.nome) || `Resposta - ${selectedTicket.protocolo}`;
    
    const body = encodeURIComponent(generatedResponse || "");
    window.open(`mailto:${selectedTicket.email}?subject=${encodeURIComponent(subject)}&body=${body}`);
  };

  const getCategoryBadge = (categoria: string) => {
    const cat = categoryMap[categoria];
    if (!cat) return <Badge variant="secondary">{categoria}</Badge>;
    const Icon = cat.icon;
    return (
      <Badge className={`${cat.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {cat.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const st = statusMap[status];
    if (!st) return <Badge variant="secondary">{status}</Badge>;
    return <Badge className={st.color}>{st.label}</Badge>;
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const pr = prioridadeMap[prioridade];
    if (!pr) return <Badge variant="secondary">{prioridade}</Badge>;
    return <Badge className={pr.color}>{pr.label}</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tickets" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Tickets
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Respostas Padrão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <div className="p-4 flex flex-col items-center">
                  <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
                  <p className="text-2xl font-bold text-red-600">{stats?.novo || 0}</p>
                  <p className="text-xs text-muted-foreground">Novos</p>
                </div>
              </Card>
              <Card>
                <div className="p-4 flex flex-col items-center">
                  <Clock className="h-6 w-6 text-blue-500 mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{stats?.em_andamento || 0}</p>
                  <p className="text-xs text-muted-foreground">Em Andamento</p>
                </div>
              </Card>
              <Card>
                <div className="p-4 flex flex-col items-center">
                  <RefreshCw className="h-6 w-6 text-yellow-500 mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">{stats?.aguardando_cliente || 0}</p>
                  <p className="text-xs text-muted-foreground">Aguardando</p>
                </div>
              </Card>
              <Card>
                <div className="p-4 flex flex-col items-center">
                  <CheckCircle className="h-6 w-6 text-green-500 mb-2" />
                  <p className="text-2xl font-bold text-green-600">{stats?.resolvido || 0}</p>
                  <p className="text-xs text-muted-foreground">Resolvidos</p>
                </div>
              </Card>
              <Card>
                <div className="p-4 flex flex-col items-center">
                  <Archive className="h-6 w-6 text-gray-500 mb-2" />
                  <p className="text-2xl font-bold text-gray-600">{stats?.arquivado || 0}</p>
                  <p className="text-xs text-muted-foreground">Arquivados</p>
                </div>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por protocolo, nome, e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-72"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(statusMap).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {Object.entries(categoryMap).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Object.entries(prioridadeMap).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
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
                      <TableHead>Protocolo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTickets ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredTickets?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <Globe className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                          Nenhum ticket encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTickets?.map((ticket) => (
                        <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openTicketSheet(ticket)}>
                          <TableCell>
                            <span className="font-mono text-sm font-medium">{ticket.protocolo}</span>
                          </TableCell>
                          <TableCell>{getCategoryBadge(ticket.categoria)}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{ticket.nome}</p>
                              <p className="text-xs text-muted-foreground">{ticket.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                          <TableCell>{getPrioridadeBadge(ticket.prioridade)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openTicketSheet(ticket); }}>
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Respostas Padrão – Landing Page
                </CardTitle>
                <CardDescription>
                  Esses textos servem como base para copiar/colar. Nenhuma resposta é enviada automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingTemplates ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ))
                ) : (
                  templates?.map((template) => {
                    const cat = categoryMap[template.categoria];
                    const Icon = cat?.icon || FileText;
                    return (
                      <div key={template.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">{cat?.label || template.categoria}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setEditingTemplate(template);
                                setTemplateDialogOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Assunto:</Label>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{template.assunto}</p>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(template.assunto, "Assunto")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Mensagem:</Label>
                            <div className="relative">
                              <pre className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md font-sans">
                                {template.mensagem}
                              </pre>
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="absolute top-2 right-2"
                                onClick={() => copyToClipboard(template.mensagem, "Mensagem")}
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Copiar texto
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Ticket Detail Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            {selectedTicket && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    {selectedTicket.protocolo}
                  </SheetTitle>
                  <SheetDescription>
                    Ticket da Landing Page
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Status and Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Status</Label>
                      <Select 
                        value={selectedTicket.status} 
                        onValueChange={(value) => handleStatusChange(selectedTicket.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusMap).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Prioridade</Label>
                      <Select 
                        value={selectedTicket.prioridade} 
                        onValueChange={(value) => handlePrioridadeChange(selectedTicket.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(prioridadeMap).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Contact Info */}
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Informações do Contato
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Nome</p>
                        <p className="font-medium">{selectedTicket.nome}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">E-mail</p>
                        <p className="font-medium">{selectedTicket.email}</p>
                      </div>
                      {selectedTicket.loja_url_ou_nome && (
                        <div>
                          <p className="text-muted-foreground text-xs">Loja</p>
                          <p className="font-medium">{selectedTicket.loja_url_ou_nome}</p>
                        </div>
                      )}
                      {selectedTicket.tipo_problema && (
                        <div>
                          <p className="text-muted-foreground text-xs">Tipo de Problema</p>
                          <p className="font-medium capitalize">{selectedTicket.tipo_problema}</p>
                        </div>
                      )}
                      {selectedTicket.cpf_cnpj && (
                        <div>
                          <p className="text-muted-foreground text-xs">CPF/CNPJ</p>
                          <p className="font-medium">{selectedTicket.cpf_cnpj}</p>
                        </div>
                      )}
                      {selectedTicket.empresa && (
                        <div>
                          <p className="text-muted-foreground text-xs">Empresa</p>
                          <p className="font-medium">{selectedTicket.empresa}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Category */}
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {getCategoryBadge(selectedTicket.categoria)}
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Mensagem</h4>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{selectedTicket.mensagem}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Responsavel */}
                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <Input
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      placeholder="Nome do responsável pelo atendimento"
                    />
                  </div>

                  {/* Notas Internas */}
                  <div className="space-y-2">
                    <Label>Notas Internas</Label>
                    <Textarea
                      value={notasInternas}
                      onChange={(e) => setNotasInternas(e.target.value)}
                      placeholder="Adicione notas internas sobre este ticket..."
                      className="min-h-[100px]"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleSaveNotes}
                      disabled={updateTicketMutation.isPending}
                    >
                      {updateTicketMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      Salvar Notas
                    </Button>
                  </div>

                  <Separator />

                  {/* Generate Response */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Button onClick={generateResponse}>
                        <FileText className="h-4 w-4 mr-2" />
                        Gerar Resposta
                      </Button>
                      {generatedResponse && (
                        <Button variant="outline" onClick={openEmailClient}>
                          <Mail className="h-4 w-4 mr-2" />
                          Responder por E-mail
                        </Button>
                      )}
                    </div>
                    {generatedResponse && (
                      <div className="relative">
                        <pre className="text-sm whitespace-pre-wrap bg-muted/50 p-4 rounded-lg font-sans">
                          {generatedResponse}
                        </pre>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(generatedResponse, "Resposta")}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copiar
                        </Button>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      Criado em: {format(new Date(selectedTicket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {selectedTicket.ip_address && (
                      <p>IP: {selectedTicket.ip_address}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Edit Template Dialog */}
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Template de Resposta</DialogTitle>
              <DialogDescription>
                {editingTemplate && categoryMap[editingTemplate.categoria]?.label}
              </DialogDescription>
            </DialogHeader>
            {editingTemplate && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Input
                    value={editingTemplate.assunto}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, assunto: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis: {"{protocolo}"}, {"{nome}"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={editingTemplate.mensagem}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, mensagem: e.target.value })}
                    className="min-h-[250px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis: {"{protocolo}"}, {"{nome}"}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => updateTemplateMutation.mutate(editingTemplate)}
                    disabled={updateTemplateMutation.isPending}
                  >
                    {updateTemplateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminLandingSupport;
