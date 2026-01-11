import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CMSProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const CMSProductsModal = ({ isOpen, onClose, content, onSave }: CMSProductsModalProps) => {
  const [formData, setFormData] = useState({
    title: "Seus produtos disponíveis em todos os lugares",
    description: "Adicione o link da sua loja em todas as suas redes sociais, e envie para seus clientes a qualquer hora em qualquer lugar.",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title || formData.title,
        description: content.description || formData.description,
      });
    }
  }, [content]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Bloco de produtos atualizado com sucesso!");
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
          <DialogTitle className="text-[#6a1b9a]">CMS – Bloco Seus Produtos</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>Título do bloco</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Texto descritivo</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
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

export default CMSProductsModal;
