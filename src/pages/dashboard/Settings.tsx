import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { User, ShoppingBag, Lock } from "lucide-react";

const Settings = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { primaryColor, buttonBgColor, buttonTextColor } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    whatsappNumber: "",
    cnpj: "",
    cpf: "",
    address: "",
    cep: "",
  });
  
  const [orderConfig, setOrderConfig] = useState({
    minimumOrderValue: 0,
    requireAddress: true,
    requirePersonalInfo: true,
    requireEmail: true,
    requirePaymentMethod: true,
    requireCpf: false,
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, email, phone, whatsapp_number, cpf_cnpj, address, address_zip_code, minimum_order_value, checkout_require_address, checkout_require_personal_info, checkout_require_email, checkout_require_payment_method, checkout_require_cpf")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          // Parse cpf_cnpj - check if it's CNPJ (14 digits) or CPF (11 digits)
          const cpfCnpj = data.cpf_cnpj || "";
          const cleanCpfCnpj = cpfCnpj.replace(/\D/g, "");
          const isCnpj = cleanCpfCnpj.length === 14;
          
          setFormData({
            fullName: data.full_name || "",
            email: data.email || "",
            phone: data.phone || "",
            whatsappNumber: data.whatsapp_number || "",
            cnpj: isCnpj ? cpfCnpj : "",
            cpf: !isCnpj && cleanCpfCnpj.length > 0 ? cpfCnpj : "",
            address: data.address || "",
            cep: data.address_zip_code || "",
          });
          
          setOrderConfig({
            minimumOrderValue: data.minimum_order_value || 0,
            requireAddress: data.checkout_require_address ?? true,
            requirePersonalInfo: data.checkout_require_personal_info ?? true,
            requireEmail: data.checkout_require_email ?? true,
            requirePaymentMethod: data.checkout_require_payment_method ?? true,
            requireCpf: data.checkout_require_cpf ?? false,
          });
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const formatCNPJ = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 14);
    return cleaned
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    return cleaned
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1-$2");
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 10) {
      return cleaned
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return cleaned
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  };

  const formatCEP = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 8);
    return cleaned.replace(/(\d{5})(\d)/, "$1-$2");
  };

  const handleInputChange = (field: string, value: string) => {
    let formattedValue = value;
    
    switch (field) {
      case "cnpj":
        formattedValue = formatCNPJ(value);
        break;
      case "cpf":
        formattedValue = formatCPF(value);
        break;
      case "phone":
      case "whatsappNumber":
        formattedValue = formatPhone(value);
        break;
      case "cep":
        formattedValue = formatCEP(value);
        break;
    }
    
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Determine which document to save (prioritize CNPJ if both are filled)
      const cpfCnpj = formData.cnpj || formData.cpf || null;
      
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          whatsapp_number: formData.whatsappNumber,
          cpf_cnpj: cpfCnpj,
          address: formData.address,
          address_zip_code: formData.cep,
          minimum_order_value: orderConfig.minimumOrderValue,
          checkout_require_address: orderConfig.requireAddress,
          checkout_require_personal_info: orderConfig.requirePersonalInfo,
          checkout_require_email: orderConfig.requireEmail,
          checkout_require_payment_method: orderConfig.requirePaymentMethod,
          checkout_require_cpf: orderConfig.requireCpf,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Configurações salvas!",
        description: "Suas alterações foram aplicadas com sucesso",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar suas alterações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <p>Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Personal Info */}
        <Card className="p-6">
          <div className="space-y-1 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
                <User className="h-4 w-4 text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Dados Pessoais</h2>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input 
                id="name" 
                placeholder="João Silva" 
                value={formData.fullName}
                onChange={(e) => handleInputChange("fullName", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu@email.com" 
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input 
                  id="phone" 
                  placeholder="(00) 00000-0000" 
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input 
                  id="whatsapp" 
                  placeholder="(00) 00000-0000" 
                  value={formData.whatsappNumber}
                  onChange={(e) => handleInputChange("whatsappNumber", e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input 
                  id="cnpj" 
                  placeholder="00.000.000/0000-00" 
                  value={formData.cnpj}
                  onChange={(e) => handleInputChange("cnpj", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input 
                  id="cpf" 
                  placeholder="000.000.000-00" 
                  value={formData.cpf}
                  onChange={(e) => handleInputChange("cpf", e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Endereço Completo</Label>
              <Input 
                id="address" 
                placeholder="Rua, número, complemento, bairro, cidade - estado" 
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input 
                  id="cep" 
                  placeholder="00000-000" 
                  value={formData.cep}
                  onChange={(e) => handleInputChange("cep", e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Order Configuration */}
        <Card className="p-6">
          <div className="space-y-1 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
                <ShoppingBag className="h-4 w-4 text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Configuração do pedido</h2>
            </div>
          </div>
          
          {/* Minimum Order Section */}
          <div className="mb-8">
            <h3 className="text-base font-semibold mb-1" style={{ color: primaryColor }}>Pedido mínimo</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Digite abaixo o valor mínimo aceito em um pedido
            </p>
            <div className="flex items-center gap-2 max-w-xs">
              <span 
                className="px-3 py-2 rounded-l-md text-sm font-medium"
                style={{ backgroundColor: primaryColor, color: '#fff' }}
              >
                R$
              </span>
              <Input 
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={orderConfig.minimumOrderValue || ""}
                onChange={(e) => setOrderConfig(prev => ({ 
                  ...prev, 
                  minimumOrderValue: parseFloat(e.target.value) || 0 
                }))}
                className="rounded-l-none"
              />
            </div>
          </div>
          
          {/* Checkout Required Fields Section */}
          <div>
            <h3 className="text-base font-semibold mb-1" style={{ color: primaryColor }}>
              Informações solicitadas na finalização do pedido
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecione as informações que devem ser solicitadas ao seu cliente na tela de "finalizar pedido"
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Endereço de entrega</span>
                <Switch 
                  checked={orderConfig.requireAddress}
                  onCheckedChange={(checked) => setOrderConfig(prev => ({ ...prev, requireAddress: checked }))}
                  style={{ 
                    backgroundColor: orderConfig.requireAddress ? primaryColor : undefined 
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Informações pessoais</span>
                <Switch 
                  checked={orderConfig.requirePersonalInfo}
                  onCheckedChange={(checked) => setOrderConfig(prev => ({ ...prev, requirePersonalInfo: checked }))}
                  style={{ 
                    backgroundColor: orderConfig.requirePersonalInfo ? primaryColor : undefined 
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Email</span>
                <Switch 
                  checked={orderConfig.requireEmail}
                  onCheckedChange={(checked) => setOrderConfig(prev => ({ ...prev, requireEmail: checked }))}
                  style={{ 
                    backgroundColor: orderConfig.requireEmail ? primaryColor : undefined 
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm">Forma de pagamento</span>
                <Switch 
                  checked={orderConfig.requirePaymentMethod}
                  onCheckedChange={(checked) => setOrderConfig(prev => ({ ...prev, requirePaymentMethod: checked }))}
                  style={{ 
                    backgroundColor: orderConfig.requirePaymentMethod ? primaryColor : undefined 
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">CPF</span>
                <Switch 
                  checked={orderConfig.requireCpf}
                  onCheckedChange={(checked) => setOrderConfig(prev => ({ ...prev, requireCpf: checked }))}
                  style={{ 
                    backgroundColor: orderConfig.requireCpf ? primaryColor : undefined 
                  }}
                />
              </div>
            </div>
          </div>
        </Card>


        {/* Password */}
        <Card className="p-6">
          <div className="space-y-1 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
                <Lock className="h-4 w-4 text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Alterar Senha</h2>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <Input id="currentPassword" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input id="newPassword" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input id="confirmPassword" type="password" />
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="px-8 transition-all hover:opacity-90"
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
          >
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
