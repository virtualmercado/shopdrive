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
  { key: "order_confirmation", label: "Confirmação de Pedido" },
  { key: "order_shipped", label: "Pedido Enviado" },
  { key: "order_delivered", label: "Pedido Entregue" },
  { key: "welcome_customer", label: "Boas-vindas ao Cliente" },
  { key: "password_reset", label: "Recuperação de Senha" },
  { key: "payment_confirmed", label: "Pagamento Confirmado" },
  { key: "payment_failed", label: "Falha no Pagamento" },
  { key: "quote_created", label: "Orçamento Criado" },
  { key: "abandoned_cart", label: "Carrinho Abandonado" },
];

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
