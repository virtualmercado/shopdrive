import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";

const Customize = () => {
  const { toast } = useToast();
  const [colors, setColors] = useState({
    primary: "#6a1b9a",
    secondary: "#FB8C00",
    background: "#FFFFFF",
  });

  const handleSave = () => {
    toast({
      title: "Alterações salvas!",
      description: "Sua loja foi atualizada com sucesso",
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        {/* Preview */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Preview da Loja</h2>
          <div 
            className="border-2 rounded-lg p-8 text-center"
            style={{ 
              backgroundColor: colors.background,
              borderColor: colors.primary 
            }}
          >
            <h1 
              className="text-3xl font-bold mb-4"
              style={{ color: colors.primary }}
            >
              Minha Loja Virtual
            </h1>
            <Button 
              style={{ 
                backgroundColor: colors.secondary,
                color: '#FFFFFF'
              }}
            >
              Ver Produtos
            </Button>
          </div>
        </Card>

        {/* Colors */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Cores</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primary">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primary"
                  type="color"
                  value={colors.primary}
                  onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                  className="h-12 w-20"
                />
                <Input
                  type="text"
                  value={colors.primary}
                  onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary">Cor de Destaque</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary"
                  type="color"
                  value={colors.secondary}
                  onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                  className="h-12 w-20"
                />
                <Input
                  type="text"
                  value={colors.secondary}
                  onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="background">Cor de Fundo</Label>
              <div className="flex gap-2">
                <Input
                  id="background"
                  type="color"
                  value={colors.background}
                  onChange={(e) => setColors({ ...colors, background: e.target.value })}
                  className="h-12 w-20"
                />
                <Input
                  type="text"
                  value={colors.background}
                  onChange={(e) => setColors({ ...colors, background: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Logo */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Logo</h2>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Arraste uma imagem ou clique para fazer upload
              </p>
              <Button variant="outline">Escolher Imagem</Button>
            </div>
          </div>
        </Card>

        {/* Typography */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Tipografia</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="font">Fonte Principal</Label>
              <select 
                id="font"
                className="w-full border rounded-md px-3 py-2"
              >
                <option>Inter</option>
                <option>Roboto</option>
                <option>Open Sans</option>
                <option>Poppins</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            className="bg-secondary hover:bg-secondary/90 px-8"
          >
            Salvar Alterações
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Customize;