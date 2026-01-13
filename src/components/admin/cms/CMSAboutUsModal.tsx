import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Image as ImageIcon, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import MediaSelectorModal from "@/components/admin/MediaSelectorModal";

interface AboutUsContent {
  title: string;
  content: string;
  image_url: string;
  image_alt: string;
  is_active: boolean;
  display_order: number;
}

interface CMSAboutUsModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const defaultContent: AboutUsContent = {
  title: "Sobre Nós",
  content: "Informações sobre a VirtualMercado...",
  image_url: "",
  image_alt: "Sobre a VirtualMercado",
  is_active: true,
  display_order: 1,
};

const CMSAboutUsModal = ({ isOpen, onClose, content, onSave }: CMSAboutUsModalProps) => {
  const [formData, setFormData] = useState<AboutUsContent>(defaultContent);
  const [isSaving, setIsSaving] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !hasLoaded && content) {
      setFormData({
        title: content.title || defaultContent.title,
        content: content.content || defaultContent.content,
        image_url: content.image_url || "",
        image_alt: content.image_alt || defaultContent.image_alt,
        is_active: content.is_active ?? true,
        display_order: content.display_order || 1,
      });
      setHasLoaded(true);
    }
    
    if (!isOpen) {
      setHasLoaded(false);
    }
  }, [isOpen, content, hasLoaded]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Página 'Sobre Nós' atualizada com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar conteúdo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectImage = (file: { id: string; url: string }) => {
    setFormData(prev => ({ ...prev, image_url: file.url }));
    setMediaOpen(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#6a1b9a]" />
              Página Institucional: Sobre Nós
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Gerencie o conteúdo da página "Sobre Nós" exibida na Landing Page.
            </p>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-4 max-h-[calc(90vh-180px)]">
            <div className="space-y-6 pb-4">
              {/* Status Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div>
                  <Label className="text-base font-medium">Status da Página</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.is_active ? "Página visível para visitantes" : "Página oculta (não acessível)"}
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_active: v }))}
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Título da Página</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Sobre Nós"
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content">Conteúdo da Página</Label>
                <p className="text-xs text-muted-foreground">
                  Use linhas em branco para separar parágrafos. O texto será formatado automaticamente.
                </p>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Digite o conteúdo da página..."
                  className="min-h-[250px] resize-y"
                />
              </div>

              {/* Image Section */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[#6a1b9a]" />
                  Imagem da Página (Vertical)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Arquivo da Imagem</Label>
                    <div className="mt-2 flex flex-col gap-3">
                      {formData.image_url ? (
                        <div className="relative w-full max-w-[200px] aspect-[3/4] border rounded bg-white overflow-hidden">
                          <img 
                            src={formData.image_url} 
                            alt="Preview" 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                      ) : (
                        <div className="w-full max-w-[200px] aspect-[3/4] border rounded bg-muted flex items-center justify-center text-center p-4">
                          <span className="text-xs text-muted-foreground">
                            Nenhuma imagem selecionada
                          </span>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setMediaOpen(true)}
                        >
                          <ImageIcon className="h-4 w-4 mr-1" />
                          {formData.image_url ? "Trocar" : "Selecionar"}
                        </Button>
                        {formData.image_url && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setFormData(prev => ({ ...prev, image_url: "" }))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Recomendado: imagem vertical (proporção 3:4)
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="image_alt" className="text-sm">Texto Alternativo (ALT)</Label>
                    <Input
                      id="image_alt"
                      value={formData.image_alt}
                      onChange={(e) => setFormData(prev => ({ ...prev, image_alt: e.target.value }))}
                      className="mt-2"
                      placeholder="Ex: Sobre a VirtualMercado"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Descrição da imagem para acessibilidade e SEO
                    </p>
                  </div>
                </div>
              </div>

              {/* Display Order */}
              <div className="space-y-2">
                <Label htmlFor="display_order">Ordem de Exibição</Label>
                <Input
                  id="display_order"
                  type="number"
                  min={1}
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 1 }))}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  Usado para ordenar páginas institucionais (menor número = primeiro)
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaSelectorModal
        isOpen={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={handleSelectImage}
        allowedTypes={["image"]}
      />
    </>
  );
};

export default CMSAboutUsModal;
