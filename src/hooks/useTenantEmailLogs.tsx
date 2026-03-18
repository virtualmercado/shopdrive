import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TenantEmailLog {
  id: string;
  tenant_id: string | null;
  destinatario: string;
  template: string | null;
  subject: string | null;
  status: string;
  erro: string | null;
  provider_source: string | null;
  email_remetente: string | null;
  smtp_provider: string | null;
  data_envio: string;
  sent_at: string | null;
  bcc_email: string | null;
}

export const useTenantEmailLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<TenantEmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "all",
    event: "all",
    recipient: "",
    dateFrom: "",
    dateTo: "",
  });

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from("email_logs")
        .select("*")
        .eq("tenant_id", user.id)
        .order("data_envio", { ascending: false })
        .limit(200);

      if (filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.event !== "all") {
        query = query.eq("template", filters.event);
      }
      if (filters.recipient) {
        query = query.ilike("destinatario", `%${filters.recipient}%`);
      }
      if (filters.dateFrom) {
        query = query.gte("data_envio", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("data_envio", `${filters.dateTo}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data || []) as TenantEmailLog[]);
    } catch (err) {
      console.error("Error fetching tenant email logs:", err);
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, filters, setFilters, refetch: fetchLogs };
};
