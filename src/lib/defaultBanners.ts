/**
 * Default banner URLs for new stores
 * These banners are automatically shown when merchants haven't customized their own
 */

// Default Desktop Banners (1920x600) - Professional e-commerce style
export const DEFAULT_DESKTOP_BANNERS = [
  "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1920&h=600&fit=crop&crop=center&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&h=600&fit=crop&crop=center&q=80",
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&h=600&fit=crop&crop=center&q=80",
];

// Default Mobile Banners (800x600) - Optimized for mobile devices
export const DEFAULT_MOBILE_BANNERS = [
  "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&h=600&fit=crop&crop=center&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop&crop=center&q=80",
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop&crop=center&q=80",
];

// Default Minibanners (600x300) - Promotional sections
export const DEFAULT_MINIBANNER_1 = "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=300&fit=crop&crop=center&q=80";
export const DEFAULT_MINIBANNER_2 = "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&h=300&fit=crop&crop=center&q=80";

/**
 * Check if a banner URL is one of the default banners
 */
export const isDefaultBanner = (url: string): boolean => {
  if (!url) return false;
  
  const allDefaults = [
    ...DEFAULT_DESKTOP_BANNERS,
    ...DEFAULT_MOBILE_BANNERS,
    DEFAULT_MINIBANNER_1,
    DEFAULT_MINIBANNER_2,
  ];
  
  return allDefaults.some(defaultUrl => url.includes(defaultUrl.split("?")[0]));
};

/**
 * Get effective banners for a store - returns custom banners or defaults
 */
export const getEffectiveBanners = (
  customDesktopUrls: string[] = [],
  customMobileUrls: string[] = [],
  customMinibanner1?: string | null,
  customMinibanner2?: string | null
) => {
  return {
    desktopBanners: customDesktopUrls.length > 0 ? customDesktopUrls : DEFAULT_DESKTOP_BANNERS,
    mobileBanners: customMobileUrls.length > 0 ? customMobileUrls : DEFAULT_MOBILE_BANNERS,
    minibanner1: customMinibanner1 || DEFAULT_MINIBANNER_1,
    minibanner2: customMinibanner2 || DEFAULT_MINIBANNER_2,
  };
};
