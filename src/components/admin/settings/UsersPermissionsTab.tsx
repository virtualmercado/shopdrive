import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Plus, Users, Pencil, Trash2, Search, Eye, MoreHorizontal, KeyRound, Power } from "lucide-react";
import { useAdminUsers, ADMIN_MODULES, ADMIN_ROLES } from "@/hooks/useAdminUsers";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";

const UsersPermissionsTab = () => {
  const { users, loading, saving, createUser, updateUser, deleteUser, toggleUserStatus } = useAdminUsers();
  const [showModal, setShowModal] = useState(false);
  const [viewUser, setViewUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "admin",
    permissions: {} as Record<string, boolean>,
  });

  const resetForm = () => {
    setFormData({ full_name: "", email: "", password: "", role: "admin", permissions: {} });
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingUser(null);
    setShowModal(true);
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      password: "",
      role: user.role || "admin",
      permissions: user.permissions || {},
    });
    setShowModal(true);
  };

  const handleTogglePermission = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }));
  };

  const handleSelectAll = () => {
    const allSelected = ADMIN_MODULES.every((m) => formData.permissions[m.key]);
    const newPermissions: Record<string, boolean> = {};
    ADMIN_MODULES.forEach((m) => { newPermissions[m.key] = !allSelected; });
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
        role: formData.role,
        permissions: formData.permissions,
      });
      if (success) { setShowModal(false); resetForm(); }
    } else {
      if (!formData.password || formData.password.length < 6) {
        toast.error("Senha deve ter pelo menos 6 caracteres");
        return;
      }
      const success = await createUser(formData.full_name, formData.email, formData.password, formData.permissions, formData.role);
      if (success) { setShowModal(false); resetForm(); }
    }
  };

  const handleDelete = async (user: any) => {
    if (confirm(`Tem certeza que deseja remover ${user.full_name}?`)) {
      await deleteUser(user.id, user.user_id);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = !searchQuery ||
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = filterRole === "all" || u.role === filterRole;
      const matchStatus = filterStatus === "all" ||
        (filterStatus === "active" && u.is_active) ||
        (filterStatus === "inactive" && !u.is_active);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, filterRole, filterStatus]);

  const getRoleLabel = (role: string) => ADMIN_ROLES.find((r) => r.value === role)?.label || role;

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-72 mt-2" /></CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-[#6a1b9a]" />
              <div>
                <CardTitle>Usuários e Permissões</CardTitle>
                <CardDescription>Gerenciamento de usuários internos do Painel Master</CardDescription>
              </div>
            </div>
            <Dialog open={showModal} onOpenChange={setShowModal}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenAdd} className="bg-[#6a1b9a] hover:bg-[#5a1589]">
                  <Plus className="h-4 w-4 mr-2" /> Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
                  <DialogDescription>
                    {editingUser ? "Atualize as informações e permissões" : "Preencha os dados para criar um novo usuário"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Nome Completo</Label>
                      <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))} placeholder="Nome do usuário" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" disabled={!!editingUser} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Perfil / Função</Label>
                      <Select value={formData.role} onValueChange={(v) => setFormData((p) => ({ ...p, role: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ADMIN_ROLES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    {!editingUser && (
                      <div className="space-y-2">
                        <Label htmlFor="password">Senha Temporária</Label>
                        <Input id="password" type="password" value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Permissões por Módulo</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
                        {ADMIN_MODULES.every((m) => formData.permissions[m.key]) ? "Desmarcar Todos" : "Selecionar Todos"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg">
                      {ADMIN_MODULES.map((module) => (
                        <div key={module.key} className="flex items-center space-x-2">
                          <Checkbox id={module.key} checked={formData.permissions[module.key] || false} onCheckedChange={() => handleTogglePermission(module.key)} />
                          <Label htmlFor={module.key} className="text-sm cursor-pointer">{module.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={saving} className="bg-[#6a1b9a] hover:bg-[#5a1589]">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editingUser ? "Salvar Alterações" : "Criar Usuário"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou e-mail..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Perfil" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os perfis</SelectItem>
                {ADMIN_ROLES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#6a1b9a]/10 flex items-center justify-center">
                            <span className="text-[#6a1b9a] font-semibold text-sm">{user.full_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="font-medium">{user.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell><Badge variant="outline">{getRoleLabel(user.role)}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "default" : "secondary"}>{user.is_active ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(user.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewUser(user)}>
                              <Eye className="h-4 w-4 mr-2" /> Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenEdit(user)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleUserStatus(user.id, user.is_active)}>
                              <Power className="h-4 w-4 mr-2" /> {user.is_active ? "Desativar" : "Ativar"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Funcionalidade de redefinição de senha será integrada ao serviço de e-mail.")}>
                              <KeyRound className="h-4 w-4 mr-2" /> Redefinir Senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(user)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View User Dialog */}
      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground text-xs">Nome</Label><p className="font-medium">{viewUser.full_name}</p></div>
                <div><Label className="text-muted-foreground text-xs">E-mail</Label><p className="font-medium">{viewUser.email}</p></div>
                <div><Label className="text-muted-foreground text-xs">Perfil</Label><p><Badge variant="outline">{getRoleLabel(viewUser.role)}</Badge></p></div>
                <div><Label className="text-muted-foreground text-xs">Status</Label><p><Badge variant={viewUser.is_active ? "default" : "secondary"}>{viewUser.is_active ? "Ativo" : "Inativo"}</Badge></p></div>
                <div><Label className="text-muted-foreground text-xs">Criado em</Label><p className="text-sm">{format(new Date(viewUser.created_at), "dd/MM/yyyy HH:mm")}</p></div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Permissões</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {ADMIN_MODULES.filter((m) => viewUser.permissions?.[m.key]).map((m) => (
                    <Badge key={m.key} variant="secondary" className="text-xs">{m.label}</Badge>
                  ))}
                  {ADMIN_MODULES.filter((m) => viewUser.permissions?.[m.key]).length === 0 && (
                    <span className="text-sm text-muted-foreground">Nenhuma permissão atribuída</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UsersPermissionsTab;
