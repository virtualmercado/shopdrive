import { useAuthContext } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { customDomainPresentation } from "@/lib/customDomainStatus";
import { useMerchantStore } from "./useMerchantStore";

// Custom Domains V2: every write goes through server RPCs / the verify edge function.
// The browser never decides DNS, routing or SSL status.

export interface CustomDomainRecord { purpose: "root" | "www"; type: string; host: string; value: string | null }

export interface CustomDomainV2 {
  id: string;
  domain: string;
  /** Exact authorized host (preserves www) when the store has an exact pilot hostname. */
  display_hostname?: string | null;
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
  /** Server-computed reason when unavailable: global feature off, plan without the entitlement, or individual block. */
  unavailable_reason?: "feature" | "plan" | "blocked" | null;
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
  infrastructure_removal_pending: "A remoção do domínio anterior ainda está sendo concluída pela equipe ShopDrive. Tente novamente mais tarde.",
  protected_hostname: "Este domínio é gerenciado pela equipe ShopDrive. Fale com o suporte para alterá-lo.",
  cname_not_verified: "O registro CNAME do www ainda não aponta para domains.shopdrive.com.br. Confira o DNS e tente novamente.",
  resolver_unavailable: "O serviço de consulta DNS não respondeu. Tente novamente em alguns minutos.",
  cloudflare_writes_disabled: "A ativação de novos domínios está pausada no momento. Tente novamente mais tarde.",
  cloudflare_unavailable: "A configuração de segurança não respondeu agora. Tente novamente em alguns minutos.",
  credential_not_configured: "A configuração de segurança não está disponível agora. Tente novamente mais tarde.",
  provision_failed: "Não foi possível configurar o domínio agora. Tente novamente em alguns minutos.",
  external_hostname_conflict: "Este domínio já está configurado em outro lugar. Fale com o suporte.",
  domain_inactive: "Este domínio foi desconectado.",
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

async function invokeHostname(action: "create" | "status" | "delete", storeId?: string) {
  const { data, error } = await supabase.functions.invoke("manage-custom-domain-hostname", {
    body: storeId ? { action, store_id: storeId } : { action },
  });
  if (error) {
    let code = "";
    try { code = (await (error as { context?: Response }).context?.json())?.error ?? ""; } catch { /* ignore */ }
    throw new Error(code || error.message);
  }
  return data as { state?: string; v2_state?: string; external_removal?: string } | null;
}

/**
 * After the merchant explicitly verifies: once DNS is verified the server creates (idempotently) the
 * Custom Hostname; while routing/SSL are provisioning it only re-reads the real status.
 */
export async function verifyAndProvision(storeId?: string) {
  const verified = (await invokeVerify(storeId)) as { state?: string } | null;
  if (verified?.state === "dns_verified") return invokeHostname("create", storeId);
  if (verified?.state === "routing_provisioning" || verified?.state === "ssl_provisioning") return invokeHostname("status", storeId);
  return verified;
}

const disconnectMessage = (r: { external_removal?: string } | null | undefined) =>
  r?.external_removal === "pending_admin"
    ? "Domínio desconectado da loja. A remoção final na infraestrutura será concluída pela equipe ShopDrive."
    : "Domínio desconectado. Sua loja segue no endereço ShopDrive.";

export const useMerchantDomain = () => {
  const { storeId: userId, client, delegated, loading } = useMerchantStore();
  const qc = useQueryClient();
  const key = ["custom-domain-v2", userId];

  const overview = useQuery({
    queryKey: key,
    enabled: !!userId && !loading,
    queryFn: async () => {
      const { data, error } = delegated ? await client.rpc("get_my_selected_store_domain") : await client.rpc("get_my_custom_domain_v2");
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
      if (delegated) throw new Error("feature_unavailable");
      const { data, error } = await supabase.rpc("claim_custom_domain", { p_domain: domain });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { refresh(); toast.success("Domínio cadastrado. Agora confirme a propriedade."); },
    onError,
  });

  const regenerateChallenge = useMutation({
    mutationFn: async () => {
      if (delegated) throw new Error("feature_unavailable");
      const { error } = await supabase.rpc("regenerate_custom_domain_challenge");
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Novo código de verificação gerado."); },
    onError,
  });

  const verify = useMutation({
    mutationFn: () => { if (delegated) throw new Error("feature_unavailable"); return verifyAndProvision(); },
    onSuccess: () => refresh(),
    onError,
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (delegated) throw new Error("feature_unavailable");
      const { error } = await supabase.rpc("disconnect_custom_domain");
      if (!error) return null;
      // A provisioned Custom Hostname is retired server-side (resolver revoked first, removal per policy).
      if (error.message?.includes("infrastructure_removal_required")) return invokeHostname("delete");
      throw error;
    },
    onSuccess: (r) => { refresh(); toast.success(disconnectMessage(r)); },
    onError,
  });

  return {
    overview: overview.data,
    domain: overview.data?.domain ?? null,
    presentation: customDomainPresentation(overview.data?.domain),
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
      // Eligible stores are allowed by default; only an explicit row with enabled=false blocks the store.
      return { storeEnabled: a ? !!a.enabled : true, featureEnabled: !!c?.feature_enabled, ingressReady: !!c?.ingress_ready && !!c?.infrastructure_provider, provider: c?.infrastructure_provider ?? null };
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
      if (!error) return null;
      if (error.message?.includes("infrastructure_removal_required")) return invokeHostname("delete", storeId);
      throw error;
    },
    onSuccess: (r) => { invalidate(); toast.success(disconnectMessage(r)); },
    onError,
  });

  const setPilotAccess = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.rpc("admin_set_store_custom_domains_v2", { p_store_id: storeId!, p_enabled: enabled });
      if (error) throw error;
    },
    onSuccess: (_r, enabled) => { invalidate(); toast.success(enabled ? "Domínio próprio permitido para esta loja" : "Domínio próprio bloqueado para esta loja"); },
    onError,
  });

  return { domain, logs: logsQ.data, access: accessQ.data, isLoading: domainQ.isLoading, verifyDns, disconnect, setPilotAccess };
};
