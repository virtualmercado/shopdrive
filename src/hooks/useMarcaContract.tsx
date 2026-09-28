import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Read-only hooks for the MARCA upgrade flow. Not wired to any screen yet. */
export interface MarcaContract {
  version: string;
  title: string;
  content: string;
  acceptance_statement: string;
  contract_hash: string;
  published_at: string;
  commercial: { plan_name: string; monthly_price: number; annual_discount_percent: number };
}

type Result<T> = { status: "ok"; data: T } | { status: "unavailable" | "selection_required" | "admin_required" | "denied" | "error"; message: string };

const SAFE_DENIED = "Você não tem acesso a esta etapa.";
const SAFE_ERROR = "Não foi possível carregar agora. Tente novamente.";

export function useMarcaContract() {
  const [loading, setLoading] = useState(false);

  const prepareBrandAccount = useCallback(async (displayName?: string): Promise<Result<{ brandAccountId: string; displayName: string; created: boolean }>> => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("prepare_my_marca_brand_account", { p_display_name: displayName ?? null });
      if (error) {
        if (error.code === "42501") return { status: "denied", message: SAFE_DENIED };
        if (error.code === "22023") return { status: "error", message: error.message };
        return { status: "error", message: SAFE_ERROR };
      }
      if (data?.status === "created" || data?.status === "reused") {
        return { status: "ok", data: { brandAccountId: data.brand_account_id, displayName: data.display_name, created: data.status === "created" } };
      }
      return { status: data?.status ?? "error", message: data?.message ?? SAFE_ERROR };
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContract = useCallback(async (brandAccountId?: string): Promise<Result<MarcaContract>> => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("get_current_marca_contract", { p_brand_account_id: brandAccountId ?? null });
      if (error) return error.code === "42501" ? { status: "denied", message: SAFE_DENIED } : { status: "error", message: SAFE_ERROR };
      if (data?.status === "ok") {
        const { status: _s, ...rest } = data;
        return { status: "ok", data: rest as MarcaContract };
      }
      return { status: data?.status ?? "error", message: data?.message ?? SAFE_ERROR };
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, prepareBrandAccount, loadContract };
}
