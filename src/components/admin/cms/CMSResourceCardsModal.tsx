import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Loader2, Store, Palette, ShoppingCart, BarChart3, Percent, LayoutDashboard, ImagePlus, Tag, Heart, Gift, Truck, Shield, Star, Zap, Clock, Globe } from "lucide-react";
import { toast } from "sonner";

interface Card {
  title: string;
  description: string;
  icon: string;
}

interface CMSResourceCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const iconOptions = [
  { value: "Store", label: "Loja", Icon: Store },
  { value: "Palette", label: "Paleta", Icon: Palette },
  { value: "ShoppingCart", label: "Carrinho", Icon: ShoppingCart },
  { value: "BarChart3", label: "Gráficos", Icon: BarChart3 },
  { value: "Percent", label: "Porcentagem", Icon: Percent },
  { value: "LayoutDashboard", label: "Dashboard", Icon: LayoutDashboard },
  { value: "ImagePlus", label: "Imagem", Icon: ImagePlus },
  { value: "Tag", label: "Tag", Icon: Tag },
  { value: "Heart", label: "Coração", Icon: Heart },
  { value: "Gift", label: "Presente", Icon: Gift },
  { value: "Truck", label: "Entrega", Icon: Truck },
  { value: "Shield", label: "Segurança", Icon: Shield },
  { value: "Star", label: "Estrela", Icon: Star },
  { value: "Zap", label: "Energia", Icon: Zap },
  { value: "Clock", label: "Relógio", Icon: Clock },
  { value: "Globe", label: "Globo", Icon: Globe },
];

const CMSResourceCardsModal = ({ isOpen, onClose, content, onSave }: CMSResourceCardsModalProps) => {
  const defaultCards: Card[] = [
    { title: "Loja Profissional", description: "Crie uma loja virtual com visual profissional em minutos", icon: "Store" },
    { title: "Personalização Total", description: "Customize cores, fontes e layout da sua loja", icon: "Palette" },
    { title: "Carrinho Inteligente", description: "Sistema de carrinho e checkout otimizado para conversão", icon: "ShoppingCart" },
    { title: "Relatórios Completos", description: "Acompanhe vendas e performance em tempo real", icon: "BarChart3" },
    { title: "Sem Taxa de Venda", description: "A plataforma não cobra nenhum valor ou comissão nas suas vendas.", icon: "Percent" },
    { title: "Painel Administrativo", description: "Controle total sobre estoque, clientes, pedidos e envios.", icon: "LayoutDashboard" },
    { title: "Editor de Imagens", description: "Edite de forma profissional as imagens e o cadastro dos seus produtos.", icon: "ImagePlus" },
    { title: "Criador de Cupons", description: "Gere cupons de desconto e aumente o número de vendas e clientes.", icon: "Tag" },
  ];

  const [cards, setCards] = useState<Card[]>(defaultCards);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (content?.cards) {
      setCards(content.cards);
    }
  }, [content]);

  const handleCardChange = (index: number, field: keyof Card, value: string) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], [field]: value };
    setCards(newCards);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ cards });
      toast.success("Cards de recursos atualizados com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#6a1b9a]">CMS – Cards de Recursos</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {cards.map((card, index) => (
            <div key={index} className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-[#6a1b9a]/10 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-[#6a1b9a]">{index + 1}</span>
                </div>
                <span className="font-medium">Card {index + 1}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={card.title}
                    onChange={(e) => handleCardChange(index, "title", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Ícone</Label>
                  <Select
                    value={card.icon}
                    onValueChange={(value) => handleCardChange(index, "icon", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.Icon className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-1">
                  <Label>Descrição</Label>
                  <Textarea
                    value={card.description}
                    onChange={(e) => handleCardChange(index, "description", e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-[#FB8C00] hover:bg-[#FB8C00]/90"
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CMSResourceCardsModal;
