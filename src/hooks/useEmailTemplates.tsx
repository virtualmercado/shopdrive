import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmailTemplate {
  id: string;
  name: string;
  event_trigger: string;
  subject: string;
  pre_header: string;
  html_content: string;
  text_content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailSendLog {
  id: string;
  template_id: string | null;
  template_name: string | null;
  recipient_email: string;
  subject: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export const DYNAMIC_VARIABLES = [
  "{{user_name}}", "{{user_email}}", "{{platform_name}}", "{{reset_link}}",
  "{{login_link}}", "{{temporary_password}}", "{{support_email}}",
  "{{ticket_number}}", "{{plan_name}}", "{{due_date}}", "{{amount}}", "{{company_name}}"
];

export const useEmailTemplates = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailSendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching email templates:", error);
      setLoading(false);
      return;
    }

    const mapped = (data || []).map((t: any) => ({
      ...t,
      variables: Array.isArray(t.variables) ? t.variables : [],
      pre_header: t.pre_header || "",
      html_content: t.html_content || "",
      text_content: t.text_content || "",
    }));

    setTemplates(mapped);
    setLoading(false);
  }, []);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("email_send_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data as EmailSendLog[]) || []);
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchLogs();
  }, [fetchTemplates, fetchLogs]);

  const updateTemplate = async (id: string, updates: Partial<EmailTemplate>) => {
    setSaving(true);
    const { error } = await supabase
      .from("email_templates")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar template");
      setSaving(false);
      return false;
    }

    await fetchTemplates();
    toast.success("Template atualizado!");
    setSaving(false);
    return true;
  };

  const duplicateTemplate = async (template: EmailTemplate) => {
    setSaving(true);
    const { error } = await supabase.from("email_templates").insert({
      name: template.name + " (Cópia)",
      event_trigger: template.event_trigger + "_copy",
      subject: template.subject,
      pre_header: template.pre_header,
      html_content: template.html_content,
      text_content: template.text_content,
      variables: template.variables,
      is_active: false,
    });

    if (error) {
      toast.error("Erro ao duplicar template");
      setSaving(false);
      return false;
    }

    await fetchTemplates();
    toast.success("Template duplicado!");
    setSaving(false);
    return true;
  };

  const logSend = async (templateId: string, templateName: string, recipientEmail: string, subject: string, status: string, errorMessage?: string) => {
    await supabase.from("email_send_logs").insert({
      template_id: templateId,
      template_name: templateName,
      recipient_email: recipientEmail,
      subject,
      status,
      error_message: errorMessage || null,
    });
    await fetchLogs();
  };

  return { templates, logs, loading, saving, updateTemplate, duplicateTemplate, logSend, refetch: fetchTemplates };
};
