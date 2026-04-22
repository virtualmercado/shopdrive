import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { MediaSelectorModal } from "@/components/admin/MediaSelectorModal";

interface IntegrationItem {
  image_url: string;
  description: string;
}

interface CMSIntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const MAX_BANNERS = 16;
const MAX_DESC = 70;

const DEFAULT_TITLE = "Integrações inclusas na plataforma";
const DEFAULT_SUBTITLE =
  "Conheça as ferramentas integradas com a ShopDrive que vão te ajudar a organizar, otimizar e a impulsionar suas vendas";

const CMSIntegrationsModal = ({ isOpen, onClose, content, onSave }: CMSIntegrationsModalProps) => {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [subtitle, setSubtitle] = useState(DEFAULT_SUBTITLE);
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [mediaSelectorIdx, setMediaSelectorIdx] = useState<number | null>(null);

  useEffect(() => {
    if (content) {
      setTitle(content.title || DEFAULT_TITLE);
      setSubtitle(content.subtitle || DEFAULT_SUBTITLE);
      setItems(Array.isArray(content.items) ? content.items : []);
    }
  }, [content]);

  const handleAdd = () => {
    if (items.length >= MAX_BANNERS) {
      toast.error(`Limite de ${MAX_BANNERS} banners atingido.`);
      return;
    }
    setItems([...items, { image_url: "", description: "" }]);
  };

  const handleRemove = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleChange = (idx: number, field: keyof IntegrationItem, value: string) => {
    const next = [...items];
    if (field === "description" && value.length > MAX_DESC) return;
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleaned = items.filter((it) => it.image_url);
      await onSave({ title, subtitle, items: cleaned });
      toast.success("Integrações atualizadas com sucesso!");
      onClose();
    } catch (e) {
      toast.error("Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#6a1b9a]">
              CMS – Banners de Integrações da Plataforma
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Título da seção</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>Subtítulo da seção</Label>
                <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium">Banners de Integrações</h4>
                  <p className="text-sm text-muted-foreground">
                    {items.length}/{MAX_BANNERS} banners · Tamanho recomendado: 709 × 236 px
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleAdd}
                  disabled={items.length >= MAX_BANNERS}
                  className="bg-[#6a1b9a] hover:bg-[#6a1b9a]/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar banner
                </Button>
              </div>

              {items.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed rounded-lg text-muted-foreground">
                  Nenhum banner cadastrado. Clique em "Criar banner" para começar.
                </div>
              )}

              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={idx} className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#6a1b9a]/10 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-[#6a1b9a]">{idx + 1}</span>
                        </div>
                        <span className="font-medium">Banner {idx + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(idx)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
                      <div>
                        <Label className="mb-1.5 block">Imagem (709×236)</Label>
                        <div
                          className="relative w-full overflow-hidden rounded-md border bg-white cursor-pointer hover:border-[#6a1b9a] transition-colors"
                          style={{ aspectRatio: "709 / 236" }}
                          onClick={() => setMediaSelectorIdx(idx)}
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-6 w-6 mb-1" />
                              <span className="text-xs">Selecionar imagem</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <Label>Texto informativo</Label>
                          <span
                            className={`text-xs ${
                              item.description.length >= MAX_DESC
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {item.description.length}/{MAX_DESC}
                          </span>
                        </div>
                        <Input
                          value={item.description}
                          onChange={(e) => handleChange(idx, "description", e.target.value)}
                          maxLength={MAX_DESC}
                          placeholder="Ex: Frete simplificado e integração logística para sua loja"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
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

      <MediaSelectorModal
        isOpen={mediaSelectorIdx !== null}
        onClose={() => setMediaSelectorIdx(null)}
        onSelect={(file) => {
          if (mediaSelectorIdx !== null) {
            handleChange(mediaSelectorIdx, "image_url", file.url);
          }
          setMediaSelectorIdx(null);
        }}
        allowedTypes={["image"]}
        title="Selecionar Imagem do Banner"
      />
    </>
  );
};

export default CMSIntegrationsModal;
