import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Building2 } from "lucide-react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Skeleton } from "@/components/ui/skeleton";

const PlatformDataTab = () => {
  const { settings, loading, saving, saveAllSettings } = usePlatformSettings();
  const [formData, setFormData] = useState(settings);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await saveAllSettings(formData);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-[#6a1b9a]" />
          <div>
            <CardTitle>Dados da Plataforma</CardTitle>
            <CardDescription>
              Informações institucionais da VirtualMercado
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="platform_name">Nome da Plataforma</Label>
            <Input
              id="platform_name"
              value={formData.platform_name}
              onChange={(e) => handleChange("platform_name", e.target.value)}
              placeholder="VirtualMercado"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_name">Razão Social</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => handleChange("company_name", e.target.value)}
              placeholder="Razão Social Ltda"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={formData.cnpj}
              onChange={(e) => handleChange("cnpj", e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state_registration">Inscrição Estadual</Label>
            <Input
              id="state_registration"
              value={formData.state_registration}
              onChange={(e) => handleChange("state_registration", e.target.value)}
              placeholder="Inscrição Estadual"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="full_address">Endereço Completo</Label>
          <Input
            id="full_address"
            value={formData.full_address}
            onChange={(e) => handleChange("full_address", e.target.value)}
            placeholder="Rua, Número, Bairro"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="zip_code">CEP</Label>
            <Input
              id="zip_code"
              value={formData.zip_code}
              onChange={(e) => handleChange("zip_code", e.target.value)}
              placeholder="00000-000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleChange("city", e.target.value)}
              placeholder="Cidade"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => handleChange("state", e.target.value)}
              placeholder="UF"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="institutional_email">E-mail Institucional</Label>
            <Input
              id="institutional_email"
              type="email"
              value={formData.institutional_email}
              onChange={(e) => handleChange("institutional_email", e.target.value)}
              placeholder="contato@virtualmercado.com.br"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="institutional_phone">Telefone Institucional</Label>
            <Input
              id="institutional_phone"
              value={formData.institutional_phone}
              onChange={(e) => handleChange("institutional_phone", e.target.value)}
              placeholder="(00) 0000-0000"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#6a1b9a] hover:bg-[#5a1589]"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlatformDataTab;
