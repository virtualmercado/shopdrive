import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CMSHeroModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const CMSHeroModal = ({ isOpen, onClose, content, onSave }: CMSHeroModalProps) => {
  const [formData, setFormData] = useState({
    badge: "🇧🇷 Plataforma 100% Nacional",
    title: "Crie sua loja virtual e seu catálogo digital em menos de 01 minuto. É GRÁTIS, FÁCIL e 100% online!",
    subtitle: "Plataforma simples e moderna, venda 24h por dia o ano inteiro direto do celular. Comece gratuitamente hoje mesmo.",
    button_primary: "Criar Minha Loja Grátis",
    button_secondary: "Ver Demonstração",
    info_text: "Grátis para sempre, sem taxas ou cartão de crédito",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (content) {
      setFormData({
        badge: content.badge || formData.badge,
        title: content.title || formData.title,
        subtitle: content.subtitle || formData.subtitle,
        button_primary: content.button_primary || formData.button_primary,
        button_secondary: content.button_secondary || formData.button_secondary,
        info_text: content.info_text || formData.info_text,
      });
    }
  }, [content]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Hero atualizado com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#6a1b9a]">CMS – Hero da Landing Page</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>Selo acima do título</Label>
            <Input
              value={formData.badge}
              onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
              placeholder="Ex: 🇧🇷 Plataforma 100% Nacional"
            />
          </div>
          
          <div>
            <Label>Título principal (headline)</Label>
            <Textarea
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              rows={3}
            />
          </div>
          
          <div>
            <Label>Subtítulo do hero</Label>
            <Textarea
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              rows={2}
            />
          </div>
          
          <div>
            <Label>Texto do botão principal</Label>
            <Input
              value={formData.button_primary}
              onChange={(e) => setFormData({ ...formData, button_primary: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Texto do botão secundário</Label>
            <Input
              value={formData.button_secondary}
              onChange={(e) => setFormData({ ...formData, button_secondary: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Texto informativo abaixo dos botões</Label>
            <Input
              value={formData.info_text}
              onChange={(e) => setFormData({ ...formData, info_text: e.target.value })}
            />
          </div>
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

export default CMSHeroModal;
