import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Search, Filter, Pencil, Plus, Users, Trash2, Printer, FileSpreadsheet, X } from 'lucide-react';
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
  birth_date?: string | null;
  gender?: string | null;
}

interface CustomerGroup {
  id: string;
  name: string;
  created_at: string;
}

interface CustomerAddress {
  customer_id: string;
  state: string;
  city: string;
  is_default: boolean | null;
}

const Customers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6a1b9a');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<CustomerGroup | null>(null);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter states
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedBirthdayMonth, setSelectedBirthdayMonth] = useState<string>('all');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('all');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('all');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all');
  const [customerGroupAssignments, setCustomerGroupAssignments] = useState<Map<string, string[]>>(new Map());
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [filteredCustomersList, setFilteredCustomersList] = useState<Customer[]>([]);

  const months = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ];

  const getCustomerGroupNames = (customerId: string): string => {
    const groupIds = customerGroupAssignments.get(customerId) || [];
    if (groupIds.length === 0) return '-';
    const groupNames = groupIds.map(gId => {
      const group = groups.find(g => g.id === gId);
      return group?.name || '';
    }).filter(Boolean);
    return groupNames.join(', ') || '-';
  };

  const formatBirthDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };
  const [isFilterActive, setIsFilterActive] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPrimaryColor();
      fetchCustomers();
      fetchGroups();
      fetchCustomerGroupAssignments();
      fetchCustomerAddresses();
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
      const { data: storeCustomers, error: storeError } = await supabase
        .from('store_customers')
        .select('customer_id, is_active')
        .eq('store_owner_id', user.id);

      if (storeError) throw storeError;

      if (!storeCustomers || storeCustomers.length === 0) {
        setCustomers([]);
        setAllCustomers([]);
        setTotalCustomers(0);
        setLoading(false);
        return;
      }

      const customerIds = storeCustomers.map(sc => sc.customer_id);
      const activeMap = new Map(storeCustomers.map(sc => [sc.customer_id, sc.is_active]));

      // Fetch all customer profiles for filtering purposes
      const { data: allCustomerProfiles, error: allError } = await supabase
        .from('customer_profiles')
        .select('*')
        .in('id', customerIds);

      if (allError) throw allError;

      const allCustomersWithStatus = (allCustomerProfiles || []).map(cp => ({
        ...cp,
        is_active: activeMap.get(cp.id) ?? true
      }));
      setAllCustomers(allCustomersWithStatus);

      // Fetch paginated customer profiles
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

  const fetchCustomerGroupAssignments = async () => {
    if (!user) return;

    const { data: groupsData } = await supabase
      .from('customer_groups')
      .select('id')
      .eq('user_id', user.id);

    if (!groupsData || groupsData.length === 0) return;

    const groupIds = groupsData.map(g => g.id);

    const { data: assignments } = await supabase
      .from('customer_group_assignments')
      .select('customer_id, group_id')
      .in('group_id', groupIds);

    if (assignments) {
      const assignmentMap = new Map<string, string[]>();
      assignments.forEach(a => {
        const existing = assignmentMap.get(a.customer_id) || [];
        existing.push(a.group_id);
        assignmentMap.set(a.customer_id, existing);
      });
      setCustomerGroupAssignments(assignmentMap);
    }
  };

  const fetchCustomerAddresses = async () => {
    if (!user) return;

    // First get customer IDs for this store
    const { data: storeCustomers } = await supabase
      .from('store_customers')
      .select('customer_id')
      .eq('store_owner_id', user.id);

    if (!storeCustomers || storeCustomers.length === 0) {
      setCustomerAddresses([]);
      setAvailableStates([]);
      setAvailableCities([]);
      return;
    }

    const customerIds = storeCustomers.map(sc => sc.customer_id);

    // Fetch addresses for these customers
    const { data: addresses, error } = await supabase
      .from('customer_addresses')
      .select('customer_id, state, city, is_default')
      .in('customer_id', customerIds);

    if (error) {
      if (import.meta.env.DEV) console.error('Error fetching addresses:', error);
      return;
    }

    if (addresses) {
      setCustomerAddresses(addresses);
      
      // Extract unique states and cities
      const states = [...new Set(addresses.map(a => a.state).filter(Boolean))].sort();
      const cities = [...new Set(addresses.map(a => a.city).filter(Boolean))].sort();
      
      setAvailableStates(states);
      setAvailableCities(cities);
    }
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

  const confirmDeleteGroup = (group: CustomerGroup) => {
    setGroupToDelete(group);
    setShowDeleteGroupModal(true);
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;

    const { error } = await supabase
      .from('customer_groups')
      .delete()
      .eq('id', groupToDelete.id);

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
    setShowDeleteGroupModal(false);
    setGroupToDelete(null);
    fetchGroups();
  };

  // Helper to get customer address info
  const getCustomerAddress = (customerId: string): { state: string; city: string } | null => {
    const addresses = customerAddresses.filter(a => a.customer_id === customerId);
    if (addresses.length === 0) return null;
    // Prefer default address, otherwise use first
    const defaultAddr = addresses.find(a => a.is_default);
    return defaultAddr || addresses[0];
  };

  const applyFilters = () => {
    let filtered = [...allCustomers];

    // Filter by group
    if (selectedGroupFilter !== 'all') {
      filtered = filtered.filter(c => {
        const customerGroups = customerGroupAssignments.get(c.id) || [];
        return customerGroups.includes(selectedGroupFilter);
      });
    }

    // Filter by birthday month
    if (selectedBirthdayMonth !== 'all') {
      const selectedMonth = parseInt(selectedBirthdayMonth);
      filtered = filtered.filter(c => {
        if (!c.birth_date) return false;
        const birthMonth = new Date(c.birth_date).getMonth() + 1;
        return birthMonth === selectedMonth;
      });
    }

    // Filter by gender
    if (selectedGenderFilter !== 'all') {
      filtered = filtered.filter(c => c.gender === selectedGenderFilter);
    }

    // Filter by state
    if (selectedStateFilter !== 'all') {
      filtered = filtered.filter(c => {
        const addresses = customerAddresses.filter(a => a.customer_id === c.id);
        return addresses.some(a => a.state === selectedStateFilter);
      });
    }

    // Filter by city
    if (selectedCityFilter !== 'all') {
      filtered = filtered.filter(c => {
        const addresses = customerAddresses.filter(a => a.customer_id === c.id);
        return addresses.some(a => a.city === selectedCityFilter);
      });
    }

    setFilteredCustomersList(filtered);
    setIsFilterActive(
      selectedGroupFilter !== 'all' || 
      selectedBirthdayMonth !== 'all' || 
      selectedGenderFilter !== 'all' ||
      selectedStateFilter !== 'all' ||
      selectedCityFilter !== 'all'
    );
  };

  const clearFilters = () => {
    setSelectedGroupFilter('all');
    setSelectedBirthdayMonth('all');
    setSelectedGenderFilter('all');
    setSelectedStateFilter('all');
    setSelectedCityFilter('all');
    setIsFilterActive(false);
    setFilteredCustomersList([]);
    setShowFiltersModal(false);
  };


  const handlePrint = () => {
    const listToPrint = isFilterActive ? filteredCustomersList : allCustomers;
    const selectedMonthLabel = selectedBirthdayMonth !== 'all' 
      ? months.find(m => m.value === selectedBirthdayMonth)?.label 
      : null;
    
    // Build subtitle based on active filters
    const filterLabels: string[] = [];
    if (selectedMonthLabel) filterLabels.push(`Aniversariantes de ${selectedMonthLabel}`);
    if (selectedStateFilter !== 'all') filterLabels.push(`Estado: ${selectedStateFilter}`);
    if (selectedCityFilter !== 'all') filterLabels.push(`Cidade: ${selectedCityFilter}`);
    
    const printContent = `
      <html>
        <head>
          <title>Lista de Clientes${filterLabels.length > 0 ? ` - ${filterLabels.join(' | ')}` : ''}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; margin-bottom: 10px; }
            .subtitle { color: #666; margin-bottom: 20px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f4f4f4; }
            tr:nth-child(even) { background-color: #fafafa; }
          </style>
        </head>
        <body>
          <h1>Lista de Clientes${isFilterActive ? ' (Filtrada)' : ''}</h1>
          ${filterLabels.length > 0 ? `<p class="subtitle">${filterLabels.join(' | ')}</p>` : ''}
          <p>Total: ${listToPrint.length} clientes</p>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Data de Nascimento</th>
                <th>Estado</th>
                <th>Cidade</th>
                <th>Grupo</th>
              </tr>
            </thead>
            <tbody>
              ${listToPrint.map(c => {
                const groupIds = customerGroupAssignments.get(c.id) || [];
                const groupNames = groupIds.map(gId => {
                  const group = groups.find(g => g.id === gId);
                  return group?.name || '';
                }).filter(Boolean).join(', ') || '-';
                const birthDate = c.birth_date 
                  ? new Date(c.birth_date).toLocaleDateString('pt-BR') 
                  : '-';
                const addr = getCustomerAddress(c.id);
                return `
                  <tr>
                    <td>${c.full_name}</td>
                    <td>${c.email}</td>
                    <td>${c.phone || '-'}</td>
                    <td>${birthDate}</td>
                    <td>${addr?.state || '-'}</td>
                    <td>${addr?.city || '-'}</td>
                    <td>${groupNames}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExport = () => {
    const listToExport = isFilterActive ? filteredCustomersList : allCustomers;
    const selectedMonthLabel = selectedBirthdayMonth !== 'all' 
      ? months.find(m => m.value === selectedBirthdayMonth)?.label 
      : null;
    
    const headers = ['Nome', 'E-mail', 'Telefone', 'Data de Nascimento', 'Estado', 'Cidade', 'Grupo'];
    const rows = listToExport.map(c => {
      const groupIds = customerGroupAssignments.get(c.id) || [];
      const groupNames = groupIds.map(gId => {
        const group = groups.find(g => g.id === gId);
        return group?.name || '';
      }).filter(Boolean).join(', ') || '';
      const birthDate = c.birth_date 
        ? new Date(c.birth_date).toLocaleDateString('pt-BR') 
        : '';
      const addr = getCustomerAddress(c.id);
      return [
        c.full_name,
        c.email,
        c.phone || '',
        birthDate,
        addr?.state || '',
        addr?.city || '',
        groupNames
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    // Build filename based on filters
    let filename = 'clientes';
    if (selectedMonthLabel) filename += `_aniversariantes_${selectedMonthLabel.toLowerCase()}`;
    if (selectedStateFilter !== 'all') filename += `_${selectedStateFilter.toLowerCase()}`;
    if (selectedCityFilter !== 'all') filename += `_${selectedCityFilter.toLowerCase().replace(/\s/g, '_')}`;
    if (isFilterActive && !selectedMonthLabel && selectedStateFilter === 'all' && selectedCityFilter === 'all') filename += '_filtrado';
    filename += `_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.download = filename;
    link.click();
  };

  const displayedCustomers = isFilterActive 
    ? filteredCustomersList 
    : (searchTerm 
      ? customers.filter(c => 
          c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.email.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : customers);

  const totalPages = Math.ceil((isFilterActive ? filteredCustomersList.length : totalCustomers) / itemsPerPage);

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
                className="gap-2 transition-colors relative"
                onClick={() => setShowFiltersModal(true)}
                style={{ 
                  borderColor: primaryColor, 
                  color: primaryColor,
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
                {isFilterActive && (
                  <span 
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
              </Button>
            </div>

            {/* Filter Active Indicator */}
            {isFilterActive && (
              <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}10` }}>
                <span className="text-sm" style={{ color: primaryColor }}>
                  Filtros ativos: {filteredCustomersList.length} cliente(s) encontrado(s)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 px-2"
                  style={{ color: primaryColor }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              </div>
            )}

            {/* Total Count */}
            <p className="text-sm text-muted-foreground">
              Total de clientes: <span className="font-medium">{isFilterActive ? filteredCustomersList.length : totalCustomers}</span>
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
                  ) : displayedCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedCustomers.map((customer) => (
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
                    <TableHead>Nome do Grupo</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                        Nenhum grupo criado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => confirmDeleteGroup(group)}
                            className="hover:bg-red-50 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Delete Group Confirmation Modal */}
      <Dialog open={showDeleteGroupModal} onOpenChange={setShowDeleteGroupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Grupo</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir o grupo <strong>"{groupToDelete?.name}"</strong>? Esta ação não pode ser desfeita.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteGroupModal(false)}
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
              onClick={handleDeleteGroup}
              className="text-white bg-red-500 hover:bg-red-600"
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters Modal */}
      <Dialog open={showFiltersModal} onOpenChange={setShowFiltersModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Filtrar Clientes</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Group Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Grupo</label>
              <Select value={selectedGroupFilter} onValueChange={(value) => {
                setSelectedGroupFilter(value);
              }}>
                <SelectTrigger 
                  className="w-full"
                  style={{ borderColor: primaryColor }}
                >
                  <SelectValue placeholder="Selecione um grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Filtrar clientes com base nos grupos criados.</p>
            </div>

            {/* Birthday Month Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Aniversariantes do mês</label>
              <Select value={selectedBirthdayMonth} onValueChange={(value) => {
                setSelectedBirthdayMonth(value);
              }}>
                <SelectTrigger 
                  className="w-full"
                  style={{ borderColor: primaryColor }}
                >
                  <SelectValue placeholder="Selecione um mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Selecione um mês para filtrar clientes pela data de nascimento.</p>
            </div>

            {/* Gender Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Sexo informado</label>
              <Select value={selectedGenderFilter} onValueChange={(value) => {
                setSelectedGenderFilter(value);
              }}>
                <SelectTrigger 
                  className="w-full"
                  style={{ borderColor: primaryColor }}
                >
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Filtrar clientes pelo campo sexo informado no cadastro.</p>
            </div>

            {/* State Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Clientes por Estado</label>
              <Select value={selectedStateFilter} onValueChange={(value) => {
                setSelectedStateFilter(value);
              }}>
                <SelectTrigger 
                  className="w-full"
                  style={{ borderColor: primaryColor }}
                >
                  <SelectValue placeholder="Selecione um estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  {availableStates.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Filtrar clientes pelo estado informado no endereço cadastrado.</p>
            </div>

            {/* City Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Clientes por Cidade</label>
              <Select value={selectedCityFilter} onValueChange={(value) => {
                setSelectedCityFilter(value);
              }}>
                <SelectTrigger 
                  className="w-full"
                  style={{ borderColor: primaryColor }}
                >
                  <SelectValue placeholder="Selecione uma cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as cidades</SelectItem>
                  {availableCities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Filtrar clientes pela cidade informada no endereço cadastrado.</p>
            </div>

            {/* Filtered Results Display */}
            {isFilterActive && filteredCustomersList.length > 0 && (
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <p className="text-sm font-medium text-foreground">
                    Resultados: {filteredCustomersList.length} cliente(s)
                    {selectedBirthdayMonth !== 'all' && (
                      <span className="ml-1" style={{ color: primaryColor }}>
                        - Aniversariantes de {months.find(m => m.value === selectedBirthdayMonth)?.label}
                      </span>
                    )}
                    {selectedStateFilter !== 'all' && (
                      <span className="ml-1" style={{ color: primaryColor }}>
                        - Estado: {selectedStateFilter}
                      </span>
                    )}
                    {selectedCityFilter !== 'all' && (
                      <span className="ml-1" style={{ color: primaryColor }}>
                        - Cidade: {selectedCityFilter}
                      </span>
                    )}
                  </p>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">E-mail</TableHead>
                        <TableHead className="text-xs">Telefone</TableHead>
                        <TableHead className="text-xs">Nascimento</TableHead>
                        <TableHead className="text-xs">Estado</TableHead>
                        <TableHead className="text-xs">Cidade</TableHead>
                        <TableHead className="text-xs">Grupo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomersList.map((customer) => {
                        const addr = getCustomerAddress(customer.id);
                        return (
                          <TableRow key={customer.id}>
                            <TableCell className="text-xs py-2">{customer.full_name}</TableCell>
                            <TableCell className="text-xs py-2">{customer.email}</TableCell>
                            <TableCell className="text-xs py-2">{customer.phone || '-'}</TableCell>
                            <TableCell className="text-xs py-2">{formatBirthDate(customer.birth_date)}</TableCell>
                            <TableCell className="text-xs py-2">{addr?.state || '-'}</TableCell>
                            <TableCell className="text-xs py-2">{addr?.city || '-'}</TableCell>
                            <TableCell className="text-xs py-2">{getCustomerGroupNames(customer.id)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {isFilterActive && filteredCustomersList.length === 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum cliente encontrado com os filtros selecionados.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t space-y-3">
              <p className="text-sm font-medium text-foreground">Ações sobre a listagem</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  className="flex-1 gap-2 transition-colors"
                  onClick={handlePrint}
                  disabled={!isFilterActive || filteredCustomersList.length === 0}
                  style={{ borderColor: primaryColor, color: primaryColor }}
                  onMouseEnter={(e) => {
                    if (isFilterActive && filteredCustomersList.length > 0) {
                      e.currentTarget.style.backgroundColor = primaryColor;
                      e.currentTarget.style.borderColor = primaryColor;
                      e.currentTarget.style.color = '#FFFFFF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = primaryColor;
                    e.currentTarget.style.color = primaryColor;
                  }}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1 gap-2 transition-colors"
                  onClick={handleExport}
                  disabled={!isFilterActive || filteredCustomersList.length === 0}
                  style={{ borderColor: primaryColor, color: primaryColor }}
                  onMouseEnter={(e) => {
                    if (isFilterActive && filteredCustomersList.length > 0) {
                      e.currentTarget.style.backgroundColor = primaryColor;
                      e.currentTarget.style.borderColor = primaryColor;
                      e.currentTarget.style.color = '#FFFFFF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = primaryColor;
                    e.currentTarget.style.color = primaryColor;
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={clearFilters}
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
              Limpar filtros
            </Button>
            <Button 
              onClick={applyFilters}
              className="text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Aplicar filtros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Customers;
