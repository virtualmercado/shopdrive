import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Pencil, Save, X, User, MapPin, Users, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  created_at: string;
}

interface CustomerAddress {
  id: string;
  recipient_name: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
}

interface CustomerGroup {
  id: string;
  name: string;
}

const CustomerDetail = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [address, setAddress] = useState<CustomerAddress | null>(null);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [currentGroupId, setCurrentGroupId] = useState<string>('');
  const [primaryColor, setPrimaryColor] = useState('#6a1b9a');
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(true);
  
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Partial<CustomerProfile>>({});
  const [editedAddress, setEditedAddress] = useState<Partial<CustomerAddress>>({});

  useEffect(() => {
    if (user && customerId) {
      fetchData();
    }
  }, [user, customerId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchPrimaryColor(),
      fetchCustomer(),
      fetchAddress(),
      fetchGroups(),
      fetchCustomerGroup(),
      fetchCustomerStatus()
    ]);
    setLoading(false);
  };

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

  const fetchCustomer = async () => {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();

    if (error || !data) {
      toast({
        title: 'Erro',
        description: 'Cliente não encontrado.',
        variant: 'destructive'
      });
      navigate('/lojista/customers');
      return;
    }

    setCustomer(data);
    setEditedCustomer(data);
  };

  const fetchAddress = async () => {
    const { data } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_default', true)
      .maybeSingle();

    if (data) {
      setAddress(data);
      setEditedAddress(data);
    }
  };

  const fetchGroups = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('customer_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    setGroups(data || []);
  };

  const fetchCustomerGroup = async () => {
    if (!user || !customerId) return;

    const { data } = await supabase
      .from('customer_group_assignments')
      .select('group_id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (data) {
      setSelectedGroupId(data.group_id);
      setCurrentGroupId(data.group_id);
    }
  };

  const fetchCustomerStatus = async () => {
    if (!user || !customerId) return;

    const { data } = await supabase
      .from('store_customers')
      .select('is_active')
      .eq('store_owner_id', user.id)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (data) {
      setIsActive(data.is_active);
    }
  };

  const handleSaveProfile = async () => {
    if (!customerId) return;

    const { error } = await supabase
      .from('customer_profiles')
      .update({
        full_name: editedCustomer.full_name,
        phone: editedCustomer.phone,
        cpf: editedCustomer.cpf
      })
      .eq('id', customerId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar os dados.',
        variant: 'destructive'
      });
      return;
    }

    toast({ title: 'Sucesso', description: 'Dados atualizados com sucesso!' });
    setEditingProfile(false);
    fetchCustomer();
  };

  const handleSaveAddress = async () => {
    if (!address?.id) return;

    const { error } = await supabase
      .from('customer_addresses')
      .update({
        recipient_name: editedAddress.recipient_name,
        cep: editedAddress.cep,
        street: editedAddress.street,
        number: editedAddress.number,
        complement: editedAddress.complement,
        neighborhood: editedAddress.neighborhood,
        city: editedAddress.city,
        state: editedAddress.state
      })
      .eq('id', address.id);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o endereço.',
        variant: 'destructive'
      });
      return;
    }

    toast({ title: 'Sucesso', description: 'Endereço atualizado com sucesso!' });
    setEditingAddress(false);
    fetchAddress();
  };

  const handleChangeGroup = async () => {
    if (!user || !customerId) return;

    // Remove current group assignment if exists
    if (currentGroupId) {
      await supabase
        .from('customer_group_assignments')
        .delete()
        .eq('customer_id', customerId)
        .eq('group_id', currentGroupId);
    }

    // Add new group assignment if selected
    if (selectedGroupId && selectedGroupId !== 'none') {
      const { error } = await supabase
        .from('customer_group_assignments')
        .insert({
          customer_id: customerId,
          group_id: selectedGroupId
        });

      if (error) {
        toast({
          title: 'Erro',
          description: 'Não foi possível alterar o grupo.',
          variant: 'destructive'
        });
        return;
      }
    }

    toast({ title: 'Sucesso', description: 'Grupo alterado com sucesso!' });
    setCurrentGroupId(selectedGroupId);
  };

  const handleResetPassword = async () => {
    if (!customer?.email) return;

    const { error } = await supabase.auth.resetPasswordForEmail(customer.email);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o email de redefinição.',
        variant: 'destructive'
      });
      return;
    }

    toast({ 
      title: 'Sucesso', 
      description: 'Email de redefinição de senha enviado!' 
    });
  };

  const handleToggleActive = async () => {
    if (!user || !customerId) return;

    const { error } = await supabase
      .from('store_customers')
      .update({ is_active: !isActive })
      .eq('store_owner_id', user.id)
      .eq('customer_id', customerId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status.',
        variant: 'destructive'
      });
      return;
    }

    setIsActive(!isActive);
    toast({ 
      title: 'Sucesso', 
      description: isActive ? 'Cliente desativado.' : 'Cliente reativado.' 
    });
  };

  const handleAnonymize = async () => {
    if (!customerId) return;

    const anonymizedData = {
      full_name: 'Cliente Anonymizado',
      email: `anonymized_${customerId}@deleted.com`,
      phone: null,
      cpf: null
    };

    const { error } = await supabase
      .from('customer_profiles')
      .update(anonymizedData)
      .eq('id', customerId);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível anonymizar o cliente.',
        variant: 'destructive'
      });
      return;
    }

    toast({ title: 'Sucesso', description: 'Dados do cliente foram anonymizados.' });
    fetchCustomer();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Cliente não encontrado.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/lojista/customers')}
            style={{ color: primaryColor }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{customer.full_name}</h1>
            <p className="text-sm text-muted-foreground">
              Cliente desde {format(new Date(customer.created_at), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>

        {/* Customer Data */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" style={{ color: primaryColor }} />
              Dados Cadastrais
            </CardTitle>
            {!editingProfile ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingProfile(true)}
                style={{ color: primaryColor }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingProfile(false);
                    setEditedCustomer(customer);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSaveProfile}
                  style={{ color: primaryColor }}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Nome completo</label>
              {editingProfile ? (
                <Input
                  value={editedCustomer.full_name || ''}
                  onChange={(e) => setEditedCustomer({ ...editedCustomer, full_name: e.target.value })}
                  style={{ borderColor: primaryColor }}
                />
              ) : (
                <p className="font-medium">{customer.full_name}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-muted-foreground">E-mail</label>
              <p className="font-medium">{customer.email}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Telefone</label>
              {editingProfile ? (
                <Input
                  value={editedCustomer.phone || ''}
                  onChange={(e) => setEditedCustomer({ ...editedCustomer, phone: e.target.value })}
                  style={{ borderColor: primaryColor }}
                />
              ) : (
                <p className="font-medium">{customer.phone || '-'}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-muted-foreground">CPF</label>
              {editingProfile ? (
                <Input
                  value={editedCustomer.cpf || ''}
                  onChange={(e) => setEditedCustomer({ ...editedCustomer, cpf: e.target.value })}
                  style={{ borderColor: primaryColor }}
                />
              ) : (
                <p className="font-medium">{customer.cpf || '-'}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5" style={{ color: primaryColor }} />
              Endereço Principal
            </CardTitle>
            {address && !editingAddress ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingAddress(true)}
                style={{ color: primaryColor }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : address && editingAddress ? (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingAddress(false);
                    setEditedAddress(address);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSaveAddress}
                  style={{ color: primaryColor }}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {!address ? (
              <p className="text-muted-foreground">Nenhum endereço cadastrado.</p>
            ) : editingAddress ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm text-muted-foreground">Rua</label>
                  <Input
                    value={editedAddress.street || ''}
                    onChange={(e) => setEditedAddress({ ...editedAddress, street: e.target.value })}
                    style={{ borderColor: primaryColor }}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Número</label>
                  <Input
                    value={editedAddress.number || ''}
                    onChange={(e) => setEditedAddress({ ...editedAddress, number: e.target.value })}
                    style={{ borderColor: primaryColor }}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Complemento</label>
                  <Input
                    value={editedAddress.complement || ''}
                    onChange={(e) => setEditedAddress({ ...editedAddress, complement: e.target.value })}
                    style={{ borderColor: primaryColor }}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Bairro</label>
                  <Input
                    value={editedAddress.neighborhood || ''}
                    onChange={(e) => setEditedAddress({ ...editedAddress, neighborhood: e.target.value })}
                    style={{ borderColor: primaryColor }}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Cidade</label>
                  <Input
                    value={editedAddress.city || ''}
                    onChange={(e) => setEditedAddress({ ...editedAddress, city: e.target.value })}
                    style={{ borderColor: primaryColor }}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Estado</label>
                  <Input
                    value={editedAddress.state || ''}
                    onChange={(e) => setEditedAddress({ ...editedAddress, state: e.target.value })}
                    style={{ borderColor: primaryColor }}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">CEP</label>
                  <Input
                    value={editedAddress.cep || ''}
                    onChange={(e) => setEditedAddress({ ...editedAddress, cep: e.target.value })}
                    style={{ borderColor: primaryColor }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <p className="font-medium">{address.street}, {address.number}</p>
                {address.complement && <p className="text-sm text-muted-foreground">{address.complement}</p>}
                <p className="text-sm text-muted-foreground">
                  {address.neighborhood} - {address.city}/{address.state}
                </p>
                <p className="text-sm text-muted-foreground">CEP: {address.cep}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Group */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" style={{ color: primaryColor }} />
              Grupo do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger 
                  className="flex-1"
                  style={{ borderColor: primaryColor }}
                >
                  <SelectValue placeholder="Selecione um grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum grupo</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleChangeGroup}
                disabled={selectedGroupId === currentGroupId}
                className="text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Alterar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Administrative Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5" style={{ color: primaryColor }} />
              Ações Administrativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleResetPassword}
                style={{ borderColor: primaryColor, color: primaryColor }}
                className="hover:bg-opacity-10"
              >
                Redefinir senha
              </Button>
              <Button
                variant="outline"
                onClick={handleAnonymize}
                style={{ borderColor: primaryColor, color: primaryColor }}
                className="hover:bg-opacity-10"
              >
                Anonymizar cliente
              </Button>
              <Button
                variant="outline"
                onClick={handleToggleActive}
                className={isActive 
                  ? "border-red-500 text-red-500 hover:bg-red-50" 
                  : "border-green-500 text-green-500 hover:bg-green-50"
                }
              >
                {isActive ? 'Desativar cliente' : 'Reativar cliente'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CustomerDetail;