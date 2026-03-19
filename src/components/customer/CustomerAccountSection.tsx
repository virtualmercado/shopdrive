import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Save, X, Plus, Trash2, MapPin, Home } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  home_phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  gender: string | null;
  person_type: string | null;
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
  address_type: string | null;
}

interface CustomerAccountSectionProps {
  storeProfile: any;
  userId: string;
  isTemplateMode?: boolean;
}

const CustomerAccountSection = ({ storeProfile, userId, isTemplateMode = false }: CustomerAccountSectionProps) => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    home_phone: '',
    cpf: '',
    birth_date: '',
    gender: '',
    person_type: 'PF'
  });

  const [addressForm, setAddressForm] = useState({
    recipient_name: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    is_default: false,
    address_type: 'delivery'
  });

  useEffect(() => {
    fetchData();
  }, [userId, isTemplateMode]);

  const fetchData = async () => {
    // In template mode, always use neutral mock data — never fetch real data
    if (isTemplateMode) {
      const mockProfile: CustomerProfile = {
        id: 'mock',
        full_name: '—',
        email: '—',
        phone: null,
        home_phone: null,
        cpf: null,
        birth_date: null,
        gender: null,
        person_type: 'PF',
      };
      setProfile(mockProfile);
      setFormData({
        full_name: '—',
        email: '—',
        phone: '',
        home_phone: '',
        cpf: '',
        birth_date: '',
        gender: '',
        person_type: 'PF'
      });
      setAddresses([]);
      setLoading(false);
      return;
    }

    if (!userId) return;

    const { data: profileData } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData as CustomerProfile);
      setFormData({
        full_name: profileData.full_name || '',
        email: profileData.email || '',
        phone: profileData.phone || '',
        home_phone: (profileData as any).home_phone || '',
        cpf: profileData.cpf || '',
        birth_date: (profileData as any).birth_date || '',
        gender: (profileData as any).gender || '',
        person_type: (profileData as any).person_type || 'PF'
      });
    } else {
      // No profile yet — show empty fields, never fallback to auth user data
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        home_phone: '',
        cpf: '',
        birth_date: '',
        gender: '',
        person_type: 'PF'
      });
    }

    const { data: addressData } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', userId)
      .order('is_default', { ascending: false });

    if (addressData) {
      setAddresses(addressData as CustomerAddress[]);
    }

    setLoading(false);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 14);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
    if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12)}`;
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
  };

  const handleSaveProfile = async () => {
    if (isTemplateMode) return; // Block writes in template mode

    // Use upsert to create profile if it doesn't exist
    const { error } = await supabase
      .from('customer_profiles')
      .upsert({
        id: userId,
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone.replace(/\D/g, '') || null,
        home_phone: formData.home_phone.replace(/\D/g, '') || null,
        cpf: formData.cpf.replace(/\D/g, '') || null,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        person_type: formData.person_type,
        registered_store_id: storeProfile?.id
      }, { onConflict: 'id' });

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Create link in store_customers to make customer visible in merchant dashboard
    if (storeProfile?.id) {
      await supabase
        .from('store_customers')
        .upsert({
          store_owner_id: storeProfile.id,
          customer_id: userId,
          is_active: true,
          origin: 'online_store'
        }, { onConflict: 'store_owner_id,customer_id' });
    }

    toast({
      title: "Dados salvos!",
      description: "Suas informações foram atualizadas.",
    });
    setEditing(false);
    fetchData();
  };

  const handleCepLookup = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setAddressForm(prev => ({
          ...prev,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching CEP:', error);
    }
  };

  const handleSaveAddress = async () => {
    if (isTemplateMode) return; // Block writes in template mode

    // First, ensure customer profile exists before saving address
    const { data: existingProfile } = await supabase
      .from('customer_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('customer_profiles')
        .insert({
          id: userId,
          full_name: formData.full_name || 'Cliente',
          email: formData.email,
          registered_store_id: storeProfile?.id
        });

      if (profileError) {
        toast({ 
          title: "Erro ao criar perfil", 
          description: "Por favor, salve seus dados pessoais primeiro.", 
          variant: "destructive" 
        });
        return;
      }

      if (storeProfile?.id) {
        await supabase
          .from('store_customers')
          .upsert({
            store_owner_id: storeProfile.id,
            customer_id: userId,
            is_active: true,
            origin: 'online_store'
          }, { onConflict: 'store_owner_id,customer_id' });
      }
    }

    const addressData = {
      customer_id: userId,
      recipient_name: addressForm.recipient_name,
      cep: addressForm.cep.replace(/\D/g, ''),
      street: addressForm.street,
      number: addressForm.number,
      complement: addressForm.complement || null,
      neighborhood: addressForm.neighborhood,
      city: addressForm.city,
      state: addressForm.state,
      is_default: addressForm.is_default,
      address_type: addressForm.address_type,
      store_owner_id: storeProfile?.id
    };

    if (editingAddress) {
      const { error } = await supabase
        .from('customer_addresses')
        .update(addressData)
        .eq('id', editingAddress.id);

      if (error) {
        toast({ title: "Erro ao atualizar endereço", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from('customer_addresses')
        .insert(addressData);

      if (error) {
        toast({ title: "Erro ao salvar endereço", description: error.message, variant: "destructive" });
        return;
      }
    }

    if (addressForm.is_default) {
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', userId)
        .neq('id', editingAddress?.id || '');
    }

    toast({ title: "Endereço salvo!", description: "Endereço atualizado com sucesso." });
    setShowAddressModal(false);
    setEditingAddress(null);
    resetAddressForm();
    fetchData();
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (isTemplateMode) return;
    const { error } = await supabase
      .from('customer_addresses')
      .delete()
      .eq('id', addressId);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Endereço excluído" });
      fetchData();
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (isTemplateMode) return;
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', userId);

    await supabase
      .from('customer_addresses')
      .update({ is_default: true })
      .eq('id', addressId);

    toast({ title: "Endereço principal definido" });
    fetchData();
  };

  const openAddressModal = (address?: CustomerAddress) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        recipient_name: address.recipient_name,
        cep: formatCep(address.cep),
        street: address.street,
        number: address.number,
        complement: address.complement || '',
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        is_default: address.is_default,
        address_type: address.address_type || 'delivery'
      });
    } else {
      resetAddressForm();
    }
    setShowAddressModal(true);
  };

  const resetAddressForm = () => {
    setAddressForm({
      recipient_name: '',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      is_default: false,
      address_type: 'delivery'
    });
    setEditingAddress(null);
  };

  const buttonBgColor = storeProfile?.button_bg_color || storeProfile?.primary_color || '#6a1b9a';
  const buttonTextColor = storeProfile?.button_text_color || '#FFFFFF';
  const buttonBorderStyle = storeProfile?.button_border_style === 'straight' ? '0' : '0.5rem';

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando...</div>;
  }

  const primaryAddress = addresses.find(a => a.is_default);
  const otherAddresses = addresses.filter(a => !a.is_default);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Minha Conta</h1>

      {/* Personal Data Section */}
      <section className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Dados Pessoais</h2>
          {!isTemplateMode && !editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="gap-2"
            >
              <Edit2 className="h-4 w-4" />
              Editar
            </Button>
          ) : !isTemplateMode && editing ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditing(false); fetchData(); }}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleSaveProfile}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor, borderRadius: buttonBorderStyle }}
              >
                <Save className="h-4 w-4 mr-1" />
                Salvar
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-sm text-muted-foreground">Nome completo</Label>
            {editing && !isTemplateMode ? (
              <Input 
                value={formData.full_name} 
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                className="mt-1"
              />
            ) : (
              <p className="font-medium">{profile?.full_name || '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">E-mail</Label>
            <p className="font-medium text-muted-foreground">{profile?.email || '—'}</p>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Telefone celular</Label>
            {editing && !isTemplateMode ? (
              <Input 
                value={formData.phone} 
                onChange={(e) => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                placeholder="(00) 00000-0000"
                className="mt-1"
              />
            ) : (
              <p className="font-medium">{profile?.phone ? formatPhone(profile.phone) : '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Telefone fixo</Label>
            {editing && !isTemplateMode ? (
              <Input 
                value={formData.home_phone} 
                onChange={(e) => setFormData(prev => ({ ...prev, home_phone: formatPhone(e.target.value) }))}
                placeholder="(00) 0000-0000"
                className="mt-1"
              />
            ) : (
              <p className="font-medium">{profile?.home_phone ? formatPhone(profile.home_phone) : '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Tipo de pessoa</Label>
            {editing && !isTemplateMode ? (
              <RadioGroup 
                value={formData.person_type} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, person_type: value }))}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PF" id="pf" />
                  <Label htmlFor="pf">Pessoa Física</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PJ" id="pj" />
                  <Label htmlFor="pj">Pessoa Jurídica</Label>
                </div>
              </RadioGroup>
            ) : (
              <p className="font-medium">{profile?.person_type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}</p>
            )}
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">
              {formData.person_type === 'PJ' ? 'CNPJ' : 'CPF'}
            </Label>
            {editing && !isTemplateMode ? (
              <Input 
                value={formData.cpf} 
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  cpf: formData.person_type === 'PJ' ? formatCnpj(e.target.value) : formatCpf(e.target.value) 
                }))}
                placeholder={formData.person_type === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                className="mt-1"
              />
            ) : (
              <p className="font-medium">
                {profile?.cpf 
                  ? (formData.person_type === 'PJ' ? formatCnpj(profile.cpf) : formatCpf(profile.cpf))
                  : '—'
                }
              </p>
            )}
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Data de nascimento</Label>
            {editing && !isTemplateMode ? (
              <Input 
                type="date"
                value={formData.birth_date} 
                onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                className="mt-1"
              />
            ) : (
              <p className="font-medium">
                {profile?.birth_date 
                  ? new Date(profile.birth_date).toLocaleDateString('pt-BR')
                  : '—'
                }
              </p>
            )}
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Gênero</Label>
            {editing && !isTemplateMode ? (
              <RadioGroup 
                value={formData.gender} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="M" id="male" />
                  <Label htmlFor="male">Masculino</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="F" id="female" />
                  <Label htmlFor="female">Feminino</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="O" id="other" />
                  <Label htmlFor="other">Outro</Label>
                </div>
              </RadioGroup>
            ) : (
              <p className="font-medium">
                {profile?.gender === 'M' ? 'Masculino' : 
                 profile?.gender === 'F' ? 'Feminino' : 
                 profile?.gender === 'O' ? 'Outro' : '—'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Addresses Section */}
      <section className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Meus Endereços
          </h2>
          {!isTemplateMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openAddressModal()}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          )}
        </div>

        {addresses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Home className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum endereço cadastrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {primaryAddress && (
              <div className="border-2 rounded-lg p-4" style={{ borderColor: buttonBgColor }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: `${buttonBgColor}15`, color: buttonBgColor }}>
                    Endereço principal
                  </span>
                  {!isTemplateMode && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openAddressModal(primaryAddress)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteAddress(primaryAddress.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="font-medium">{primaryAddress.recipient_name}</p>
                <p className="text-sm text-muted-foreground">
                  {primaryAddress.street}, {primaryAddress.number}
                  {primaryAddress.complement && ` - ${primaryAddress.complement}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {primaryAddress.neighborhood} - {primaryAddress.city}/{primaryAddress.state}
                </p>
                <p className="text-sm text-muted-foreground">CEP: {formatCep(primaryAddress.cep)}</p>
              </div>
            )}

            {otherAddresses.map((address) => (
              <div key={address.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    {address.address_type === 'billing' ? 'Cobrança' : 'Entrega'}
                  </span>
                  {!isTemplateMode && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleSetDefaultAddress(address.id)}>
                        Definir como principal
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openAddressModal(address)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteAddress(address.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="font-medium">{address.recipient_name}</p>
                <p className="text-sm text-muted-foreground">
                  {address.street}, {address.number}
                  {address.complement && ` - ${address.complement}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {address.neighborhood} - {address.city}/{address.state}
                </p>
                <p className="text-sm text-muted-foreground">CEP: {formatCep(address.cep)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Address Modal */}
      {!isTemplateMode && (
        <Dialog open={showAddressModal} onOpenChange={setShowAddressModal}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? 'Editar Endereço' : 'Novo Endereço'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Nome do destinatário</Label>
                <Input 
                  value={addressForm.recipient_name}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, recipient_name: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>CEP</Label>
                <Input 
                  value={addressForm.cep}
                  onChange={(e) => {
                    const formatted = formatCep(e.target.value);
                    setAddressForm(prev => ({ ...prev, cep: formatted }));
                    if (formatted.replace(/\D/g, '').length === 8) {
                      handleCepLookup(formatted);
                    }
                  }}
                  placeholder="00000-000"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Rua</Label>
                <Input 
                  value={addressForm.street}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, street: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Número</Label>
                  <Input 
                    value={addressForm.number}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, number: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input 
                    value={addressForm.complement}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, complement: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Bairro</Label>
                <Input 
                  value={addressForm.neighborhood}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cidade</Label>
                  <Input 
                    value={addressForm.city}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input 
                    value={addressForm.state}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="UF"
                    maxLength={2}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Tipo de endereço</Label>
                <RadioGroup 
                  value={addressForm.address_type}
                  onValueChange={(value) => setAddressForm(prev => ({ ...prev, address_type: value }))}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="delivery" id="delivery" />
                    <Label htmlFor="delivery">Entrega</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="billing" id="billing" />
                    <Label htmlFor="billing">Cobrança</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  checked={addressForm.is_default}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, is_default: e.target.checked }))}
                  className="rounded"
                />
                <Label>Definir como endereço principal</Label>
              </div>

              <Button 
                onClick={handleSaveAddress} 
                className="w-full"
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor, borderRadius: buttonBorderStyle }}
              >
                {editingAddress ? 'Atualizar Endereço' : 'Salvar Endereço'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default CustomerAccountSection;
