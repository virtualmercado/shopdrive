import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Pencil, Trash2, Plus, Tag, Image as ImageIcon } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface BrandManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBrandChange?: () => void;
}

export const BrandManagementModal = ({
  open,
  onOpenChange,
  onBrandChange,
}: BrandManagementModalProps) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);
  const [linkedProductsCount, setLinkedProductsCount] = useState(0);
  
  // Form state
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchBrands();
    }
  }, [open]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("product_brands")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error("Error fetching brands:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar marcas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (userId: string, file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `brands/${userId}/${Math.random()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da marca é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let logoUrl = editingBrand?.logo_url || null;
      if (logoFile) {
        logoUrl = await uploadLogo(user.id, logoFile);
      }

      if (editingBrand) {
        // Update existing brand
        const { error } = await supabase
          .from("product_brands")
          .update({
            name: name.trim(),
            logo_url: logoUrl,
            is_active: isActive,
          })
          .eq("id", editingBrand.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Marca atualizada com sucesso",
        });
      } else {
        // Create new brand
        const { error } = await supabase
          .from("product_brands")
          .insert({
            name: name.trim(),
            logo_url: logoUrl,
            is_active: isActive,
            user_id: user.id,
          });

        if (error) {
          if (error.code === "23505") {
            toast({
              title: "Erro",
              description: "Já existe uma marca com este nome",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Sucesso",
          description: "Marca criada com sucesso",
        });
      }

      resetForm();
      fetchBrands();
      onBrandChange?.();
    } catch (error) {
      console.error("Error saving brand:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar marca",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setName(brand.name);
    setLogoPreview(brand.logo_url);
    setIsActive(brand.is_active);
    setLogoFile(null);
  };

  const handleDeleteClick = async (brand: Brand) => {
    // Check if brand has linked products
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brand.id);

    setLinkedProductsCount(count || 0);
    setBrandToDelete(brand);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!brandToDelete) return;

    try {
      const { error } = await supabase
        .from("product_brands")
        .delete()
        .eq("id", brandToDelete.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Marca excluída com sucesso",
      });

      fetchBrands();
      onBrandChange?.();
    } catch (error) {
      console.error("Error deleting brand:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir marca",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setBrandToDelete(null);
    }
  };

  const resetForm = () => {
    setEditingBrand(null);
    setName("");
    setLogoFile(null);
    setLogoPreview(null);
    setIsActive(true);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Gerenciar Marcas
            </DialogTitle>
          </DialogHeader>

          {/* Add/Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-4 border-b pb-4">
            <h3 className="font-medium">
              {editingBrand ? "Editar Marca" : "Nova Marca"}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand-name">Nome da Marca *</Label>
                <Input
                  id="brand-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Nike, Adidas, Apple"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Logo da Marca (opcional)</Label>
                <div className="flex items-center gap-2">
                  {logoPreview ? (
                    <div className="relative h-10 w-10 rounded-md overflow-hidden border">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-full w-full object-contain"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full"
                        onClick={removeLogo}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-md border border-dashed flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {logoPreview ? "Alterar" : "Upload"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="brand-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="brand-active">Marca ativa</Label>
              </div>

              <div className="flex-1" />

              {editingBrand && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
              
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingBrand ? "Atualizar" : "Criar Marca"}
              </Button>
            </div>
          </form>

          {/* Brands List */}
          <div className="space-y-2">
            <h3 className="font-medium">Marcas Cadastradas</h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : brands.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma marca cadastrada</p>
                <p className="text-sm">Crie sua primeira marca acima</p>
              </div>
            ) : (
              <div className="space-y-2">
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.name}
                          className="h-10 w-10 rounded-md object-contain border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md border flex items-center justify-center bg-background">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{brand.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {brand.is_active ? "Ativa" : "Inativa"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(brand)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(brand)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {linkedProductsCount > 0 ? (
                <>
                  A marca <strong>{brandToDelete?.name}</strong> está vinculada a{" "}
                  <strong>{linkedProductsCount}</strong> produto(s). 
                  Não é possível excluir marcas vinculadas a produtos.
                  Remova a marca dos produtos primeiro.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir a marca{" "}
                  <strong>{brandToDelete?.name}</strong>? Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {linkedProductsCount === 0 && (
              <AlertDialogAction onClick={handleDelete}>
                Excluir
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
