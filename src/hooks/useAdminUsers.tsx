import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminUserPermissions {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
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

    const mappedUsers = (data || []).map((u) => ({
      ...u,
      permissions: (u.permissions as Record<string, boolean>) || {},
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
    permissions: Record<string, boolean>
  ) => {
    setSaving(true);
    
    // First create the user in auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (authError || !authData.user) {
      console.error("Error creating user:", authError);
      toast.error("Erro ao criar usuário: " + (authError?.message || "Erro desconhecido"));
      setSaving(false);
      return false;
    }

    // Then add admin role and permissions
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
    
    // Remove permissions
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

    // Remove admin role
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

  return { users, loading, saving, createUser, updateUser, deleteUser, refetch: fetchUsers };
};
