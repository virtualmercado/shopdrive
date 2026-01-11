import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CMSBanner {
  id: string;
  banner_key: string;
  name: string;
  description: string | null;
  media_id: string | null;
  media_url: string | null;
  media_type: string | null;
  display_order: number;
  is_active: boolean;
}

export const useCMSBanners = () => {
  return useQuery({
    queryKey: ["cms-banners-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cms_banners")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      
      if (error) {
        console.error("Error fetching CMS banners:", error);
        throw error;
      }
      
      return data as CMSBanner[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
};

export const getBannerUrl = (
  banners: CMSBanner[] | undefined, 
  bannerKey: string, 
  fallbackImage: string
): string => {
  if (!banners) return fallbackImage;
  
  const banner = banners.find(b => b.banner_key === bannerKey);
  return banner?.media_url || fallbackImage;
};
