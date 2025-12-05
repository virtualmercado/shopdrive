import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { Crown } from "lucide-react";

const Settings = () => {
  const { toast } = useToast();
  const { primaryColor, buttonBgColor, buttonTextColor } = useTheme();

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

  const handleSave = () => {
    toast({
      title: "Configurações salvas!",
      description: "Suas alterações foram aplicadas com sucesso",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Store Info */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Informações da Loja</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Nome da Loja</Label>
              <Input id="storeName" placeholder="Minha Loja Virtual" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeDescription">Descrição</Label>
              <textarea 
                id="storeDescription"
                className="w-full border rounded-md px-3 py-2 min-h-[100px]"
                placeholder="Descreva sua loja..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeUrl">URL da Loja</Label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 border rounded-md bg-muted text-muted-foreground">
                  virtualmercado.com/
                </span>
                <Input id="storeUrl" placeholder="minha-loja" className="flex-1" />
              </div>
            </div>
          </div>
        </Card>

        {/* Personal Info */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Dados Pessoais</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input id="name" placeholder="João Silva" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" placeholder="(00) 00000-0000" />
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
            className="px-8 transition-all hover:opacity-90"
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
          >
            Salvar Alterações
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;