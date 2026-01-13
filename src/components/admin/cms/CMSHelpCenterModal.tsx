import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Plus,
  Edit,
  Trash2,
  Save,
  Loader2,
  FolderOpen,
  FileText,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  useHelpCategoriesAdmin,
  useHelpArticlesAdmin,
  useCreateHelpCategory,
  useUpdateHelpCategory,
  useDeleteHelpCategory,
  useCreateHelpArticle,
  useUpdateHelpArticle,
  useDeleteHelpArticle,
  HelpCategory,
  HelpArticle,
} from "@/hooks/useHelpCenter";

interface CMSHelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CMSHelpCenterModal = ({ isOpen, onClose }: CMSHelpCenterModalProps) => {
  const [activeTab, setActiveTab] = useState("categories");
  const [editingCategory, setEditingCategory] = useState<HelpCategory | null>(null);
  const [editingArticle, setEditingArticle] = useState<(HelpArticle & { category?: HelpCategory }) | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "category" | "article"; id: string; name: string } | null>(null);

  // Form states
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    icon: "Package",
    display_order: 0,
    is_active: true,
  });

  const [articleForm, setArticleForm] = useState({
    title: "",
    slug: "",
    content: "",
    category_id: "",
    display_order: 0,
    is_active: true,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useHelpCategoriesAdmin();
  const { data: articles = [], isLoading: articlesLoading } = useHelpArticlesAdmin();

  const createCategory = useCreateHelpCategory();
  const updateCategory = useUpdateHelpCategory();
  const deleteCategory = useDeleteHelpCategory();
  const createArticle = useCreateHelpArticle();
  const updateArticle = useUpdateHelpArticle();
  const deleteArticle = useDeleteHelpArticle();

  const iconOptions = ["Rocket", "Package", "CreditCard", "Truck", "User", "Shield"];

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  // Category handlers
  const handleNewCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      slug: "",
      icon: "Package",
      display_order: categories.length + 1,
      is_active: true,
    });
    setShowCategoryForm(true);
  };

  const handleEditCategory = (category: HelpCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      icon: category.icon || "Package",
      display_order: category.display_order,
      is_active: category.is_active,
    });
    setShowCategoryForm(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    const slug = categoryForm.slug || generateSlug(categoryForm.name);

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory.id,
          ...categoryForm,
          slug,
        });
        toast.success("Categoria atualizada!");
      } else {
        await createCategory.mutateAsync({
          ...categoryForm,
          slug,
        });
        toast.success("Categoria criada!");
      }
      setShowCategoryForm(false);
      setEditingCategory(null);
    } catch (error) {
      toast.error("Erro ao salvar categoria");
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "category") return;
    try {
      await deleteCategory.mutateAsync(deleteConfirm.id);
      toast.success("Categoria excluída!");
      setDeleteConfirm(null);
    } catch (error) {
      toast.error("Erro ao excluir categoria");
    }
  };

  // Article handlers
  const handleNewArticle = () => {
    setEditingArticle(null);
    setArticleForm({
      title: "",
      slug: "",
      content: "",
      category_id: categories[0]?.id || "",
      display_order: 0,
      is_active: true,
    });
    setShowArticleForm(true);
  };

  const handleEditArticle = (article: HelpArticle & { category?: HelpCategory }) => {
    setEditingArticle(article);
    setArticleForm({
      title: article.title,
      slug: article.slug,
      content: article.content,
      category_id: article.category_id,
      display_order: article.display_order,
      is_active: article.is_active,
    });
    setShowArticleForm(true);
  };

  const handleSaveArticle = async () => {
    if (!articleForm.title.trim()) {
      toast.error("Título do artigo é obrigatório");
      return;
    }
    if (!articleForm.category_id) {
      toast.error("Selecione uma categoria");
      return;
    }
    if (!articleForm.content.trim()) {
      toast.error("Conteúdo do artigo é obrigatório");
      return;
    }

    const slug = articleForm.slug || generateSlug(articleForm.title);

    try {
      if (editingArticle) {
        await updateArticle.mutateAsync({
          id: editingArticle.id,
          ...articleForm,
          slug,
        });
        toast.success("Artigo atualizado!");
      } else {
        await createArticle.mutateAsync({
          ...articleForm,
          slug,
        });
        toast.success("Artigo criado!");
      }
      setShowArticleForm(false);
      setEditingArticle(null);
    } catch (error) {
      toast.error("Erro ao salvar artigo");
    }
  };

  const handleDeleteArticle = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "article") return;
    try {
      await deleteArticle.mutateAsync(deleteConfirm.id);
      toast.success("Artigo excluído!");
      setDeleteConfirm(null);
    } catch (error) {
      toast.error("Erro ao excluir artigo");
    }
  };

  const handleMoveCategory = async (category: HelpCategory, direction: "up" | "down") => {
    const currentIndex = categories.findIndex(c => c.id === category.id);
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    
    if (swapIndex < 0 || swapIndex >= categories.length) return;
    
    const swapCategory = categories[swapIndex];
    
    try {
      await updateCategory.mutateAsync({
        id: category.id,
        display_order: swapCategory.display_order,
      });
      await updateCategory.mutateAsync({
        id: swapCategory.id,
        display_order: category.display_order,
      });
    } catch (error) {
      toast.error("Erro ao reordenar");
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-[#6a1b9a]" />
              Central de Ajuda
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="categories">Categorias</TabsTrigger>
              <TabsTrigger value="articles">Artigos</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="flex-1 overflow-hidden">
              <ScrollArea className="h-[500px] pr-4">
                {showCategoryForm ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome *</Label>
                          <Input
                            value={categoryForm.name}
                            onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Ex: Começando na VM"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Slug (URL)</Label>
                          <Input
                            value={categoryForm.slug}
                            onChange={(e) => setCategoryForm(prev => ({ ...prev, slug: e.target.value }))}
                            placeholder="comecando-na-vm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Ícone</Label>
                          <Select
                            value={categoryForm.icon}
                            onValueChange={(value) => setCategoryForm(prev => ({ ...prev, icon: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {iconOptions.map(icon => (
                                <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Ordem</Label>
                          <Input
                            type="number"
                            value={categoryForm.display_order}
                            onChange={(e) => setCategoryForm(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={categoryForm.is_active}
                          onCheckedChange={(checked) => setCategoryForm(prev => ({ ...prev, is_active: checked }))}
                        />
                        <Label>Categoria ativa</Label>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button onClick={handleSaveCategory} disabled={createCategory.isPending || updateCategory.isPending}>
                          {(createCategory.isPending || updateCategory.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          <Save className="h-4 w-4 mr-2" />
                          Salvar
                        </Button>
                        <Button variant="outline" onClick={() => setShowCategoryForm(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <Button onClick={handleNewCategory} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Categoria
                    </Button>

                    {categoriesLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                    ) : categories.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">Nenhuma categoria cadastrada</div>
                    ) : (
                      <div className="space-y-2">
                        {categories.map((category, index) => (
                          <div
                            key={category.id}
                            className="flex items-center justify-between p-3 border rounded-lg bg-card"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => handleMoveCategory(category, "up")}
                                  disabled={index === 0}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => handleMoveCategory(category, "down")}
                                  disabled={index === categories.length - 1}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </div>
                              <div>
                                <p className="font-medium">{category.name}</p>
                                <p className="text-xs text-muted-foreground">/{category.slug}</p>
                              </div>
                              {!category.is_active && (
                                <span className="text-xs bg-muted px-2 py-0.5 rounded">Inativa</span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEditCategory(category)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: "category", id: category.id, name: category.name })}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="articles" className="flex-1 overflow-hidden">
              <ScrollArea className="h-[500px] pr-4">
                {showArticleForm ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {editingArticle ? "Editar Artigo" : "Novo Artigo"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Título *</Label>
                          <Input
                            value={articleForm.title}
                            onChange={(e) => setArticleForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Ex: Como criar sua loja"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Categoria *</Label>
                          <Select
                            value={articleForm.category_id}
                            onValueChange={(value) => setArticleForm(prev => ({ ...prev, category_id: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Slug (URL)</Label>
                          <Input
                            value={articleForm.slug}
                            onChange={(e) => setArticleForm(prev => ({ ...prev, slug: e.target.value }))}
                            placeholder="como-criar-sua-loja"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ordem</Label>
                          <Input
                            type="number"
                            value={articleForm.display_order}
                            onChange={(e) => setArticleForm(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Conteúdo *</Label>
                        <Textarea
                          value={articleForm.content}
                          onChange={(e) => setArticleForm(prev => ({ ...prev, content: e.target.value }))}
                          placeholder="Escreva o conteúdo do artigo..."
                          rows={10}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={articleForm.is_active}
                          onCheckedChange={(checked) => setArticleForm(prev => ({ ...prev, is_active: checked }))}
                        />
                        <Label>Artigo ativo</Label>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button onClick={handleSaveArticle} disabled={createArticle.isPending || updateArticle.isPending}>
                          {(createArticle.isPending || updateArticle.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          <Save className="h-4 w-4 mr-2" />
                          Salvar
                        </Button>
                        <Button variant="outline" onClick={() => setShowArticleForm(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <Button onClick={handleNewArticle} className="w-full" disabled={categories.length === 0}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Artigo
                    </Button>

                    {categories.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center">
                        Crie uma categoria primeiro
                      </p>
                    )}

                    {articlesLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                    ) : articles.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">Nenhum artigo cadastrado</div>
                    ) : (
                      <div className="space-y-2">
                        {articles.map((article) => (
                          <div
                            key={article.id}
                            className="flex items-center justify-between p-3 border rounded-lg bg-card"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{article.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {article.category?.name || "Sem categoria"}
                                </p>
                              </div>
                              {!article.is_active && (
                                <span className="text-xs bg-muted px-2 py-0.5 rounded">Inativo</span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEditArticle(article)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: "article", id: article.id, name: article.title })}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteConfirm?.name}"?
              {deleteConfirm?.type === "category" && (
                <span className="block mt-2 text-destructive font-medium">
                  Todos os artigos desta categoria também serão excluídos!
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteConfirm?.type === "category" ? handleDeleteCategory : handleDeleteArticle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CMSHelpCenterModal;
