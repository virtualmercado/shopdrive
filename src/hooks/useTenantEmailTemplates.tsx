import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TenantEmailTemplate {
  id: string;
  tenant_id: string;
  event_key: string;
  subject: string;
  html_body: string;
  text_body: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const TENANT_EMAIL_EVENTS = [
  { key: "user_welcome", label: "Boas-vindas", description: "Enviado ao novo usuário ao se cadastrar" },
  { key: "account_created", label: "Conta Criada", description: "Confirmação de criação de conta" },
  { key: "access_invite", label: "Convite de Acesso", description: "Convite para acessar a loja" },
  { key: "password_recovery", label: "Recuperação de Senha", description: "Link para redefinir a senha" },
  { key: "password_reset_confirmed", label: "Senha Redefinida", description: "Confirmação de alteração de senha" },
  { key: "account_activated", label: "Conta Ativada", description: "Conta do usuário foi ativada" },
  { key: "account_deactivated", label: "Conta Desativada", description: "Conta do usuário foi desativada" },
  { key: "email_changed", label: "E-mail Alterado", description: "Confirmação de alteração de e-mail" },
  { key: "security_login", label: "Login de Segurança", description: "Alerta de novo login detectado" },
  { key: "ticket_created", label: "Ticket Criado", description: "Novo ticket de suporte aberto" },
  { key: "ticket_resolved", label: "Ticket Resolvido", description: "Ticket de suporte foi resolvido" },
  { key: "subscription_expiring", label: "Assinatura Expirando", description: "Aviso de expiração da assinatura" },
  { key: "payment_confirmed", label: "Pagamento Confirmado", description: "Confirmação de pagamento recebido" },
  { key: "payment_failed", label: "Falha no Pagamento", description: "Notificação de falha no pagamento" },
  { key: "subscription_expired", label: "Assinatura Expirada", description: "Assinatura expirou" },
];

export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  user_welcome: ["{{user_name}}", "{{store_name}}", "{{login_url}}"],
  account_created: ["{{user_name}}", "{{email}}", "{{store_name}}"],
  access_invite: ["{{user_name}}", "{{invite_url}}", "{{store_name}}"],
  password_recovery: ["{{user_name}}", "{{reset_link}}", "{{expiry_time}}"],
  password_reset_confirmed: ["{{user_name}}", "{{date}}"],
  account_activated: ["{{user_name}}", "{{store_name}}"],
  account_deactivated: ["{{user_name}}", "{{reason}}"],
  email_changed: ["{{user_name}}", "{{old_email}}", "{{new_email}}"],
  security_login: ["{{user_name}}", "{{ip_address}}", "{{device}}", "{{date}}"],
  ticket_created: ["{{user_name}}", "{{ticket_number}}", "{{subject}}"],
  ticket_resolved: ["{{user_name}}", "{{ticket_number}}", "{{resolution}}"],
  subscription_expiring: ["{{user_name}}", "{{plan_name}}", "{{expiry_date}}", "{{renew_url}}"],
  payment_confirmed: ["{{user_name}}", "{{amount}}", "{{payment_method}}", "{{date}}"],
  payment_failed: ["{{user_name}}", "{{amount}}", "{{reason}}", "{{retry_url}}"],
  subscription_expired: ["{{user_name}}", "{{plan_name}}", "{{renew_url}}"],
};

export const useTenantEmailTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TenantEmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tenant_email_templates")
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTemplates((data || []) as TenantEmailTemplate[]);
    } catch (err) {
      console.error("Error fetching tenant email templates:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const upsertTemplate = async (eventKey: string, updates: Partial<TenantEmailTemplate>) => {
    if (!user) return false;
    setSaving(true);
    try {
      const existing = templates.find((t) => t.event_key === eventKey);
      if (existing) {
        const { error } = await supabase
          .from("tenant_email_templates")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_email_templates")
          .insert({
            tenant_id: user.id,
            event_key: eventKey,
            subject: updates.subject || "",
            html_body: updates.html_body || "",
            text_body: updates.text_body || "",
            is_enabled: updates.is_enabled ?? true,
          });
        if (error) throw error;
      }
      await fetchTemplates();
      toast.success("Template salvo com sucesso!");
      return true;
    } catch (err) {
      console.error("Error saving tenant email template:", err);
      toast.error("Erro ao salvar template");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleTemplate = async (eventKey: string, enabled: boolean) => {
    return upsertTemplate(eventKey, { is_enabled: enabled });
  };

  const deleteTemplate = async (id: string) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from("tenant_email_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await fetchTemplates();
      toast.success("Template removido!");
      return true;
    } catch (err) {
      console.error("Error deleting tenant email template:", err);
      toast.error("Erro ao remover template");
      return false;
    }
  };

  return { templates, loading, saving, upsertTemplate, toggleTemplate, deleteTemplate, refetch: fetchTemplates };
};
