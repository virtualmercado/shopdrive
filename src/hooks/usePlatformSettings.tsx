import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PlatformSettings {
  platform_name: string;
  company_name: string;
  cnpj: string;
  state_registration: string;
  full_address: string;
  zip_code: string;
  city: string;
  state: string;
  institutional_email: string;
  institutional_phone: string;
}

interface SupportChannel {
  id: string;
  channel_type: string;
  channel_name: string;
  phone_number: string;
  operating_hours: string;
  default_message: string;
  is_active: boolean;
}

export const usePlatformSettings = () => {
  const [settings, setSettings] = useState<PlatformSettings>({
    platform_name: "",
    company_name: "",
    cnpj: "",
    state_registration: "",
    full_address: "",
    zip_code: "",
    city: "",
    state: "",
    institutional_email: "",
    institutional_phone: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_settings")
      .select("setting_key, setting_value");

    if (error) {
      console.error("Error fetching platform settings:", error);
      setLoading(false);
      return;
    }

    const settingsMap: Record<string, string> = {};
    data?.forEach((item) => {
      settingsMap[item.setting_key] = item.setting_value || "";
    });

    setSettings({
      platform_name: settingsMap.platform_name || "",
      company_name: settingsMap.company_name || "",
      cnpj: settingsMap.cnpj || "",
      state_registration: settingsMap.state_registration || "",
      full_address: settingsMap.full_address || "",
      zip_code: settingsMap.zip_code || "",
      city: settingsMap.city || "",
      state: settingsMap.state || "",
      institutional_email: settingsMap.institutional_email || "",
      institutional_phone: settingsMap.institutional_phone || "",
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: string, value: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ setting_value: value })
      .eq("setting_key", key);

    if (error) {
      console.error("Error updating setting:", error);
      toast.error("Erro ao salvar configuração");
      setSaving(false);
      return false;
    }

    setSettings((prev) => ({ ...prev, [key]: value }));
    toast.success("Configuração salva com sucesso!");
    setSaving(false);
    return true;
  };

  const saveAllSettings = async (newSettings: PlatformSettings) => {
    setSaving(true);
    const updates = Object.entries(newSettings).map(([key, value]) =>
      supabase
        .from("platform_settings")
        .update({ setting_value: value })
        .eq("setting_key", key)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      toast.error("Erro ao salvar algumas configurações");
      setSaving(false);
      return false;
    }

    setSettings(newSettings);
    toast.success("Configurações salvas com sucesso!");
    setSaving(false);
    return true;
  };

  return { settings, loading, saving, updateSetting, saveAllSettings, refetch: fetchSettings };
};

export const useSupportChannels = () => {
  const [channels, setChannels] = useState<SupportChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_channels")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching support channels:", error);
      setLoading(false);
      return;
    }

    setChannels(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const updateChannel = async (id: string, updates: Partial<SupportChannel>) => {
    setSaving(true);
    const { error } = await supabase
      .from("support_channels")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Error updating channel:", error);
      toast.error("Erro ao salvar canal");
      setSaving(false);
      return false;
    }

    await fetchChannels();
    toast.success("Canal atualizado com sucesso!");
    setSaving(false);
    return true;
  };

  return { channels, loading, saving, updateChannel, refetch: fetchChannels };
};

export const useWhatsAppChannel = () => {
  const [channel, setChannel] = useState<SupportChannel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChannel = async () => {
      const { data, error } = await supabase
        .from("support_channels")
        .select("*")
        .eq("channel_type", "whatsapp")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching WhatsApp channel:", error);
      }

      setChannel(data || null);
      setLoading(false);
    };

    fetchChannel();
  }, []);

  const generateWhatsAppLink = (variables?: Record<string, string>) => {
    if (!channel?.phone_number) return null;

    let message = channel.default_message || "";
    
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(new RegExp(`{{${key}}}`, "g"), value);
      });
    }

    const cleanPhone = channel.phone_number.replace(/\D/g, "");
    const encodedMessage = encodeURIComponent(message);
    
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  };

  return { channel, loading, generateWhatsAppLink };
};
