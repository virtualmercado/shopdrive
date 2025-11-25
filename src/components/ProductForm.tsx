import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, Camera, Image as ImageIcon } from "lucide-react";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(200, "Nome muito longo"),
  description: z.string().max(4000, "Descrição muito longa").optional(),
  price: z.number({ invalid_type_error: "Preço inválido" })
    .positive("Preço deve ser positivo")
    .max(999999.99, "Preço máximo excedido")
    .finite("Preço inválido"),
  promotional_price: z.number().min(0).optional(),
  stock: z.number({ invalid_type_error: "Estoque inválido" })
    .int("Estoque deve ser um número inteiro")
    .min(0, "Estoque não pode ser negativo")
    .max(999999, "Estoque máximo excedido"),
  category_id: z.string().optional(),
});

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  stock: number;
  image_url: string | null;
  images: string[];
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSuccess: () => void;
}

export const ProductForm = ({ open, onOpenChange, product, onSuccess }: ProductFormProps) => {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product?.price.toString() || "");
  const [promotionalPrice, setPromotionalPrice] = useState(product?.promotional_price?.toString() || "");
  const [stock, setStock] = useState(product?.stock.toString() || "");
  const [categoryId, setCategoryId] = useState(product?.category_id || "");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>(product?.images || []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (product && open) {
      setName(product.name);
      setDescription(product.description || "");
      setPrice(product.price.toString());
      setPromotionalPrice(product.promotional_price?.toString() || "");
      setStock(product.stock.toString());
      setCategoryId(product.category_id || "");
      setImagePreviews(product.images || []);
      setImageFiles([]);
    } else if (!open) {
      resetForm();
    }
  }, [product, open]);

  const fetchCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from("product_categories")
      .select("*")
      .order("name");
    
    if (data) setCategories(data);
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = imagePreviews.length + files.length;
    
    if (totalImages > 7) {
      toast({
        title: "Limite excedido",
        description: "Você pode adicionar no máximo 7 imagens",
        variant: "destructive",
      });
      return;
    }

    const newFiles = files.slice(0, 7 - imagePreviews.length);
    setImageFiles([...imageFiles, ...newFiles]);

    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const uploadImages = async (userId: string, files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("product_categories")
      .insert([{ name: newCategoryName.trim(), user_id: user.id }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar categoria",
        variant: "destructive",
      });
      return;
    }

    setCategories([...categories, data]);
    setCategoryId(data.id);
    setNewCategoryName("");
    setShowNewCategory(false);
    
    toast({
      title: "Sucesso",
      description: "Categoria criada com sucesso",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Upload new images
      let uploadedImages: string[] = [];
      if (imageFiles.length > 0) {
        uploadedImages = await uploadImages(user.id, imageFiles);
      }

      // Combine existing and new images
      const allImages = [...imagePreviews.filter(p => p.startsWith('http')), ...uploadedImages];
      const mainImage = allImages[0] || null;

      // Validate input data
      const parsedPrice = parseFloat(price);
      const parsedPromotionalPrice = promotionalPrice ? parseFloat(promotionalPrice) : undefined;
      const parsedStock = parseInt(stock);

      try {
        productSchema.parse({
          name,
          description: description || undefined,
          price: parsedPrice,
          promotional_price: parsedPromotionalPrice,
          stock: parsedStock,
          category_id: categoryId || undefined,
        });
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          const firstError = validationError.errors[0];
          toast({
            title: "Dados inválidos",
            description: firstError.message,
            variant: "destructive",
          });
          return;
        }
      }

      const productData = {
        name: name.trim(),
        description: description?.trim() || null,
        price: parsedPrice,
        promotional_price: parsedPromotionalPrice || null,
        stock: parsedStock,
        image_url: mainImage,
        images: allImages,
        category_id: categoryId || null,
        user_id: user.id,
      };

      if (product) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Produto atualizado com sucesso",
        });
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Produto criado com sucesso",
        });
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error:', error);
      }
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar o produto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setPromotionalPrice("");
    setStock("");
    setCategoryId("");
    setImageFiles([]);
    setImagePreviews([]);
    setNewCategoryName("");
    setShowNewCategory(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Multiple Images Upload */}
          <div className="space-y-2">
            <Label>Imagens do Produto (máx. 7)</Label>
            
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {imagePreviews.length < 7 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleCameraCapture}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Câmera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleFileSelect}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Arquivos
                </Button>
              </div>
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImagesChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagesChange}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome do Produto</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Camiseta Básica"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva seu produto..."
              rows={3}
              maxLength={4000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/4000 caracteres
            </p>
          </div>

          {/* Price and Promotional Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="promotional_price">Preço Promocional (R$)</Label>
              <Input
                id="promotional_price"
                type="number"
                step="0.01"
                min="0"
                value={promotionalPrice}
                onChange={(e) => setPromotionalPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Category and Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <div className="space-y-2">
                <select
                  id="category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {!showNewCategory ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewCategory(true)}
                    className="w-full"
                  >
                    + Nova Categoria
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome da categoria"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), createCategory())}
                    />
                    <Button type="button" size="sm" onClick={createCategory}>
                      Criar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowNewCategory(false);
                        setNewCategoryName("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Estoque</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};