import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Users, Pencil, Trash2 } from "lucide-react";
import { useAdminUsers, ADMIN_MODULES } from "@/hooks/useAdminUsers";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const UsersPermissionsTab = () => {
  const { users, loading, saving, createUser, updateUser, deleteUser } = useAdminUsers();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    permissions: {} as Record<string, boolean>,
  });

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      password: "",
      permissions: {},
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingUser(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      password: "",
      permissions: user.permissions || {},
    });
    setShowAddModal(true);
  };

  const handleTogglePermission = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      },
    }));
  };

  const handleSelectAll = () => {
    const allSelected = ADMIN_MODULES.every((m) => formData.permissions[m.key]);
    const newPermissions: Record<string, boolean> = {};
    ADMIN_MODULES.forEach((m) => {
      newPermissions[m.key] = !allSelected;
    });
    setFormData((prev) => ({ ...prev, permissions: newPermissions }));
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.email) {
      toast.error("Preencha nome e e-mail");
      return;
    }

    if (editingUser) {
      const success = await updateUser(editingUser.id, {
        full_name: formData.full_name,
        email: formData.email,
        permissions: formData.permissions,
      });
      if (success) {
        setShowAddModal(false);
        resetForm();
      }
    } else {
      if (!formData.password || formData.password.length < 6) {
        toast.error("Senha deve ter pelo menos 6 caracteres");
        return;
      }
      const success = await createUser(
        formData.full_name,
        formData.email,
        formData.password,
        formData.permissions
      );
      if (success) {
        setShowAddModal(false);
        resetForm();
      }
    }
  };

  const handleDelete = async (user: any) => {
    if (confirm(`Tem certeza que deseja remover ${user.full_name}?`)) {
      await deleteUser(user.id, user.user_id);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-[#6a1b9a]" />
            <div>
              <CardTitle>Usuários e Permissões</CardTitle>
              <CardDescription>
                Gerenciamento de usuários internos do Painel Master
              </CardDescription>
            </div>
          </div>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenAdd} className="bg-[#6a1b9a] hover:bg-[#5a1589]">
                <Plus className="h-4 w-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Editar Usuário" : "Novo Usuário"}
                </DialogTitle>
                <DialogDescription>
                  {editingUser
                    ? "Atualize as informações e permissões do usuário"
                    : "Preencha os dados para criar um novo usuário administrador"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome Completo</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, full_name: e.target.value }))
                      }
                      placeholder="Nome do usuário"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, email: e.target.value }))
                      }
                      placeholder="email@exemplo.com"
                      disabled={!!editingUser}
                    />
                  </div>
                </div>

                {!editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, password: e.target.value }))
                      }
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Permissões por Módulo</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      {ADMIN_MODULES.every((m) => formData.permissions[m.key])
                        ? "Desmarcar Todos"
                        : "Selecionar Todos"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg">
                    {ADMIN_MODULES.map((module) => (
                      <div
                        key={module.key}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={module.key}
                          checked={formData.permissions[module.key] || false}
                          onCheckedChange={() => handleTogglePermission(module.key)}
                        />
                        <Label htmlFor={module.key} className="text-sm cursor-pointer">
                          {module.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#6a1b9a] hover:bg-[#5a1589]"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingUser ? "Salvar Alterações" : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum usuário administrador cadastrado.</p>
            <p className="text-sm">Clique em "Novo Usuário" para adicionar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#6a1b9a]/10 flex items-center justify-center">
                    <span className="text-[#6a1b9a] font-semibold">
                      {user.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.full_name}</p>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(user)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(user)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UsersPermissionsTab;
