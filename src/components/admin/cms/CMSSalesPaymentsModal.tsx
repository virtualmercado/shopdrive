import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CMSSalesPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const CMSSalesPaymentsModal = ({ isOpen, onClose, content, onSave }: CMSSalesPaymentsModalProps) => {
  const [formData, setFormData] = useState({
    title: "Venda através do WhatsApp ou aceite pagamentos no site.",
    highlight: "LUCRO 24h por dia.",
    description: "Receba pagamentos no cartão de crédito, débito ou via PIX de forma automática e segura, direto na sua conta.",
    benefits: [
      "Gerador de catálogo de produtos em PDF.",
      "Confirmação e lista do pedido diretamente no seu WhatsApp.",
      "Transparência, organização e segurança nas suas vendas."
    ],
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title || formData.title,
        highlight: content.highlight || formData.highlight,
        description: content.description || formData.description,
        benefits: content.benefits || formData.benefits,
      });
    }
  }, [content]);

  const handleBenefitChange = (index: number, value: string) => {
    const newBenefits = [...formData.benefits];
    newBenefits[index] = value;
    setFormData({ ...formData, benefits: newBenefits });
  };

  const addBenefit = () => {
    setFormData({ ...formData, benefits: [...formData.benefits, ""] });
  };

  const removeBenefit = (index: number) => {
    const newBenefits = formData.benefits.filter((_, i) => i !== index);
    setFormData({ ...formData, benefits: newBenefits });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Bloco de vendas atualizado com sucesso!");
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
          <DialogTitle className="text-[#6a1b9a]">CMS – Bloco Vendas e Pagamentos</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>Título principal</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Subtítulo (destaque)</Label>
            <Input
              value={formData.highlight}
              onChange={(e) => setFormData({ ...formData, highlight: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Texto descritivo</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Benefícios (lista)</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={addBenefit}
                className="text-[#6a1b9a]"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {formData.benefits.map((benefit, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={benefit}
                    onChange={(e) => handleBenefitChange(index, e.target.value)}
                    placeholder={`Benefício ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeBenefit(index)}
                    className="shrink-0 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
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

export default CMSSalesPaymentsModal;
