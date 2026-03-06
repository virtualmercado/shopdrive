import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TenantEmailSettings {
  id: string;
  tenant_id: string;
  sender_name: string;
  sender_email: string;
  reply_to: string;
  email_domain: string;
  domain_status: string;
  spf_record: string;
  dkim_record: string;
  dmarc_record: string;
  spf_verified: boolean;
  dkim_verified: boolean;
  dmarc_verified: boolean;
  cloudflare_zone_id: string;
  last_verification_at: string | null;
}

export interface TenantDnsRecord {
  id: string;
  tenant_id: string;
  record_id_cloudflare: string;
  record_type: string;
  record_name: string;
  record_content: string;
  created_at: string;
}

export const useTenantEmailSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TenantEmailSettings | null>(null);
  const [dnsRecords, setDnsRecords] = useState<TenantDnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tenant_email_settings" as any)
        .select("*")
        .eq("tenant_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setSettings(data as any);

      // Fetch DNS records
      const { data: records, error: recErr } = await supabase
        .from("tenant_email_dns_records" as any)
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: true });

      if (!recErr) setDnsRecords((records || []) as any);
    } catch (err) {
      console.error("Error fetching tenant email settings:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (updates: Partial<TenantEmailSettings>) => {
    if (!user) return false;
    setSaving(true);
    try {
      // Generate DNS records if domain changed
      const domain = updates.email_domain || settings?.email_domain || "";
      const dnsData = domain
        ? {
            spf_record: `v=spf1 include:shopdrive.com.br ~all`,
            dkim_record: `shopdrive._domainkey.${domain}`,
            dmarc_record: `v=DMARC1; p=quarantine; rua=mailto:dmarc@shopdrive.com.br`,
          }
        : {};

      if (settings?.id) {
        const { error } = await supabase
          .from("tenant_email_settings" as any)
          .update({ ...updates, ...dnsData } as any)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_email_settings" as any)
          .insert({
            tenant_id: user.id,
            ...updates,
            ...dnsData,
          } as any);
        if (error) throw error;
      }

      await fetchSettings();
      toast.success("Configurações de e-mail salvas!");
      return true;
    } catch (err) {
      console.error("Error saving tenant email settings:", err);
      toast.error("Erro ao salvar configurações de e-mail");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const verifyDomain = async () => {
    if (!settings?.email_domain) {
      toast.error("Configure um domínio primeiro");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-tenant-email-dns", {
        body: { tenant_id: user?.id, domain: settings.email_domain },
      });

      if (error) throw error;

      await fetchSettings();
      if (data?.verified) {
        toast.success("Domínio verificado com sucesso!");
      } else {
        toast.info("Verificação em andamento. Configure os registros DNS indicados.");
      }
    } catch (err) {
      console.error("Error verifying domain:", err);
      toast.error("Erro ao verificar domínio");
    } finally {
      setVerifying(false);
    }
  };

  const createCloudflareRecords = async (zoneId: string) => {
    if (!settings?.email_domain || !user) {
      toast.error("Configure o domínio primeiro");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("verify-tenant-email-dns", {
        body: {
          tenant_id: user.id,
          domain: settings.email_domain,
          action: "create_cloudflare",
          cloudflare_zone_id: zoneId,
        },
      });

      if (error) throw error;

      await fetchSettings();
      toast.success("Registros DNS criados no Cloudflare!");
    } catch (err) {
      console.error("Error creating Cloudflare records:", err);
      toast.error("Erro ao criar registros no Cloudflare");
    }
  };

  return {
    settings,
    dnsRecords,
    loading,
    saving,
    verifying,
    saveSettings,
    verifyDomain,
    createCloudflareRecords,
    refetch: fetchSettings,
  };
};
