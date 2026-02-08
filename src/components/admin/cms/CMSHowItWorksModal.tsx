import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Step {
  step: string;
  title: string;
  description: string;
}

interface CMSHowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const CMSHowItWorksModal = ({ isOpen, onClose, content, onSave }: CMSHowItWorksModalProps) => {
  const [formData, setFormData] = useState({
    title: "Como funciona",
    subtitle: "3 passos simples para começar a vender",
    steps: [
      { step: "1", title: "Cadastre-se", description: "Crie sua conta gratuitamente em menos de 1 minuto" },
      { step: "2", title: "Configure sua loja", description: "Adicione produtos, personalize cores e layout" },
      { step: "3", title: "Comece a vender", description: "Compartilhe sua loja e seu catálogo PDF e receba pedidos online" },
    ] as Step[],
    cta_button: "Criar Loja Agora",
    cta_text: "Junte-se a milhares de lojistas que já vendem com a ShopDrive",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title || formData.title,
        subtitle: content.subtitle || formData.subtitle,
        steps: content.steps || formData.steps,
        cta_button: content.cta_button || formData.cta_button,
        cta_text: content.cta_text || formData.cta_text,
      });
    }
  }, [content]);

  const handleStepChange = (index: number, field: keyof Step, value: string) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData({ ...formData, steps: newSteps });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Como Funciona atualizado com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#6a1b9a]">CMS – Como Funciona</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Título do bloco</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Input
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-4">Passos</h4>
            <div className="space-y-4">
              {formData.steps.map((step, index) => (
                <div key={index} className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-[#6a1b9a]/10 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-[#6a1b9a]">{step.step}</span>
                    </div>
                    <span className="font-medium">Passo {step.step}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Número</Label>
                      <Input
                        value={step.step}
                        onChange={(e) => handleStepChange(index, "step", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Título</Label>
                      <Input
                        value={step.title}
                        onChange={(e) => handleStepChange(index, "title", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        value={step.description}
                        onChange={(e) => handleStepChange(index, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-4">Call to Action</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Texto do botão CTA</Label>
                <Input
                  value={formData.cta_button}
                  onChange={(e) => setFormData({ ...formData, cta_button: e.target.value })}
                />
              </div>
              <div>
                <Label>Texto abaixo do botão</Label>
                <Input
                  value={formData.cta_text}
                  onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                />
              </div>
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

export default CMSHowItWorksModal;
