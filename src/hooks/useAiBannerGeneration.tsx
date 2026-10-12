import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiBannerStatus {
  ai_image_enabled: boolean;
  global_enabled?: boolean;
  store_enabled?: boolean;
  used_24h: number;
  quota_24h: number;
  remaining: number;
  model?: string;
}

export interface AiBannerGeneration {
  generation_id: string;
  desktop_url: string;
  mobile_url: string;
  normalized_sizes?: Record<string, string>;
  used_24h?: number;
  quota_24h?: number;
}

const invokeAi = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("generate-ai-image", { body: payload });
  if (error) {
    // A Edge Function devolve a mensagem amigável no corpo, inclusive em 403/429.
    let message = "Não foi possível criar a imagem agora.";
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        /* mantém mensagem padrão */
      }
    }
    throw new Error(message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data;
};

const FALLBACK_STATUS: AiBannerStatus = { ai_image_enabled: false, used_24h: 0, quota_24h: 3, remaining: 0 };

/** Geração de Hero por IA: sempre server-side, com preview antes de aplicar. */
export const useAiBannerGeneration = (storeId?: string) => {
  const queryClient = useQueryClient();
  const [generation, setGeneration] = useState<AiBannerGeneration | null>(null);
  const [busy, setBusy] = useState(false);
  const statusKey = ["ai-banner-status", storeId];

  // Status em cache por sessão: voltar ao passo mostra o estado já resolvido e revalida em segundo plano.
  const statusQuery = useQuery({
    queryKey: statusKey,
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return (await invokeAi({ action: "status", store_id: storeId })) as AiBannerStatus;
      } catch {
        return FALLBACK_STATUS;
      }
    },
  });
  const status = statusQuery.data ?? null;
  /** true enquanto a disponibilidade ainda não foi decidida (nunca tratar como bloqueio). */
  const statusLoading = !status;

  const loadStatus = async () => {
    if (!storeId) return null;
    await queryClient.invalidateQueries({ queryKey: statusKey });
    return (queryClient.getQueryData(statusKey) as AiBannerStatus | undefined) ?? null;
  };

  const generate = async (objective: string, additionalGuidance: string) => {
    if (!storeId) return null;
    setBusy(true);
    try {
      const data = (await invokeAi({
        action: "generate",
        store_id: storeId,
        objective,
        additional_guidance: additionalGuidance,
      })) as AiBannerGeneration;
      setGeneration(data);
      if (typeof data.used_24h === "number") {
        queryClient.setQueryData<AiBannerStatus>(statusKey, (prev) =>
          prev
            ? { ...prev, used_24h: data.used_24h!, remaining: Math.max(0, prev.quota_24h - data.used_24h!) }
            : prev
        );
      }
      return data;
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!storeId || !generation) return null;
    setBusy(true);
    try {
      const data = await invokeAi({
        action: "apply",
        store_id: storeId,
        generation_id: generation.generation_id,
      });
      setGeneration(null);
      return data;
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!storeId || !generation) return;
    setBusy(true);
    try {
      await invokeAi({
        action: "discard",
        store_id: storeId,
        generation_id: generation.generation_id,
      });
      setGeneration(null);
    } finally {
      setBusy(false);
    }
  };

  return { status, statusLoading, generation, busy, loadStatus, generate, apply, discard };
};
