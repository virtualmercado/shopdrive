import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Search, Filter, Pencil, Download, Upload, Plus, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  created_at: string;
  is_active: boolean;
}

interface CustomerGroup {
  id: string;
  name: string;
  created_at: string;
}

const Customers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6a1b9a');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (user) {
      fetchPrimaryColor();
      fetchCustomers();
      fetchGroups();
    }
  }, [user, currentPage]);

  const fetchPrimaryColor = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('button_bg_color')
      .eq('id', user?.id)
      .maybeSingle();
    
    if (data?.button_bg_color) {
      setPrimaryColor(data.button_bg_color);
    }
  };

  const fetchCustomers = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // First get store_customers for this merchant
      const { data: storeCustomers, error: storeError } = await supabase
        .from('store_customers')
        .select('customer_id, is_active')
        .eq('store_owner_id', user.id);

      if (storeError) throw storeError;

      if (!storeCustomers || storeCustomers.length === 0) {
        setCustomers([]);
        setTotalCustomers(0);
        setLoading(false);
        return;
      }

      const customerIds = storeCustomers.map(sc => sc.customer_id);
      const activeMap = new Map(storeCustomers.map(sc => [sc.customer_id, sc.is_active]));

      // Fetch customer profiles
      const { data: customerProfiles, error: profileError, count } = await supabase
        .from('customer_profiles')
        .select('*', { count: 'exact' })
        .in('id', customerIds)
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (profileError) throw profileError;

      const customersWithStatus = (customerProfiles || []).map(cp => ({
        ...cp,
        is_active: activeMap.get(cp.id) ?? true
      }));

      setCustomers(customersWithStatus);
      setTotalCustomers(count || 0);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching customers:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os clientes.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('customer_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      if (import.meta.env.DEV) console.error('Error fetching groups:', error);
      return;
    }

    setGroups(data || []);
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      fetchCustomers();
      return;
    }

    const filtered = customers.filter(c => 
      c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setCustomers(filtered);
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;

    const { error } = await supabase
      .from('customer_groups')
      .insert({
        user_id: user.id,
        name: newGroupName.trim()
      });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o grupo.',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Sucesso',
      description: 'Grupo criado com sucesso!'
    });
    setNewGroupName('');
    setShowCreateGroupModal(false);
    fetchGroups();
  };

  const handleDeleteGroup = async (groupId: string) => {
    const { error } = await supabase
      .from('customer_groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o grupo.',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Sucesso',
      description: 'Grupo excluído com sucesso!'
    });
    fetchGroups();
  };

  const downloadExampleSpreadsheet = () => {
    const csvContent = "Nome do Grupo\nClientes VIP\nClientes Novos\nClientes Frequentes";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'exemplo_grupos.csv';
    link.click();
  };

  const filteredCustomers = searchTerm 
    ? customers.filter(c => 
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : customers;

  const totalPages = Math.ceil(totalCustomers / itemsPerPage);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" style={{ color: primaryColor }} />
          <h1 className="text-2xl font-semibold text-foreground">Clientes</h1>
        </div>

        <Tabs defaultValue="customers" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="customers">Listagem</TabsTrigger>
            <TabsTrigger value="groups">Grupos</TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 transition-colors"
                    style={{ borderColor: primaryColor }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = primaryColor;
                      e.currentTarget.style.boxShadow = `0 0 0 1px ${primaryColor}`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <Button 
                  onClick={handleSearch}
                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                  className="text-white"
                >
                  Buscar
                </Button>
              </div>
              <Button 
                variant="outline"
                className="gap-2 transition-colors"
                style={{ 
                  borderColor: primaryColor, 
                  color: primaryColor,
                  '--hover-bg': primaryColor,
                  '--hover-border': primaryColor
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = primaryColor;
                  e.currentTarget.style.borderColor = primaryColor;
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = primaryColor;
                  e.currentTarget.style.color = primaryColor;
                }}
              >
                <Filter className="h-4 w-4" />
                Filtros
              </Button>
            </div>

            {/* Total Count */}
            <p className="text-sm text-muted-foreground">
              Total de clientes: <span className="font-medium">{totalCustomers}</span>
            </p>

            {/* Customers Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Cadastrado há</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.full_name}</TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(customer.created_at), {
                            addSuffix: false,
                            locale: ptBR
                          })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/lojista/customers/${customer.id}`)}
                            className="hover:bg-transparent"
                            style={{ color: primaryColor }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  Anterior
                </Button>
                <span className="flex items-center px-3 text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  Próxima
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="groups" className="space-y-4">
            {/* Groups Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline"
                className="gap-2 transition-colors"
                style={{ borderColor: primaryColor, color: primaryColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = primaryColor;
                  e.currentTarget.style.borderColor = primaryColor;
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = primaryColor;
                  e.currentTarget.style.color = primaryColor;
                }}
              >
                <Upload className="h-4 w-4" />
                Importar grupos
              </Button>
              <Button 
                variant="outline"
                className="gap-2 transition-colors"
                onClick={downloadExampleSpreadsheet}
                style={{ borderColor: primaryColor, color: primaryColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = primaryColor;
                  e.currentTarget.style.borderColor = primaryColor;
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = primaryColor;
                  e.currentTarget.style.color = primaryColor;
                }}
              >
                <Download className="h-4 w-4" />
                Baixar planilha de exemplo
              </Button>
              <Button 
                className="gap-2 text-white"
                onClick={() => setShowCreateGroupModal(true)}
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="h-4 w-4" />
                Criar grupo
              </Button>
            </div>

            {/* Groups Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Nome do Grupo</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nenhum grupo criado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>
                          <input 
                            type="checkbox" 
                            className="rounded"
                            style={{ accentColor: primaryColor }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteGroup(group.id)}
                            className="hover:bg-red-50 text-red-500"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Group Modal */}
      <Dialog open={showCreateGroupModal} onOpenChange={setShowCreateGroupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Grupo</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground">Nome do grupo</label>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Ex: Clientes VIP"
              className="mt-2 transition-colors"
              style={{ borderColor: primaryColor }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.boxShadow = `0 0 0 1px ${primaryColor}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCreateGroupModal(false)}
              className="transition-colors"
              style={{ borderColor: primaryColor, color: primaryColor }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = primaryColor;
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.color = primaryColor;
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateGroup}
              className="text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Criar grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Customers;