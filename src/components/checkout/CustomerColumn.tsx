import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, MapPin, Edit, LogIn, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
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

interface CustomerColumnProps {
  isLoggedIn: boolean;
  customerProfile: CustomerProfile | null;
  customerAddresses: CustomerAddress[];
  selectedAddressId: string | null;
  onSelectAddress: (id: string | null) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (data: RegisterData) => Promise<void>;
  onAddAddress: (address: Omit<CustomerAddress, "id" | "is_default">) => Promise<void>;
  onDeleteAddress?: (addressId: string) => Promise<void>;
  formData: {
    customer_name: string;
    customer_phone: string;
    cep: string;
    address: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  setFormData: (data: any) => void;
  primaryColor: string;
  storeSlug: string;
}

interface RegisterData {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  birth_date?: string;
  person_type?: string;
  gender?: string;
  cpf?: string;
  // Address fields
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export const CustomerColumn = ({
  isLoggedIn,
  customerProfile,
  customerAddresses,
  selectedAddressId,
  onSelectAddress,
  onLogin,
  onRegister,
  onAddAddress,
  onDeleteAddress,
  formData,
  setFormData,
  primaryColor,
  storeSlug,
}: CustomerColumnProps) => {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [registerData, setRegisterData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    birth_date: "",
    person_type: "fisica",
    gender: "",
    cpf: "",
    // Address fields
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });
  const [registerLoading, setRegisterLoading] = useState(false);

  const formatCpfCnpj = (value: string, type: string) => {
    const numbers = value.replace(/\D/g, "");
    if (type === "fisica") {
      // CPF format: 000.000.000-00
      return numbers
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // CNPJ format: 00.000.000/0000-00
      return numbers
        .slice(0, 14)
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
  };

  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);

