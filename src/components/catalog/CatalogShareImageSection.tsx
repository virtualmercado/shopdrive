import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  clearShareImage,
  deleteStoredShareImage,
  uploadShareImage,
  validateShareImageFile,
} from "@/lib/catalogShareImage";

interface CatalogShareImageSectionProps {
  userId: string | undefined;
  customImageUrl: string | null;
  storeLogoUrl: string | null;
  onChange: (url: string | null) => void;
  primaryColor: string;
}

const CatalogShareImageSection = ({
  userId,
  customImageUrl,
  storeLogoUrl,
  onChange,
  primaryColor,
}: CatalogShareImageSectionProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const previewUrl = customImageUrl || storeLogoUrl || null;

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId) return;

    const validation = validateShareImageFile(file);
    if (validation.ok === false) {
      toast.error(validation.error);
      return;
    }

    setIsUploading(true);
    const previous = customImageUrl;
    try {
      const { publicUrl, width, height } = await uploadShareImage(userId, file);
      await deleteStoredShareImage(userId, previous);
      onChange(publicUrl);
      if (width < 600 || height < 600) {
        toast.warning("Para melhor qualidade, recomendamos imagens com pelo menos 600 × 600 px.");
      }
      toast.success("Imagem de divulgação salva!");
    } catch {
      toast.error("Não foi possível enviar a imagem. Tente novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!userId) return;
    setIsRemoving(true);
    try {
      await clearShareImage(userId);
      await deleteStoredShareImage(userId, customImageUrl);
      onChange(null);
      toast.success("Imagem personalizada removida.");
    } catch {
      toast.error("Não foi possível remover a imagem. Tente novamente.");
    } finally {
      setIsRemoving(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="catalog-share-image" className="text-sm font-medium">
        Imagem para divulgação no WhatsApp
      </Label>
      <p className="text-xs text-muted-foreground">
        Essa imagem acompanha sua mensagem quando você compartilhar o catálogo pelo WhatsApp. Ela não será
        incluída no PDF.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
        <div className="w-20 h-20 shrink-0 rounded-md border border-border bg-muted/40 overflow-hidden flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={
                customImageUrl
                  ? "Prévia da imagem de divulgação do catálogo"
                  : "Prévia da logo da loja usada na divulgação do catálogo"
              }
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs text-muted-foreground">
            {customImageUrl
              ? "Imagem personalizada"
              : storeLogoUrl
                ? "Usaremos automaticamente a logo da sua loja."
                : "Nenhuma imagem personalizada. Adicione uma imagem para deixar sua divulgação mais atrativa."}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              id="catalog-share-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleFile}
              disabled={isUploading || !userId}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePick}
              disabled={isUploading || !userId}
              className="gap-1.5"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {isUploading ? "Enviando..." : customImageUrl ? "Substituir" : "Escolher imagem"}
            </Button>

            {customImageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remover imagem de divulgação"
                onClick={() => setConfirmOpen(true)}
                disabled={isUploading || isRemoving}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Recomendado: 1080 × 1080 px • JPG ou PNG • até 2 MB. Limite de upload: 5 MB.
      </p>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover imagem personalizada?</AlertDialogTitle>
            <AlertDialogDescription>
              A logo da sua loja voltará a ser utilizada automaticamente no compartilhamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={isRemoving}>
              {isRemoving ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CatalogShareImageSection;
