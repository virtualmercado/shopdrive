import { supabase } from "@/integrations/supabase/client";
import { normalizeStoreLayout } from "@/lib/storeLayout";
import type { ColorPalette } from "@/lib/storePalettes";

/**
 * Persistência oficial da identidade visual (paleta + layout).
 * Mesmos campos gravados pelo menu Personalizar — usada também pelo
 * provisionamento inicial do onboarding. Não altera entitlement de plano.
 */
export async function persistStorePalette(userId: string, colors: ColorPalette["colors"]) {
  const { error } = await supabase
    .from("profiles")
    .update({
      primary_color: colors.primary,
      secondary_color: colors.headerBg,
      footer_text_color: colors.headerText,
      button_bg_color: colors.buttonBg,
      button_text_color: colors.buttonText,
      topbar_bg_color: colors.topBarBg,
      topbar_text_color: colors.topBarText,
    })
    .eq("id", userId);
  if (error) throw error;
}

export async function persistStoreLayout(userId: string, layoutId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ store_layout: normalizeStoreLayout(layoutId) })
    .eq("id", userId);
  if (error) throw error;
}

export interface ApplyIdentityResult {
  authorized: boolean;
  reason?: string;
  applications?: number;
}

/**
 * Aplica a identidade recomendada durante o onboarding.
 * A autorização (e o limite de aplicações) é decidida no backend.
 */
export async function applyOnboardingIdentity(
  userId: string,
  palette: ColorPalette,
  layoutId: string,
  contextHash: string | null
): Promise<ApplyIdentityResult> {
  const { data, error } = await supabase.rpc("authorize_onboarding_identity_application", {
    p_store_id: userId,
    p_palette_id: palette.id,
    p_layout_id: normalizeStoreLayout(layoutId),
    p_context_hash: contextHash,
  });
  if (error) throw error;
  const result = (data ?? {}) as unknown as ApplyIdentityResult;
  if (!result.authorized) return result;

  await persistStorePalette(userId, palette.colors);
  await persistStoreLayout(userId, layoutId);
  return result;
}