  const [newAddress, setNewAddress] = useState({
    recipient_name: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });
  const [addressLoading, setAddressLoading] = useState(false);

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      toast.error("Preencha e-mail e senha");
      return;
    }
    setLoginLoading(true);
    try {
      await onLogin(loginEmail, loginPassword);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerData.full_name || !registerData.email || !registerData.password) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setRegisterLoading(true);
    try {
      await onRegister(registerData);
      setShowRegisterForm(false);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.cep || !newAddress.street || !newAddress.number || 
        !newAddress.neighborhood || !newAddress.city || !newAddress.state) {
      toast.error("Preencha todos os campos do endereço");
      return;
    }
    setAddressLoading(true);
    try {
      await onAddAddress(newAddress);
      setShowNewAddressForm(false);
      setNewAddress({
        recipient_name: "",
        cep: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
      });
    } finally {
      setAddressLoading(false);
    }
  };

  const fetchAddressFromCep = async (cep: string, forRegister = false) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          if (forRegister) {
            setRegisterData(prev => ({
              ...prev,
              street: data.logradouro || "",
              neighborhood: data.bairro || "",
              city: data.localidade || "",
              state: data.uf || "",
            }));
          } else {
            setNewAddress(prev => ({
              ...prev,
              street: data.logradouro || "",
              neighborhood: data.bairro || "",
              city: data.localidade || "",
              state: data.uf || "",
            }));
          }
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      }
    }
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 8);
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
  };

  const handleDeleteAddress = async (addressId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the address when clicking delete
    if (!onDeleteAddress) return;
    
    setDeletingAddressId(addressId);
    try {
      await onDeleteAddress(addressId);
      // If the deleted address was selected, clear the selection
      if (selectedAddressId === addressId) {
        onSelectAddress(null);
      }
    } finally {
      setDeletingAddressId(null);
    }
  };

  // Logged in user view
  if (isLoggedIn && customerProfile) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        {/* Customer Info */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <User className="h-5 w-5" style={{ color: primaryColor }} />
            Dados cadastrais
          </h3>
          <div className="bg-muted/50 rounded-lg p-4 space-y-1">
            <p className="font-medium">{customerProfile.full_name}</p>
            <p className="text-sm text-muted-foreground">{customerProfile.email}</p>
            {customerProfile.phone && (
              <p className="text-sm text-muted-foreground">{customerProfile.phone}</p>
            )}
          </div>
          <Button
            variant="link"
            size="sm"
            className="mt-2 p-0"
            style={{ color: primaryColor }}
            onClick={() => window.open(`/loja/${storeSlug}/conta`, "_blank")}
          >
            <Edit className="h-3 w-3 mr-1" />
            Editar dados
          </Button>
        </div>

        {/* Addresses */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5" style={{ color: primaryColor }} />
            Meus endereços
          </h3>
          
          {customerAddresses.length > 0 ? (
            <div className="space-y-2">
              {customerAddresses.map((address) => (
                <div
                  key={address.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-all relative ${
                    selectedAddressId === address.id 
                      ? "border-2" 
                      : "border-border hover:border-muted-foreground"
                  }`}
                  style={selectedAddressId === address.id ? { borderColor: primaryColor } : {}}
                  onClick={() => onSelectAddress(address.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{address.recipient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {address.street}, {address.number}
                        {address.complement && ` - ${address.complement}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {address.neighborhood}, {address.city} - {address.state}
                      </p>
                      <p className="text-xs text-muted-foreground">CEP: {address.cep}</p>
                    </div>
                    {/* Only show delete button for non-default addresses when there are multiple addresses */}
                    {!address.is_default && customerAddresses.length > 1 && onDeleteAddress && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={(e) => handleDeleteAddress(address.id, e)}
                        disabled={deletingAddressId === address.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado</p>
          )}

          {/* Toggle for new address */}
          <div className="flex items-center gap-2 mt-4">
            <Switch
              checked={showNewAddressForm}
              onCheckedChange={setShowNewAddressForm}
              style={{ 
                backgroundColor: showNewAddressForm ? primaryColor : undefined 
              }}
            />
            <Label className="text-sm">Cadastrar novo endereço</Label>
          </div>

          {/* New Address Form */}
          {showNewAddressForm && (
            <div className="mt-4 p-4 border rounded-lg space-y-3">
              <div>
                <Label className="text-xs">Nome do destinatário</Label>
                <Input
                  placeholder="Nome completo"
                  value={newAddress.recipient_name}
                  onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">CEP</Label>
                <Input
                  placeholder="00000-000"
                  value={newAddress.cep}
                  onChange={(e) => {
                    setNewAddress({ ...newAddress, cep: e.target.value });
                    fetchAddressFromCep(e.target.value);
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Rua</Label>
                  <Input
                    placeholder="Rua"
                    value={newAddress.street}
                    onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Número</Label>
                  <Input
                    placeholder="Nº"
                    value={newAddress.number}
                    onChange={(e) => setNewAddress({ ...newAddress, number: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Complemento</Label>
                <Input
                  placeholder="Apto, Bloco..."
                  value={newAddress.complement}
                  onChange={(e) => setNewAddress({ ...newAddress, complement: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Bairro</Label>
                <Input
                  placeholder="Bairro"
                  value={newAddress.neighborhood}
                  onChange={(e) => setNewAddress({ ...newAddress, neighborhood: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input
                    placeholder="Cidade"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Estado</Label>
                  <Input
                    placeholder="UF"
                    maxLength={2}
                    value={newAddress.state}
                    onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
              <Button
                type="button"
                className="w-full"
                style={{ backgroundColor: primaryColor }}
                disabled={addressLoading}
                onClick={handleAddAddress}
              >
                {addressLoading ? "Salvando..." : "Salvar endereço"}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Not logged in view
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <User className="h-5 w-5" style={{ color: primaryColor }} />
        Dados do Cliente
      </h3>

      {!showRegisterForm ? (
        <>
          {/* Login Form */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm">E-mail</Label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm">Senha</Label>
              <Input
                type="password"
                placeholder="Sua senha"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                style={{ backgroundColor: primaryColor }}
                disabled={loginLoading}
                onClick={handleLogin}
              >
                <LogIn className="h-4 w-4 mr-2" />
                {loginLoading ? "Entrando..." : "Entrar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                style={{ borderColor: primaryColor, color: primaryColor }}
                onClick={() => setShowRegisterForm(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Quero me cadastrar
              </Button>
            </div>
          </div>

          {/* Guest Form - for users who don't want to login */}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Ou continue sem cadastro:
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Nome completo *</Label>
                <Input
                  placeholder="Seu nome completo"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">Telefone/WhatsApp *</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Register Form */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Nome completo *</Label>
              <Input
                placeholder="Seu nome completo"
                value={registerData.full_name}
                onChange={(e) => setRegisterData({ ...registerData, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">E-mail *</Label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">Senha *</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">Telefone/WhatsApp</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={registerData.phone}
                onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
              />
            </div>
            
            {/* New fields for dashboard analytics */}
            <div>
              <Label className="text-sm">Data de Nascimento</Label>
              <Input
                type="date"
                value={registerData.birth_date}
                onChange={(e) => setRegisterData({ ...registerData, birth_date: e.target.value })}
              />
            </div>
            
            <div>
              <Label className="text-sm">Tipo de Cadastro</Label>
              <Select
                value={registerData.person_type}
                onValueChange={(value) => setRegisterData({ ...registerData, person_type: value, cpf: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fisica">Pessoa Física</SelectItem>
                  <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">Sexo</Label>
              <Select
                value={registerData.gender}
                onValueChange={(value) => setRegisterData({ ...registerData, gender: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm">
                {registerData.person_type === "juridica" ? "CNPJ" : "CPF"}
              </Label>
              <Input
                placeholder={registerData.person_type === "juridica" ? "00.000.000/0000-00" : "000.000.000-00"}
                value={registerData.cpf}
                onChange={(e) => setRegisterData({ 
                  ...registerData, 
                  cpf: formatCpfCnpj(e.target.value, registerData.person_type) 
                })}
              />
            </div>

            {/* Address Section */}
            <div className="border-t pt-4 mt-2">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: primaryColor }} />
                Endereço Principal
              </h4>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">CEP</Label>
                  <Input
                    placeholder="00000-000"
                    value={registerData.cep}
                    onChange={(e) => {
                      const formattedCep = formatCep(e.target.value);
                      setRegisterData({ ...registerData, cep: formattedCep });
                      fetchAddressFromCep(e.target.value, true);
                    }}
                  />
                </div>

                <div>
                  <Label className="text-sm">Endereço</Label>
                  <Input
                    placeholder="Rua, Avenida..."
                    value={registerData.street}
                    onChange={(e) => setRegisterData({ ...registerData, street: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-sm">Número</Label>
                    <Input
                      placeholder="Nº"
                      value={registerData.number}
                      onChange={(e) => setRegisterData({ ...registerData, number: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm">Complemento</Label>
                    <Input
                      placeholder="Apto, Bloco..."
                      value={registerData.complement}
                      onChange={(e) => setRegisterData({ ...registerData, complement: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm">Bairro</Label>
                  <Input
                    placeholder="Bairro"
                    value={registerData.neighborhood}
                    onChange={(e) => setRegisterData({ ...registerData, neighborhood: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-sm">Cidade</Label>
                    <Input
                      placeholder="Cidade"
                      value={registerData.city}
                      onChange={(e) => setRegisterData({ ...registerData, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Estado</Label>
                    <Input
                      placeholder="UF"
                      maxLength={2}
                      value={registerData.state}
                      onChange={(e) => setRegisterData({ ...registerData, state: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowRegisterForm(false)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="flex-1"
                style={{ backgroundColor: primaryColor }}
                disabled={registerLoading}
                onClick={handleRegister}
              >
                {registerLoading ? "Cadastrando..." : "Criar conta"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
