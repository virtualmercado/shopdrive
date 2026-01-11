import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Testimonial {
  name: string;
  role: string;
  text: string;
}

interface CMSTestimonialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const CMSTestimonialsModal = ({ isOpen, onClose, content, onSave }: CMSTestimonialsModalProps) => {
  const [formData, setFormData] = useState({
    title: "Quem usa, aprova!",
    subtitle: "Histórias reais de quem transformou e melhorou o jeito de vender.",
    items: [
      { name: "Juliana S.", role: "Dona da @doceju", text: "Em menos de um dia, minha loja estava no ar! A plataforma é super intuitiva e o suporte é nota 10." },
      { name: "Marcos P.", role: "Artesão na @arteemmadeira", text: "Consegui organizar meus produtos e agora vendo para todo o Brasil. O editor de fotos me ajudou a deixar tudo mais profissional." },
      { name: "Carla F.", role: "Consultora de Beleza", text: "Meus clientes amaram a facilidade de comprar pelo site. A integração com o WhatsApp é perfeita para fechar vendas." },
    ] as Testimonial[],
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title || formData.title,
        subtitle: content.subtitle || formData.subtitle,
        items: content.items || formData.items,
      });
    }
  }, [content]);

  const handleTestimonialChange = (index: number, field: keyof Testimonial, value: string) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Depoimentos atualizados com sucesso!");
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
          <DialogTitle className="text-[#6a1b9a]">CMS – Prova Social (Depoimentos)</DialogTitle>
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
              <Label>Subtítulo do bloco</Label>
              <Input
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-4">Depoimentos</h4>
            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={index} className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-[#6a1b9a]/10 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-[#6a1b9a]">{index + 1}</span>
                    </div>
                    <span className="font-medium">Depoimento {index + 1}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nome</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => handleTestimonialChange(index, "name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Cargo / Descrição</Label>
                      <Input
                        value={item.role}
                        onChange={(e) => handleTestimonialChange(index, "role", e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Texto do depoimento</Label>
                      <Textarea
                        value={item.text}
                        onChange={(e) => handleTestimonialChange(index, "text", e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
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

export default CMSTestimonialsModal;
