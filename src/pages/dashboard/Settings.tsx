import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

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

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, email, phone, whatsapp_number, cpf_cnpj, address, address_zip_code")
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

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Determine which document to save (prioritize CNPJ if both are filled)
      const cpfCnpj = formData.cnpj || formData.cpf || null;
      
      // Normaliza o número de WhatsApp com DDI 55
      const normalizedWhatsapp = normalizeWhatsAppNumber(formData.whatsappNumber);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          whatsapp_number: normalizedWhatsapp,
          cpf_cnpj: cpfCnpj,
          address: formData.address,
          address_zip_code: formData.cep,
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
          <h2 className="text-xl font-bold mb-6">Dados Pessoais</h2>
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

        {/* Plan */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Plano Atual</h2>
          <div className="flex items-center justify-between p-4 rounded-lg mb-4" style={{ backgroundColor: getLighterShade(primaryColor) }}>
            <div className="flex items-center gap-3">
              <div 
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">Plano Grátis</p>
                <p className="text-sm text-muted-foreground">Até 10 produtos</p>
              </div>
            </div>
            <Button 
              className="transition-all hover:opacity-90"
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
            >
              Fazer Upgrade
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Produtos: 5/10</p>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div className="h-2 rounded-full" style={{ width: '50%', backgroundColor: primaryColor }}></div>
            </div>
          </div>
        </Card>

        {/* Password */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Alterar Senha</h2>
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
