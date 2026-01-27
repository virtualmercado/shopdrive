/**
 * Default banner URLs for new stores
 * These banners are automatically shown when merchants haven't customized their own
 */

import bannerBenefits1 from "@/assets/banner-benefits-1.png";
import bannerBenefits2 from "@/assets/banner-benefits-2.png";
import bannerBenefits3 from "@/assets/banner-benefits-3.png";
import bannerBenefits4 from "@/assets/banner-benefits-4.png";
import bannerBenefits5 from "@/assets/banner-benefits-5.png";

// VM Benefits Desktop Banners (1920x512) - 5 pre-inserted banners for merchant convenience
export const FIXED_VM_DESKTOP_BANNERS = [
  bannerBenefits1,
  bannerBenefits2,
  bannerBenefits3,
  bannerBenefits4,
  bannerBenefits5,
];

// Maximum total banners (all editable by merchant)
export const MAX_TOTAL_BANNERS = 8;

// Legacy export for compatibility
export const MAX_CUSTOM_BANNERS = MAX_TOTAL_BANNERS;

// Default Mobile Banners (800x600) - Optimized for mobile devices
export const DEFAULT_MOBILE_BANNERS = [
  "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&h=600&fit=crop&crop=center&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop&crop=center&q=80",
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop&crop=center&q=80",
];

// Default Minibanners (600x300) - Promotional sections
export const DEFAULT_MINIBANNER_1 = "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=300&fit=crop&crop=center&q=80";
export const DEFAULT_MINIBANNER_2 = "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&h=300&fit=crop&crop=center&q=80";

// Legacy export for compatibility
export const DEFAULT_DESKTOP_BANNERS = FIXED_VM_DESKTOP_BANNERS;

/**
 * Check if a banner URL is one of the VM pre-inserted banners
 */
export const isFixedVMBanner = (url: string): boolean => {
  if (!url) return false;
  return FIXED_VM_DESKTOP_BANNERS.includes(url);
};

/**
 * Check if a banner URL is one of the default banners (legacy)
 */
export const isDefaultBanner = (url: string): boolean => {
  if (!url) return false;
  
  const allDefaults = [
    ...FIXED_VM_DESKTOP_BANNERS,
    ...DEFAULT_MOBILE_BANNERS,
    DEFAULT_MINIBANNER_1,
    DEFAULT_MINIBANNER_2,
  ];
  
  // For asset imports, compare directly
  if (FIXED_VM_DESKTOP_BANNERS.includes(url)) return true;
  
  // For URLs, compare the base path
  return allDefaults.some(defaultUrl => 
    typeof defaultUrl === 'string' && url.includes(defaultUrl.split("?")[0])
  );
};

/**
 * Get effective banners for a store
 * Returns exactly what the merchant has configured - no fallback banners
 * If merchant has no banners, container should be hidden
 */
export const getEffectiveBanners = (
  customDesktopUrls: string[] = [],
  customMobileUrls: string[] = [],
  customMinibanner1?: string | null,
  customMinibanner2?: string | null
) => {
  // Return merchant's banners directly - no fallback to VM banners
  // When arrays are empty, the StoreBanner component will hide itself
  return {
    desktopBanners: customDesktopUrls,
    mobileBanners: customMobileUrls,
    minibanner1: customMinibanner1 || DEFAULT_MINIBANNER_1,
    minibanner2: customMinibanner2 || DEFAULT_MINIBANNER_2,
  };
};

/**
 * Get the initial banner set for new stores
 * Returns the 5 VM pre-inserted banners as starting point
 */
export const getInitialDesktopBanners = (): string[] => {
  return [...FIXED_VM_DESKTOP_BANNERS];
};

/**
 * Get only custom banners (excluding VM pre-inserted banners)
 */
export const getCustomBannersOnly = (allBanners: string[]): string[] => {
  return allBanners.filter(url => !isFixedVMBanner(url));
};
