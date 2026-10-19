import { useAuthContext } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Custom Domains V2: every write goes through server RPCs / the verify edge function.
// The browser never decides DNS, routing or SSL status.

export interface CustomDomainRecord { purpose: "root" | "www"; type: string; host: string; value: string | null }

export interface CustomDomainV2 {
  id: string;
  domain: string;
  flow_version: number;
  state: string | null;
  txt_host: string | null;
  txt_value: string | null;
  verification_expires_at: string | null;
  ownership_verified_at: string | null;
  dns_verified_at: string | null;
  dns_provider: string | null;
  detected_nameservers: string[];
  routing_status: string;
  ssl_status: string;
  last_dns_check: string | null;
  last_result: {
    ownership?: string; root?: string; www?: string; notes?: string[];
    provider?: { slug: string; name: string } | null; nameservers?: string[];
  } | null;
  needs_reverification: boolean;
  released: boolean;
  active: boolean;
}

export interface CustomDomainOverview {
  available: boolean;
  ingress_ready: boolean;
  purchase_url: string | null;
  records: CustomDomainRecord[];
  domain: CustomDomainV2 | null;
}

export interface DomainProviderTutorial {
  id: string;
  provider_name: string;
  provider_slug: string;
  display_order: number;
  is_active: boolean;
  tutorial_content: { steps: Array<{ title: string; content: string }> };
}

const ERRORS: Record<string, string> = {
  feature_unavailable: "Domínio próprio temporariamente indisponível.",
  invalid_domain: "Informe um domínio válido, por exemplo: seudominio.com.br",
  reserved_domain: "Este domínio é reservado e não pode ser usado.",
  domain_taken: "Este domínio já está vinculado a outra loja da ShopDrive.",
  disconnect_active_domain_first: "Desconecte o domínio atual antes de cadastrar outro.",
  ownership_already_verified: "A propriedade deste domínio já foi confirmada.",
  infrastructure_removal_required: "Este domínio precisa ser removido da infraestrutura antes de desconectar.",
  domain_not_found: "Nenhum domínio cadastrado.",
  store_not_found: "Loja não encontrada.",
};

export const customDomainErrorMessage = (e: unknown) => {
  const raw = (e as { message?: string })?.message ?? "";
  const key = Object.keys(ERRORS).find((k) => raw.includes(k));
  return key ? ERRORS[key] : "Não foi possível concluir. Tente novamente.";
};

async function invokeVerify(storeId?: string) {
  const { data, error } = await supabase.functions.invoke("verify-custom-domain-dns", { body: storeId ? { store_id: storeId } : {} });
  if (error) {
    let code = "";
    try { code = (await (error as { context?: Response }).context?.json())?.error ?? ""; } catch { /* ignore */ }
    throw new Error(code || error.message);
  }
  return data;
}

export const useMerchantDomain = () => {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const key = ["custom-domain-v2", userId];

  const overview = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_custom_domain_v2");
      if (error) throw error;
      return data as unknown as CustomDomainOverview;
    },
  });

  const tutorials = useQuery({
    queryKey: ["domain-tutorials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("domain_provider_tutorials").select("*").eq("is_active", true).order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as DomainProviderTutorial[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const onError = (e: unknown) => toast.error(customDomainErrorMessage(e));

  const claimDomain = useMutation({
    mutationFn: async (domain: string) => {
      const { data, error } = await supabase.rpc("claim_custom_domain", { p_domain: domain });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { refresh(); toast.success("Domínio cadastrado. Agora confirme a propriedade."); },
    onError,
  });

  const regenerateChallenge = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("regenerate_custom_domain_challenge");
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Novo código de verificação gerado."); },
    onError,
  });

  const verify = useMutation({
    mutationFn: () => invokeVerify(),
    onSuccess: () => refresh(),
    onError,
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("disconnect_custom_domain");
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Domínio desconectado. Sua loja segue no endereço ShopDrive."); },
    onError,
  });

  return {
    overview: overview.data,
    domain: overview.data?.domain ?? null,
    isLoading: overview.isLoading,
    loadError: overview.error,
    tutorials: tutorials.data,
    claimDomain,
    regenerateChallenge,
    verify,
    disconnect,
  };
};

export const useAdminDomains = (storeId?: string) => {
  const qc = useQueryClient();

  const domainQ = useQuery({
    queryKey: ["admin-store-domain", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("merchant_domains").select("*").eq("merchant_id", storeId!)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const domain = domainQ.data;

  const accessQ = useQuery({
    queryKey: ["admin-store-domain-access", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const [{ data: a }, { data: c }] = await Promise.all([
        supabase.from("custom_domain_v2_access").select("enabled").eq("store_id", storeId!).maybeSingle(),
        supabase.from("custom_domain_platform_config").select("feature_enabled, ingress_ready, infrastructure_provider").eq("id", true).maybeSingle(),
      ]);
      return { storeEnabled: !!a?.enabled, featureEnabled: !!c?.feature_enabled, ingressReady: !!c?.ingress_ready && !!c?.infrastructure_provider, provider: c?.infrastructure_provider ?? null };
    },
  });

  const logsQ = useQuery({
    queryKey: ["admin-domain-logs", domain?.id],
    enabled: !!domain?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("domain_verification_logs").select("*").eq("domain_id", domain!.id)
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-store-domain", storeId] });
    qc.invalidateQueries({ queryKey: ["admin-domain-logs"] });
    qc.invalidateQueries({ queryKey: ["admin-store-domain-access", storeId] });
  };
  const onError = (e: unknown) => toast.error(customDomainErrorMessage(e));

  const verifyDns = useMutation({
    mutationFn: () => invokeVerify(storeId),
    onSuccess: () => { invalidate(); toast.success("Verificação DNS real concluída"); },
    onError,
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_disconnect_custom_domain", { p_store_id: storeId! });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Domínio desconectado"); },
    onError,
  });

  const setPilotAccess = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.rpc("admin_set_store_custom_domains_v2", { p_store_id: storeId!, p_enabled: enabled });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Liberação atualizada"); },
    onError,
  });

  return { domain, logs: logsQ.data, access: accessQ.data, isLoading: domainQ.isLoading, verifyDns, disconnect, setPilotAccess };
};
