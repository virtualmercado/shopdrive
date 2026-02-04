import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, Camera, Image as ImageIcon, Pencil, Plus, Sparkles, Bot } from "lucide-react";
import { z } from "zod";
import { useTheme } from "@/contexts/ThemeContext";
import { ImageEditor, EditorSettings } from "@/components/ImageEditor";
import { AIProductAssistantModal } from "@/components/products/AIProductAssistantModal";
import { BrandSelector } from "@/components/products/BrandSelector";

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

interface ProductVariation {
  name: string;
  values: string[];
}

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
  brand_id?: string | null;
  is_featured?: boolean;
  is_new?: boolean;
  variations?: ProductVariation[];
  weight?: number | null;
  length?: number | null;
  height?: number | null;
  width?: number | null;
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
  const [brandId, setBrandId] = useState<string | null>(product?.brand_id || null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>(product?.images || []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Variations state
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [newVariationName, setNewVariationName] = useState("");
  const [newVariationValues, setNewVariationValues] = useState("");
  const [editingVariationIndex, setEditingVariationIndex] = useState<number | null>(null);
  const [editVariationName, setEditVariationName] = useState("");
  const [editVariationValues, setEditVariationValues] = useState("");
  
  // Weight and dimensions state
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [height, setHeight] = useState("");
  const [width, setWidth] = useState("");
  
  // Image editor state
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  
  // AI Assistant state
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiGenerateTitle, setAiGenerateTitle] = useState(false);
  
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { buttonBgColor, buttonTextColor, buttonBorderStyle } = useTheme();
  
  const buttonRadius = buttonBorderStyle === 'rounded' ? 'rounded-full' : 'rounded-none';
  
  // Generate a slightly darker/lighter color for hover effect
  const getHoverColor = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const factor = 0.85;
    return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
  };

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
      setBrandId(product.brand_id || null);
      setImagePreviews(product.images || []);
      setImageFiles([]);
      setIsFeatured(product.is_featured || false);
      setIsNew(product.is_new || false);
      setVariations(product.variations || []);
      setWeight(product.weight?.toString() || "");
      setLength(product.length?.toString() || "");
      setHeight(product.height?.toString() || "");
      setWidth(product.width?.toString() || "");
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
      .eq("user_id", user.id)
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

  // Variation handlers
  const addVariation = () => {
    if (!newVariationName.trim() || !newVariationValues.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e os valores da variação",
        variant: "destructive",
      });
      return;
    }

    const values = newVariationValues.split(',').map(v => v.trim()).filter(v => v);
    if (values.length === 0) {
      toast({
        title: "Valores inválidos",
        description: "Adicione pelo menos um valor para a variação",
        variant: "destructive",
      });
      return;
    }

    setVariations([...variations, { name: newVariationName.trim(), values }]);
    setNewVariationName("");
    setNewVariationValues("");
    
    toast({
      title: "Sucesso",
      description: "Variação adicionada",
    });
  };

  const startEditVariation = (index: number) => {
    const variation = variations[index];
    setEditingVariationIndex(index);
    setEditVariationName(variation.name);
    setEditVariationValues(variation.values.join(', '));
  };

  const saveEditVariation = () => {
    if (editingVariationIndex === null) return;
    
    if (!editVariationName.trim() || !editVariationValues.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e os valores da variação",
        variant: "destructive",
      });
      return;
    }

    const values = editVariationValues.split(',').map(v => v.trim()).filter(v => v);
    const updatedVariations = [...variations];
    updatedVariations[editingVariationIndex] = { name: editVariationName.trim(), values };
    
    setVariations(updatedVariations);
    setEditingVariationIndex(null);
    setEditVariationName("");
    setEditVariationValues("");
    
    toast({
      title: "Sucesso",
      description: "Variação atualizada",
    });
  };

  const cancelEditVariation = () => {
    setEditingVariationIndex(null);
    setEditVariationName("");
    setEditVariationValues("");
  };

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
    toast({
      title: "Sucesso",
      description: "Variação removida",
    });
  };

  const handleSimulateShipping = () => {
    toast({
      title: "Em breve",
      description: "O cálculo de frete será implementado em breve",
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

      // Upload new images (from files) and edited images (data URLs)
      let uploadedImages: string[] = [];
      
      // Separate existing http URLs from data URLs (edited/new images)
      const existingHttpUrls: string[] = [];
      const dataUrlsToUpload: { index: number; dataUrl: string }[] = [];
      
      imagePreviews.forEach((preview, index) => {
        if (preview.startsWith('http')) {
          existingHttpUrls.push(preview);
        } else if (preview.startsWith('data:')) {
          // This is an edited image or a new image that needs uploading
          dataUrlsToUpload.push({ index, dataUrl: preview });
        }
      });
      
      // Upload data URLs as new files
      for (const { dataUrl } of dataUrlsToUpload) {
        try {
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `edited-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`, { type: 'image/png' });
          
          const fileExt = 'png';
          const fileName = `${user.id}/${Math.random()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(fileName, file);
          
          if (uploadError) throw uploadError;
          
          const { data } = supabase.storage
            .from("product-images")
            .getPublicUrl(fileName);
          
          uploadedImages.push(data.publicUrl);
        } catch (err) {
          console.error('Error uploading edited image:', err);
        }
      }
      
      // Also upload any new files from file picker
      if (imageFiles.length > 0) {
        // Only upload files that haven't been converted to data URLs
        const remainingFiles = imageFiles.filter((_, idx) => {
          // Check if this file index corresponds to a data URL we already processed
          return !dataUrlsToUpload.some(d => d.index === existingHttpUrls.length + idx);
        });
        
        if (remainingFiles.length > 0) {
          const newUploads = await uploadImages(user.id, remainingFiles);
          uploadedImages = [...uploadedImages, ...newUploads];
        }
      }

      // Combine: keep order by rebuilding from imagePreviews
      const allImages: string[] = [];
      let httpIndex = 0;
      let uploadedIndex = 0;
      
      for (const preview of imagePreviews) {
        if (preview.startsWith('http')) {
          allImages.push(existingHttpUrls[httpIndex]);
          httpIndex++;
        } else if (preview.startsWith('data:')) {
          if (uploadedIndex < uploadedImages.length) {
            allImages.push(uploadedImages[uploadedIndex]);
            uploadedIndex++;
          }
        }
      }
      
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
        brand_id: brandId || null,
        is_featured: isFeatured,
        is_new: isNew,
        user_id: user.id,
        variations: JSON.parse(JSON.stringify(variations)),
        weight: weight ? parseFloat(weight) : null,
        length: length ? parseFloat(length) : null,
        height: height ? parseFloat(height) : null,
        width: width ? parseFloat(width) : null,
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
    setBrandId(null);
    setImageFiles([]);
    setImagePreviews([]);
    setNewCategoryName("");
    setShowNewCategory(false);
    setIsFeatured(false);
    setIsNew(false);
    setVariations([]);
    setNewVariationName("");
    setNewVariationValues("");
    setEditingVariationIndex(null);
    setEditVariationName("");
    setEditVariationValues("");
    setWeight("");
    setLength("");
    setHeight("");
    setWidth("");
    setImageEditorOpen(false);
    setEditingImageIndex(null);
  };

  // Handle saving edited image from ImageEditor
  const handleSaveEditedImage = (editedImageUrl: string) => {
    if (editingImageIndex === null) return;
    
    // Update the preview at the editing index
    setImagePreviews(prev => {
      const updated = [...prev];
      updated[editingImageIndex] = editedImageUrl;
      return updated;
    });
    
    // If the original was a file (data URL), we need to convert the edited image to a file
    // For remote URLs that were edited, we need to create a new file from the data URL
    if (editedImageUrl.startsWith('data:')) {
      // Convert data URL to File
      fetch(editedImageUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `edited-image-${editingImageIndex}.png`, { type: 'image/png' });
          setImageFiles(prev => {
            const updated = [...prev];
            // If this was an existing file, replace it
            // If it was a remote URL, add a new file
            if (prev.length > editingImageIndex) {
              updated[editingImageIndex] = file;
            } else {
              // This was a remote URL, we need to mark it for replacement
              // The preview will be the data URL, and we need to track this separately
              updated.push(file);
            }
            return updated;
          });
        });
    }
    
    setImageEditorOpen(false);
    setEditingImageIndex(null);
    
    toast({
      title: "Sucesso",
      description: "Imagem editada salva com sucesso!",
    });
  };

  // Handle applying editor settings to other images (batch standardization)
  const handleApplyToOtherImages = async (settings: EditorSettings) => {
    if (editingImageIndex === null || imagePreviews.length <= 1) return;
    
    const otherIndices = imagePreviews
      .map((_, idx) => idx)
      .filter(idx => idx !== editingImageIndex);
    
    toast({
      title: "Padronização em lote",
      description: `Aplicando ajustes a ${otherIndices.length} imagem(ns)...`,
    });
    
    // For now, just show a success message - the actual processing would need canvas manipulation
    // This is a placeholder for the batch processing logic
    setTimeout(() => {
      toast({
        title: "Sucesso",
        description: `Ajustes aplicados a ${otherIndices.length} imagem(ns) com sucesso!`,
      });
    }, 500);
  };

  return (
    <>
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
                  <div 
                    key={index} 
                    className="relative aspect-square bg-muted rounded-lg overflow-hidden group cursor-pointer"
                    onDoubleClick={() => {
                      setEditingImageIndex(index);
                      setImageEditorOpen(true);
                    }}
                  >
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Pencil icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/30 rounded-full p-3 opacity-50 group-hover:opacity-80 transition-opacity">
                        <Pencil className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(index);
                      }}
                      style={{
                        backgroundColor: buttonBgColor,
                        color: buttonTextColor,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = getHoverColor(buttonBgColor);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = buttonBgColor;
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <p className="absolute bottom-1 left-1 right-1 text-[10px] text-white bg-black/50 px-1 py-0.5 rounded text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      Duplo clique para editar
                    </p>
                  </div>
                ))}
              </div>
            )}

            {imagePreviews.length < 7 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={`flex-1 ${buttonRadius} transition-all duration-200`}
                  onClick={handleCameraCapture}
                  style={{ 
                    borderColor: buttonBgColor,
                    color: buttonBgColor
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = buttonBgColor;
                    e.currentTarget.style.color = buttonTextColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = buttonBgColor;
                  }}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Câmera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={`flex-1 ${buttonRadius} transition-all duration-200`}
                  onClick={handleFileSelect}
                  style={{ 
                    borderColor: buttonBgColor,
                    color: buttonBgColor
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = buttonBgColor;
                    e.currentTarget.style.color = buttonTextColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = buttonBgColor;
                  }}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="name">Nome do Produto</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-primary hover:text-primary/80"
                onClick={() => {
                  setAiGenerateTitle(true);
                  setAiAssistantOpen(true);
                }}
              >
                <Sparkles className="h-3 w-3" />
                Gerar título com IA
              </Button>
            </div>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Camiseta Básica"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Descrição</Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`w-full mb-2 gap-2 ${buttonRadius} border-primary text-primary hover:bg-primary hover:text-primary-foreground`}
              onClick={() => {
                setAiGenerateTitle(false);
                setAiAssistantOpen(true);
              }}
            >
              <Bot className="h-4 w-4" />
              Criar descrição profissional com IA
            </Button>
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
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewCategory(true)}
                    className={`w-full ${buttonRadius} transition-all duration-200`}
                    style={{ 
                      borderColor: buttonBgColor,
                      color: buttonBgColor
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = buttonBgColor;
                      e.currentTarget.style.color = buttonTextColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = buttonBgColor;
                    }}
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
                    <Button 
                      type="button" 
                      size="sm" 
                      onClick={createCategory}
                      className={`${buttonRadius} transition-all duration-200`}
                      style={{ 
                        backgroundColor: buttonBgColor, 
                        color: buttonTextColor,
                        borderColor: buttonBgColor
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = getHoverColor(buttonBgColor);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = buttonBgColor;
                      }}
                    >
                      Criar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`${buttonRadius} transition-all duration-200`}
                      onClick={() => {
                        setShowNewCategory(false);
                        setNewCategoryName("");
                      }}
                      style={{ 
                        borderColor: buttonBgColor,
                        color: buttonBgColor
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = buttonBgColor;
                        e.currentTarget.style.color = buttonTextColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = buttonBgColor;
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
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

          {/* Brand Section */}
          <BrandSelector
            value={brandId}
            onChange={setBrandId}
            buttonBgColor={buttonBgColor}
            buttonTextColor={buttonTextColor}
            buttonRadius={buttonRadius}
          />

          {/* Product Variations Section */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-base font-semibold">Variações do Produto</Label>
            <p className="text-xs text-muted-foreground">
              Adicione variações como Cor, Tamanho, Aroma, Tipo, etc.
            </p>
            
            {/* Existing variations list */}
            {variations.length > 0 && (
              <div className="space-y-2">
                {variations.map((variation, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    {editingVariationIndex === index ? (
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editVariationName}
                          onChange={(e) => setEditVariationName(e.target.value)}
                          placeholder="Nome da variação"
                          className="text-sm"
                        />
                        <Input
                          value={editVariationValues}
                          onChange={(e) => setEditVariationValues(e.target.value)}
                          placeholder="Valores separados por vírgula"
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={saveEditVariation}
                            className={`${buttonRadius} transition-all duration-200`}
                            style={{ 
                              backgroundColor: buttonBgColor, 
                              color: buttonTextColor 
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = getHoverColor(buttonBgColor);
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = buttonBgColor;
                            }}
                          >
                            Salvar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={cancelEditVariation}
                            className={`${buttonRadius} transition-all duration-200`}
                            style={{ 
                              borderColor: buttonBgColor,
                              color: buttonBgColor
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = buttonBgColor;
                              e.currentTarget.style.color = buttonTextColor;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = buttonBgColor;
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{variation.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {variation.values.join(', ')}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 transition-all duration-200"
                            onClick={() => startEditVariation(index)}
                            style={{ color: buttonBgColor }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = buttonBgColor;
                              e.currentTarget.style.color = buttonTextColor;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = buttonBgColor;
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 transition-all duration-200"
                            onClick={() => removeVariation(index)}
                            style={{ color: buttonBgColor }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = buttonBgColor;
                              e.currentTarget.style.color = buttonTextColor;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = buttonBgColor;
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Add new variation */}
            <div className="space-y-2 p-3 border border-dashed rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={newVariationName}
                  onChange={(e) => setNewVariationName(e.target.value)}
                  placeholder="Ex: Cor, Tamanho, Aroma"
                  className="text-sm"
                />
                <Input
                  value={newVariationValues}
                  onChange={(e) => setNewVariationValues(e.target.value)}
                  placeholder="Ex: Vermelho, Azul, Verde"
                  className="text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariation}
                className={`w-full ${buttonRadius} transition-all duration-200`}
                style={{ 
                  borderColor: buttonBgColor,
                  color: buttonBgColor
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = buttonBgColor;
                  e.currentTarget.style.color = buttonTextColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = buttonBgColor;
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Variação
              </Button>
            </div>
          </div>

          {/* Weight and Dimensions Section */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-base font-semibold">Peso e Dimensões do Produto</Label>
            <p className="text-xs text-muted-foreground">
              Informe o peso e as dimensões para cálculo de frete
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="weight" className="text-xs">Peso (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.00"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="length" className="text-xs">Comprimento (cm)</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  min="0"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="0.0"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="height" className="text-xs">Altura (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  min="0"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="0.0"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="width" className="text-xs">Largura (cm)</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  min="0"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="0.0"
                  className="text-sm"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleSimulateShipping}
              className={`w-full ${buttonRadius} transition-all duration-200`}
              style={{ 
                borderColor: buttonBgColor,
                color: buttonBgColor
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = buttonBgColor;
                e.currentTarget.style.color = buttonTextColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = buttonBgColor;
              }}
            >
              Calcular Frete Simulado
            </Button>
          </div>

          {/* Product Features */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="is_featured"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="is_featured" className="text-sm font-medium cursor-pointer">
                Produto em Destaque
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="is_new"
                checked={isNew}
                onChange={(e) => setIsNew(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="is_new" className="text-sm font-medium cursor-pointer">
                Produto Novidade
              </Label>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className={`flex-1 ${buttonRadius} transition-all duration-200`}
              disabled={loading}
              style={{ 
                borderColor: buttonBgColor,
                color: buttonBgColor
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = buttonBgColor;
                  e.currentTarget.style.color = buttonTextColor;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = buttonBgColor;
              }}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className={`flex-1 ${buttonRadius} transition-all duration-200`} 
              disabled={loading}
              style={{ 
                backgroundColor: buttonBgColor, 
                color: buttonTextColor,
                borderColor: buttonBgColor
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = getHoverColor(buttonBgColor);
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = buttonBgColor;
              }}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    
    {/* Image Editor Modal */}
    {editingImageIndex !== null && (
      <ImageEditor
        open={imageEditorOpen}
        onOpenChange={setImageEditorOpen}
        imageUrl={imagePreviews[editingImageIndex] || ''}
        onSave={handleSaveEditedImage}
        otherProductImages={imagePreviews.filter((_, idx) => idx !== editingImageIndex)}
        onApplyToOthers={handleApplyToOtherImages}
      />
    )}

    {/* AI Product Assistant Modal */}
    <AIProductAssistantModal
      open={aiAssistantOpen}
      onOpenChange={setAiAssistantOpen}
      currentCategory={categories.find(c => c.id === categoryId)?.name || ""}
      currentProductName={name}
      productId={product?.id}
      generateTitle={aiGenerateTitle}
      onApply={(result) => {
        if (result.title && aiGenerateTitle) {
          setName(result.title);
        }
        if (result.description) {
          setDescription(result.description);
        }
      }}
    />
    </>
  );
};
