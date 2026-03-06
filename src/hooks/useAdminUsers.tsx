import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AdminUserPermissions {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role: string;
  permissions: Record<string, boolean>;
  created_at: string;
}

export const ADMIN_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "comando_ia", label: "Centro de Comando IA" },
  { key: "inteligencia_artificial", label: "Inteligência Artificial" },
  { key: "assinantes", label: "Assinantes" },
  { key: "faturas", label: "Faturas e Pagamentos" },
  { key: "automacoes", label: "Automações" },
  { key: "templates_marca", label: "Templates por Marca" },
  { key: "comunicacao", label: "Comunicação" },
  { key: "integracoes", label: "Integrações" },
  { key: "cms", label: "Gerenciador CMS" },
  { key: "biblioteca_midia", label: "Biblioteca de Mídia" },
  { key: "relatorios", label: "Relatórios" },
  { key: "suporte_lojista", label: "Suporte / Tickets – Painel Lojista" },
  { key: "configuracoes", label: "Configurações da Plataforma" },
];

export const ADMIN_ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "operador", label: "Operador" },
  { value: "suporte", label: "Suporte" },
  { value: "financeiro", label: "Financeiro" },
];

export const useAdminUsers = () => {
  const [users, setUsers] = useState<AdminUserPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_user_permissions")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching admin users:", error);
      setLoading(false);
      return;
    }

    // If admin_user_permissions is empty, try to sync from user_roles + profiles
    if (!data || data.length === 0) {
      console.warn("admin_user_permissions is empty, attempting sync from user_roles...");
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (roles && roles.length > 0) {
        const userIds = roles.map((r: any) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        for (const profile of (profiles || [])) {
          await supabase.from("admin_user_permissions").upsert({
            user_id: profile.id,
            full_name: profile.full_name || "Admin",
            email: "",
            is_active: true,
            role: "super_admin",
            permissions: {
              dashboard: true, comando_ia: true, inteligencia_artificial: true,
              assinantes: true, faturas: true, automacoes: true, templates_marca: true,
              comunicacao: true, integracoes: true, cms: true, biblioteca_midia: true,
              relatorios: true, suporte_lojista: true, configuracoes: true,
            },
          }, { onConflict: "user_id" });
        }

        // Re-fetch after sync
        const { data: syncedData } = await supabase
          .from("admin_user_permissions")
          .select("*")
          .order("created_at", { ascending: true });

        const syncedUsers = (syncedData || []).map((u: any) => ({
          ...u,
          permissions: (u.permissions as Record<string, boolean>) || {},
          role: u.role || "admin",
        }));
        setUsers(syncedUsers);
        setLoading(false);
        return;
      }
    }

    const mappedUsers = (data || []).map((u: any) => ({
      ...u,
      permissions: (u.permissions as Record<string, boolean>) || {},
      role: u.role || "admin",
    }));

    setUsers(mappedUsers);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = async (
    fullName: string,
    email: string,
    password: string,
    permissions: Record<string, boolean>,
    role: string = "admin"
  ) => {
    setSaving(true);
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (authError || !authData.user) {
      console.error("Error creating user:", authError);
      toast.error("Erro ao criar usuário: " + (authError?.message || "Erro desconhecido"));
      setSaving(false);
      return false;
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: authData.user.id, role: "admin" });

    if (roleError) {
      console.error("Error adding admin role:", roleError);
    }

    const { error: permError } = await supabase
      .from("admin_user_permissions")
      .insert({
        user_id: authData.user.id,
        full_name: fullName,
        email,
        is_active: true,
        role,
        permissions,
      });

    if (permError) {
      console.error("Error saving permissions:", permError);
      toast.error("Usuário criado, mas erro ao salvar permissões");
      setSaving(false);
      return false;
    }

    await fetchUsers();
    toast.success("Usuário criado com sucesso!");
    setSaving(false);
    return true;
  };

  const updateUser = async (
    id: string,
    updates: Partial<Omit<AdminUserPermissions, "id" | "user_id" | "created_at">>
  ) => {
    setSaving(true);
    const { error } = await supabase
      .from("admin_user_permissions")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Error updating user:", error);
      toast.error("Erro ao atualizar usuário");
      setSaving(false);
      return false;
    }

    await fetchUsers();
    toast.success("Usuário atualizado com sucesso!");
    setSaving(false);
    return true;
  };

  const deleteUser = async (id: string, userId: string) => {
    setSaving(true);
    
    const { error: permError } = await supabase
      .from("admin_user_permissions")
      .delete()
      .eq("id", id);

    if (permError) {
      console.error("Error deleting user permissions:", permError);
      toast.error("Erro ao remover usuário");
      setSaving(false);
      return false;
    }

    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "admin");

    await fetchUsers();
    toast.success("Usuário removido com sucesso!");
    setSaving(false);
    return true;
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    return updateUser(id, { is_active: !currentStatus });
  };

  return { users, loading, saving, createUser, updateUser, deleteUser, toggleUserStatus, refetch: fetchUsers };
};
