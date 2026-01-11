import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Loader2, 
  Save, 
  HelpCircle,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQContent {
  title: string;
  subtitle: string;
  items: FAQItem[];
}

interface CMSFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: FAQContent) => Promise<void>;
}

const defaultContent: FAQContent = {
  title: "Dúvidas Frequentes",
  subtitle: "Encontre aqui as respostas para as perguntas mais comuns.",
  items: [],
};

export default function CMSFaqModal({ isOpen, onClose, content, onSave }: CMSFaqModalProps) {
  const [formData, setFormData] = useState<FAQContent>(defaultContent);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (content && content.title) {
      setFormData(content as FAQContent);
    } else {
      setFormData(defaultContent);
    }
  }, [content, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Conteúdo do FAQ atualizado com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar conteúdo.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateItem = (index: number, field: keyof FAQItem, value: string) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { question: "", answer: "" }],
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newItems = [...formData.items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setFormData({ ...formData, items: newItems });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-[#6a1b9a]" />
            CMS – Dúvidas Frequentes
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Gerencie perguntas e respostas exibidas no FAQ da Landing Page.
          </p>
        </DialogHeader>

        <ScrollArea className="h-[60vh] px-6 py-4">
          <div className="space-y-6">
            {/* Global Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campos Globais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Título do FAQ</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Dúvidas Frequentes"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtítulo do FAQ</Label>
                  <Input
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="Encontre aqui as respostas para as perguntas mais comuns."
                  />
                </div>
              </CardContent>
            </Card>

            {/* FAQ Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Perguntas e Respostas</CardTitle>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar nova pergunta
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma pergunta cadastrada.</p>
                    <p className="text-sm">Clique em "Adicionar nova pergunta" para começar.</p>
                  </div>
                ) : (
                  formData.items.map((item, index) => (
                    <div key={index} className="p-4 bg-muted/50 rounded-lg space-y-3 border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">
                            Pergunta {index + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveItem(index, "up")}
                            disabled={index === 0}
                            className="h-8 w-8"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => moveItem(index, "down")}
                            disabled={index === formData.items.length - 1}
                            className="h-8 w-8"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(index)}
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Pergunta</Label>
                        <Input
                          value={item.question}
                          onChange={(e) => updateItem(index, "question", e.target.value)}
                          placeholder="Digite a pergunta..."
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Resposta</Label>
                        <Textarea
                          value={item.answer}
                          onChange={(e) => updateItem(index, "answer", e.target.value)}
                          placeholder="Digite a resposta..."
                          rows={3}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="p-6 pt-4 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#6a1b9a] hover:bg-[#6a1b9a]/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
