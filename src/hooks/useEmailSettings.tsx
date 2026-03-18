import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PlatformEmailSettings {
  id: string;
  provider: string;
  sender_name: string;
  sender_email: string;
  reply_to: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_security: string | null;
  is_active: boolean;
  allow_tenant_custom_smtp: boolean;
}

export const useEmailSettings = () => {
  const [settings, setSettings] = useState<PlatformEmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_email_settings" as any)
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching email settings:", error);
    } else if (data) {
      setSettings(data as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (updates: Partial<PlatformEmailSettings>) => {
    if (!settings?.id) return false;
    setSaving(true);
    const { error } = await supabase
      .from("platform_email_settings" as any)
      .update(updates as any)
      .eq("id", settings.id);

    if (error) {
      toast.error("Erro ao salvar configurações de e-mail");
      setSaving(false);
      return false;
    }

    await fetchSettings();
    toast.success("Configurações de e-mail salvas!");
    setSaving(false);
    return true;
  };

  return { settings, loading, saving, saveSettings, refetch: fetchSettings };
};
