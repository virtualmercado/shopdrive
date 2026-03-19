import { supabase } from '@/integrations/supabase/client';

type TemplateSyncContext = 'force-sync' | 'open-preview' | 'preview-route' | 'template-save';

interface SyncTemplatePreviewStateOptions {
  context?: TemplateSyncContext;
  forceSync?: boolean;
  enforceCompleteness?: boolean;
}

interface TemplateCompleteness {
  hasStoreSlug: boolean;
  hasProducts: boolean;
  hasMainBanner: boolean;
  hasMiniBanners: boolean;
  hasBenefitBanners: boolean;
  hasContentBanner: boolean;
  hasButtonStyles: boolean;
  hasLayoutSettings: boolean;
  hasInstitutionalText: boolean;
}

export interface TemplatePreviewSyncResult {
  templateId: string;
  brandId: string;
  templateName: string;
  sourceProfileId: string;
  storeSlug: string;
  snapshotSyncedAt: string;
  templateUpdatedAt: string;
  profileUpdatedAt: string;
  productCount: {
    total: number;
    active: number;
  };
  dataOrigins: {
    products: string;
    visuals: string;
    banners: string;
  };
  completeness: TemplateCompleteness;
  missingBlocks: string[];
}

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const hasStructuredContentBanner = (value: unknown): boolean => {
  if (!Array.isArray(value)) return false;

  return value.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;

    const item = entry as {
      enabled?: boolean;
      image_url?: string;
      title?: string;
      subtitle?: string;
    };

    if (!item.enabled) return false;

    return Boolean(
      item.image_url?.trim() ||
      item.title?.trim() ||
      item.subtitle?.trim(),
    );
  });
};

const toBenefitIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === 'number') return entry;
      if (typeof entry === 'string') {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : NaN;
      }
      return NaN;
    })
    .filter((entry) => Number.isFinite(entry));
};

const missingBlockLabels: Record<keyof TemplateCompleteness, string> = {
  hasStoreSlug: 'slug da loja modelo',
  hasProducts: 'produtos ativos',
  hasMainBanner: 'banner principal (desktop + mobile)',
  hasMiniBanners: 'mini banners (2 blocos)',
  hasBenefitBanners: 'banners de benefícios',
  hasContentBanner: 'banner de conteúdo',
  hasButtonStyles: 'personalização de botões',
  hasLayoutSettings: 'configurações visuais/layout',
  hasInstitutionalText: 'texto institucional',
};

export const syncTemplatePreviewState = async (
  templateId: string,
  options: SyncTemplatePreviewStateOptions = {},
): Promise<TemplatePreviewSyncResult> => {
  const {
    context = 'force-sync',
    forceSync = true,
    enforceCompleteness = true,
  } = options;

  if (!templateId) {
    throw new Error('Template inválido para sincronização de preview.');
  }

  console.info('[TemplateSync] início', {
    context,
    template_id: templateId,
    started_at: new Date().toISOString(),
  });

  const { data: templateBase, error: templateBaseError } = await supabase
    .from('brand_templates')
    .select('id, name, source_profile_id')
    .eq('id', templateId)
    .single();

  if (templateBaseError || !templateBase) {
    throw new Error(templateBaseError?.message || 'Template não encontrado para sincronização.');
  }

  if (!templateBase.source_profile_id) {
    throw new Error('Template sem perfil-fonte vinculado.');
  }

  if (forceSync) {
    const { error: syncError } = await supabase
      .rpc('sync_template_from_profile', { p_template_id: templateId });

    if (syncError) {
      throw new Error(`Falha no sync backend: ${syncError.message}`);
    }
  }

  const { data: templateMeta, error: templateMetaError } = await supabase
    .from('brand_templates')
    .select('id, name, updated_at, source_profile_id')
    .eq('id', templateId)
    .single();

  if (templateMetaError || !templateMeta) {
    throw new Error(templateMetaError?.message || 'Falha ao obter metadados do template após sincronização.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, store_slug, updated_at, banner_desktop_urls, banner_mobile_urls, banner_desktop_url, banner_mobile_url, banner_rect_1_url, banner_rect_2_url, selected_benefit_banners, content_banners, content_banner_enabled, content_banner_image_url, button_bg_color, button_text_color, primary_color, secondary_color, store_layout, store_model, about_us_text')
    .eq('id', templateMeta.source_profile_id)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || 'Perfil-fonte não encontrado para o template.');
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, is_active')
    .eq('user_id', templateMeta.source_profile_id);

  if (productsError || !products) {
    throw new Error(productsError?.message || 'Falha ao carregar produtos do perfil-fonte.');
  }

  const desktopBanners = toStringArray(profile.banner_desktop_urls).length > 0
    ? toStringArray(profile.banner_desktop_urls)
    : (profile.banner_desktop_url?.trim() ? [profile.banner_desktop_url.trim()] : []);

  const mobileBanners = toStringArray(profile.banner_mobile_urls).length > 0
    ? toStringArray(profile.banner_mobile_urls)
    : (profile.banner_mobile_url?.trim() ? [profile.banner_mobile_url.trim()] : []);

  const activeProducts = products.filter((product) => product.is_active !== false);
  const benefitIds = toBenefitIds(profile.selected_benefit_banners);

  const completeness: TemplateCompleteness = {
    hasStoreSlug: Boolean(profile.store_slug?.trim()),
    hasProducts: activeProducts.length > 0,
    hasMainBanner: desktopBanners.length > 0 && mobileBanners.length > 0,
    hasMiniBanners: Boolean(profile.banner_rect_1_url?.trim() && profile.banner_rect_2_url?.trim()),
    hasBenefitBanners: benefitIds.length > 0,
    hasContentBanner:
      hasStructuredContentBanner(profile.content_banners) ||
      Boolean(profile.content_banner_enabled && profile.content_banner_image_url?.trim()),
    hasButtonStyles: Boolean(profile.button_bg_color?.trim() && profile.button_text_color?.trim()),
    hasLayoutSettings: Boolean(
      profile.primary_color?.trim() &&
      profile.secondary_color?.trim() &&
      profile.store_layout?.trim() &&
      profile.store_model?.trim(),
    ),
    hasInstitutionalText: Boolean(profile.about_us_text?.trim()),
  };

  const missingBlocks = (Object.keys(completeness) as Array<keyof TemplateCompleteness>)
    .filter((key) => !completeness[key])
    .map((key) => missingBlockLabels[key]);

  const result: TemplatePreviewSyncResult = {
    templateId: templateMeta.id,
    brandId: templateMeta.id,
    templateName: templateMeta.name,
    sourceProfileId: templateMeta.source_profile_id,
    storeSlug: profile.store_slug || '',
    snapshotSyncedAt: new Date().toISOString(),
    templateUpdatedAt: templateMeta.updated_at,
    profileUpdatedAt: profile.updated_at,
    productCount: {
      total: products.length,
      active: activeProducts.length,
    },
    dataOrigins: {
      products: 'public.products (user_id = source_profile_id)',
      visuals: 'public.profiles (id = source_profile_id)',
      banners: 'public.profiles.banner_* + content_banners + selected_benefit_banners',
    },
    completeness,
    missingBlocks,
  };

  if (missingBlocks.length > 0) {
    console.error('[TemplateSync] payload incompleto', {
      ...result,
      context,
    });

    if (enforceCompleteness) {
      throw new Error(`Sincronização incompleta. Blocos ausentes: ${missingBlocks.join(', ')}.`);
    }
  } else {
    console.info('[TemplateSync] payload completo', {
      ...result,
      context,
    });
  }

  return result;
};
