import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { Loader2, Trash2, Play, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface CMSDemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
};

const CMSDemoVideoModal = ({ isOpen, onClose, content, onSave }: CMSDemoVideoModalProps) => {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [behavior, setBehavior] = useState<"modal" | "new_tab">("modal");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (content) {
      setTitle(content.title || "");
      setUrl(content.url || "");
      setBehavior(content.behavior || "modal");
    }
  }, [content]);

  const videoId = extractYouTubeId(url);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ title, url: url.trim(), behavior });
      toast.success("Vídeo de demonstração atualizado!");
      onClose();
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await onSave({ title: "", url: "", behavior: "modal" });
      setTitle("");
      setUrl("");
      setBehavior("modal");
      toast.success("Vínculo do vídeo removido.");
      onClose();
    } catch {
      toast.error("Erro ao remover.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#6a1b9a]">CMS – Vídeo de Demonstração</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div>
            <Label>Título do vídeo</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Conheça a ShopDrive em 1 minuto"
              maxLength={100}
            />
          </div>

          <div>
            <Label>Link do YouTube</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Aceitamos links do YouTube (watch, youtu.be e shorts).
            </p>
          </div>

          {/* Preview */}
          {videoId && (
            <div className="p-4 rounded-lg bg-muted/30 space-y-2">
              <Label className="text-sm font-medium">Pré-visualização</Label>
              <div className="relative aspect-video w-full max-w-sm rounded-lg overflow-hidden bg-black/10">
                <img
                  src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center">
                    <Play className="w-7 h-7 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(url, "_blank")}
              >
                <ExternalLink className="w-4 h-4" />
                Testar vídeo
              </Button>
            </div>
          )}

          <div>
            <Label className="mb-3 block">Comportamento do botão</Label>
            <RadioGroup value={behavior} onValueChange={(v) => setBehavior(v as "modal" | "new_tab")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="modal" id="beh-modal" />
                <Label htmlFor="beh-modal" className="font-normal cursor-pointer">
                  Abrir em modal (embed interno)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="new_tab" id="beh-tab" />
                <Label htmlFor="beh-tab" className="font-normal cursor-pointer">
                  Abrir em nova aba
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="flex justify-between gap-3">
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={handleDelete}
            disabled={isSaving || !url}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir vínculo
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#FB8C00] hover:bg-[#FB8C00]/90"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CMSDemoVideoModal;
