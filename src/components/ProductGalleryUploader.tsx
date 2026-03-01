import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Loader2,
  Trash2,
  ChevronUp,
  ChevronDown,
  ImageIcon,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  listProductImages,
  addProductImage,
  removeProductImage,
  setProductImagesOrder,
  type ProductImage,
} from "@/lib/productGallery";

interface ProductGalleryUploaderProps {
  productId: string;
}

export const ProductGalleryUploader = ({
  productId,
}: ProductGalleryUploaderProps) => {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listProductImages(productId);
      setImages(data);
    } catch (err: any) {
      console.error("Error loading gallery:", err);
      toast.error(err.message || "Erro ao carregar galeria");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) fetchImages();
  }, [productId, fetchImages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";

    if (files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of files) {
      try {
        await addProductImage(productId, file);
        successCount++;
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(`Erro ao enviar "${file.name}": ${err.message}`);
      }
    }

    if (successCount > 0) {
      toast.success(
        `${successCount} imagem(ns) enviada(s) com sucesso!`
      );
      await fetchImages();
    }

    setUploading(false);
  };

  const handleRemove = async (imageId: string) => {
    try {
      setRemovingId(imageId);
      const imgToRemove = images.find((img) => img.id === imageId);
      await removeProductImage({ imageId, publicUrl: imgToRemove?.image_url });
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      toast.success("Imagem removida");
    } catch (err: any) {
      console.error("Remove error:", err);
      toast.error(err.message || "Erro ao remover imagem");
    } finally {
      setRemovingId(null);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;

    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    // Optimistic update
    setImages(reordered);
    setReordering(true);

    try {
      await setProductImagesOrder({
        productId,
        orderedIds: reordered.map((img) => img.id),
      });
    } catch (err: any) {
      console.error("Reorder error:", err);
      toast.error(err.message || "Erro ao reordenar");
      await fetchImages(); // rollback
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <Label className="text-sm font-semibold flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        Galeria de Imagens (MinIO)
      </Label>

      {/* Upload button */}
      <label className="block">
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 cursor-pointer"
          disabled={uploading}
          asChild
        >
          <span>
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Enviando..." : "Adicionar Imagens"}
          </span>
        </Button>
      </label>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando galeria...
        </div>
      )}

      {/* Empty state */}
      {!loading && images.length === 0 && (
        <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
          <AlertCircle className="h-4 w-4" />
          Nenhuma imagem na galeria. Envie a primeira!
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, index) => (
            <div
              key={img.id}
              className="relative group rounded-lg overflow-hidden border bg-muted aspect-square"
            >
              <img
                src={img.image_url}
                alt={`Imagem ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Order badge */}
              <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold rounded px-1.5 py-0.5">
                {index + 1}
              </span>

              {/* Actions overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  disabled={index === 0 || reordering}
                  onClick={() => handleMove(index, "up")}
                  title="Mover para cima"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  disabled={index === images.length - 1 || reordering}
                  onClick={() => handleMove(index, "down")}
                  title="Mover para baixo"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-destructive"
                  disabled={removingId === img.id}
                  onClick={() => handleRemove(img.id)}
                  title="Remover imagem"
                >
                  {removingId === img.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Formatos: JPEG, PNG, WEBP • Máx. 10 MB por imagem
      </p>
    </div>
  );
};
