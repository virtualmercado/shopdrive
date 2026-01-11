import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CMSHeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const CMSHeaderModal = ({ isOpen, onClose, content, onSave }: CMSHeaderModalProps) => {
  const [formData, setFormData] = useState({
    menu_benefits: "Benefícios",
    menu_plans: "Planos",
    menu_how_it_works: "Como Funciona",
    button_login: "Entrar",
    button_cta: "Criar Loja Grátis",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (content) {
      setFormData({
        menu_benefits: content.menu_benefits || "Benefícios",
        menu_plans: content.menu_plans || "Planos",
        menu_how_it_works: content.menu_how_it_works || "Como Funciona",
        button_login: content.button_login || "Entrar",
        button_cta: content.button_cta || "Criar Loja Grátis",
      });
    }
  }, [content]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Header atualizado com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#6a1b9a]">CMS – Header da Landing Page</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>Texto do menu "Benefícios"</Label>
            <Input
              value={formData.menu_benefits}
              onChange={(e) => setFormData({ ...formData, menu_benefits: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Texto do menu "Planos"</Label>
            <Input
              value={formData.menu_plans}
              onChange={(e) => setFormData({ ...formData, menu_plans: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Texto do menu "Como Funciona"</Label>
            <Input
              value={formData.menu_how_it_works}
              onChange={(e) => setFormData({ ...formData, menu_how_it_works: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Texto do botão "Entrar"</Label>
            <Input
              value={formData.button_login}
              onChange={(e) => setFormData({ ...formData, button_login: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Texto do botão CTA principal</Label>
            <Input
              value={formData.button_cta}
              onChange={(e) => setFormData({ ...formData, button_cta: e.target.value })}
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

export default CMSHeaderModal;
