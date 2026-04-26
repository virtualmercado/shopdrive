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
import {
  Loader2,
  Pencil,
  Trash2,
  FolderTree,
  Image as ImageIcon,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface CategoryManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryChange?: () => void;
}

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
];
const MAX_SIZE = 300 * 1024; // 300 KB

export const CategoryManagementModal = ({
  open,
  onOpenChange,
  onCategoryChange,
}: CategoryManagementModalProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [linkedProductsCount, setLinkedProductsCount] = useState(0);

  const [name, setName] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) fetchCategories();
  }, [open]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setCategories((data as Category[]) || []);
    } catch (e) {
      console.error("Error fetching categories:", e);
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Use PNG, JPG, JPEG, WEBP ou SVG.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O ícone deve ter no máximo 300 KB.",
        variant: "destructive",
      });
      return;
    }

    setIconFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setIconPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadIcon = async (userId: string, file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `categories/${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(path);

    return data.publicUrl;
  };

  const resetForm = () => {
    setEditing(null);
    setName("");
    setIconFile(null);
    setIconPreview(null);
    setIsActive(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da categoria é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let iconUrl: string | null = editing?.icon_url ?? null;
      if (iconFile) iconUrl = await uploadIcon(user.id, iconFile);
      else if (editing && iconPreview === null) iconUrl = null; // user removed

      if (editing) {
        const { error } = await supabase
          .from("product_categories")
          .update({
            name: name.trim(),
            icon_url: iconUrl,
            is_active: isActive,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Categoria atualizada" });
      } else {
        const { error } = await supabase
          .from("product_categories")
          .insert({
            name: name.trim(),
            icon_url: iconUrl,
            is_active: isActive,
            user_id: user.id,
          });
        if (error) {
          if (error.code === "23505") {
            toast({
              title: "Erro",
              description: "Já existe uma categoria com este nome",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }
        toast({ title: "Sucesso", description: "Categoria criada" });
      }

      resetForm();
      fetchCategories();
      onCategoryChange?.();
    } catch (e) {
      console.error("Error saving category:", e);
      toast({
        title: "Erro",
        description: "Erro ao salvar categoria",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setIconPreview(cat.icon_url);
    setIsActive(cat.is_active);
    setIconFile(null);
  };

  const handleDeleteClick = async (cat: Category) => {
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("category_id", cat.id);
    setLinkedProductsCount(count || 0);
    setToDelete(cat);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", toDelete.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Categoria excluída" });
      fetchCategories();
      onCategoryChange?.();
    } catch (e) {
      console.error("Error deleting category:", e);
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setToDelete(null);
    }
  };

  const removeIcon = () => {
    setIconFile(null);
    setIconPreview(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Gerenciar Categorias
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 border-b pb-4">
            <h3 className="font-medium">
              {editing ? "Editar Categoria" : "Nova Categoria"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Nome da Categoria *</Label>
                <Input
                  id="cat-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Linha Terapêutica, Linha Aromática, Kits para Presente"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Ícone da Categoria (opcional)</Label>
                <div className="flex items-center gap-2">
                  {iconPreview ? (
                    <div className="relative h-10 w-10 rounded-md overflow-hidden border">
                      <img
                        src={iconPreview}
                        alt="Ícone preview"
                        className="h-full w-full object-contain"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full"
                        onClick={removeIcon}
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
                    {iconPreview ? "Alterar" : "Upload"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={handleIconChange}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Formato recomendado: PNG, JPG, JPEG, WEBP ou SVG. Tamanho
                  ideal: 128x128 px. Proporção quadrada 1:1. Tamanho máximo:
                  300 KB.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="cat-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="cat-active">Categoria ativa</Label>
              </div>

              <div className="flex-1" />

              {editing && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}

              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Atualizar" : "Criar Categoria"}
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            <h3 className="font-medium">Categorias Cadastradas</h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderTree className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma categoria cadastrada</p>
                <p className="text-sm">Crie sua primeira categoria acima</p>
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {cat.icon_url ? (
                        <img
                          src={cat.icon_url}
                          alt={cat.name}
                          className="h-10 w-10 rounded-md object-contain border bg-background"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md border flex items-center justify-center bg-background">
                          <FolderTree className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cat.is_active ? "Ativa" : "Inativa"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(cat)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(cat)}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {linkedProductsCount > 0 ? (
                <>
                  A categoria <strong>{toDelete?.name}</strong> está vinculada a{" "}
                  <strong>{linkedProductsCount}</strong> produto(s). Não é
                  possível excluir categorias vinculadas a produtos. Remova a
                  categoria dos produtos primeiro.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir a categoria{" "}
                  <strong>{toDelete?.name}</strong>? Esta ação não pode ser
                  desfeita.
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
