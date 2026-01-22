import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCallback, useRef } from "react";

export type BannerStatus = 'draft' | 'active' | 'paused' | 'archived';
export type BannerLinkType = 'internal' | 'external';
export type BannerBadgeType = 'default' | 'info' | 'success' | 'warning' | 'sponsored';

export interface DashboardBanner {
  id: string;
  title: string;
  subtitle: string | null;
  status: BannerStatus;
  priority: number;
  badge_text: string | null;
  badge_type: BannerBadgeType | null;
  is_sponsored: boolean;
  link_type: BannerLinkType;
  internal_route: string | null;
  external_url: string | null;
  open_in_new_tab: boolean;
  image_desktop_url: string;
  image_mobile_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BannerFormData {
  title: string;
  subtitle?: string;
  status: BannerStatus;
  priority: number;
  badge_text?: string;
  badge_type?: BannerBadgeType;
  is_sponsored: boolean;
  link_type: BannerLinkType;
  internal_route?: string;
  external_url?: string;
  open_in_new_tab: boolean;
  image_desktop_url: string;
  image_mobile_url?: string;
  starts_at?: string;
  ends_at?: string;
}

export interface BannerMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
}

// Hook for admin to manage all banners
export const useAdminBanners = () => {
  return useQuery({
    queryKey: ["admin-dashboard-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vm_dashboard_banners")
        .select("*")
        .order("priority", { ascending: true });
      
      if (error) {
        console.error("Error fetching banners:", error);
        throw error;
      }
      
      return data as DashboardBanner[];
    },
  });
};

// Hook for merchants to view active banners only
export const useMerchantBanners = () => {
  return useQuery({
    queryKey: ["merchant-dashboard-banners"],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from("vm_dashboard_banners")
        .select("*")
        .eq("status", "active")
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order("priority", { ascending: true })
        .limit(6);
      
      if (error) {
        console.error("Error fetching merchant banners:", error);
        throw error;
      }
      
      // Apply sponsored mixing rule: never 2 sponsored side by side
      const banners = data as DashboardBanner[];
      return mixBannersForDisplay(banners);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
};

// Mix banners to avoid 2 sponsored side by side
function mixBannersForDisplay(banners: DashboardBanner[]): DashboardBanner[] {
  if (banners.length <= 1) return banners;
  
  const sponsored = banners.filter(b => b.is_sponsored);
  const regular = banners.filter(b => !b.is_sponsored);
  
  if (sponsored.length <= 1 || regular.length === 0) return banners;
  
  // Interleave sponsored with regular
  const result: DashboardBanner[] = [];
  let sIdx = 0;
  let rIdx = 0;
  let lastWasSponsored = false;
  
  while (sIdx < sponsored.length || rIdx < regular.length) {
    if (rIdx < regular.length && (lastWasSponsored || sIdx >= sponsored.length)) {
      result.push(regular[rIdx++]);
      lastWasSponsored = false;
    } else if (sIdx < sponsored.length) {
      result.push(sponsored[sIdx++]);
      lastWasSponsored = true;
    }
  }
  
  return result;
}

// Hook for creating a banner
export const useCreateBanner = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (formData: BannerFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("vm_dashboard_banners")
        .insert({
          ...formData,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-banners"] });
    },
  });
};

// Hook for updating a banner
export const useUpdateBanner = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<BannerFormData> }) => {
      const { data, error } = await supabase
        .from("vm_dashboard_banners")
        .update(formData)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-banners"] });
    },
  });
};

// Hook for duplicating a banner
export const useDuplicateBanner = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bannerId: string) => {
      // First fetch the original banner
      const { data: original, error: fetchError } = await supabase
        .from("vm_dashboard_banners")
        .select("*")
        .eq("id", bannerId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create duplicate with modified title and draft status
      const { data, error } = await supabase
        .from("vm_dashboard_banners")
        .insert({
          title: `${original.title} (cópia)`.substring(0, 60),
          subtitle: original.subtitle,
          status: 'draft',
          priority: original.priority + 1,
          badge_text: original.badge_text,
          badge_type: original.badge_type,
          is_sponsored: original.is_sponsored,
          link_type: original.link_type,
          internal_route: original.internal_route,
          external_url: original.external_url,
          open_in_new_tab: original.open_in_new_tab,
          image_desktop_url: original.image_desktop_url,
          image_mobile_url: original.image_mobile_url,
          starts_at: null,
          ends_at: null,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-banners"] });
    },
  });
};

// Hook for reordering banners
export const useReorderBanners = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => 
        supabase
          .from("vm_dashboard_banners")
          .update({ priority: index })
          .eq("id", id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-banners"] });
    },
  });
};

// Hook for getting banner counts (for validation)
export const useBannerCounts = () => {
  return useQuery({
    queryKey: ["banner-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_banners_count");
      
      if (error) {
        console.error("Error fetching banner counts:", error);
        return { total_active: 0, sponsored_active: 0 };
      }
      
      return data?.[0] || { total_active: 0, sponsored_active: 0 };
    },
  });
};

// Hook for getting banner metrics
export const useBannerMetrics = (bannerId: string, days: number = 30) => {
  return useQuery({
    queryKey: ["banner-metrics", bannerId, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_banner_metrics", {
        p_banner_id: bannerId,
        p_days: days,
      });
      
      if (error) {
        console.error("Error fetching banner metrics:", error);
        return { impressions: 0, clicks: 0, ctr: 0 };
      }
      
      return data?.[0] || { impressions: 0, clicks: 0, ctr: 0 };
    },
    enabled: !!bannerId,
  });
};

// Hook for tracking banner events
export const useBannerTracking = () => {
  const { user } = useAuth();
  const impressionCache = useRef<Set<string>>(new Set());
  
  const trackImpression = useCallback(async (bannerId: string) => {
    if (!user?.id) return;
    
    // Prevent duplicate impressions in same session
    const cacheKey = `${bannerId}-${user.id}`;
    if (impressionCache.current.has(cacheKey)) return;
    impressionCache.current.add(cacheKey);
    
    try {
      await supabase.from("vm_dashboard_banner_events").insert({
        banner_id: bannerId,
        merchant_id: user.id,
        event_type: 'impression',
        meta: { device_type: window.innerWidth < 768 ? 'mobile' : 'desktop' },
      });
    } catch (error) {
      console.error("Error tracking impression:", error);
    }
  }, [user?.id]);
  
  const trackClick = useCallback(async (bannerId: string, destinationUrl: string) => {
    if (!user?.id) return;
    
    try {
      await supabase.from("vm_dashboard_banner_events").insert({
        banner_id: bannerId,
        merchant_id: user.id,
        event_type: 'click',
        meta: { 
          device_type: window.innerWidth < 768 ? 'mobile' : 'desktop',
          url_at_click: destinationUrl,
        },
      });
    } catch (error) {
      console.error("Error tracking click:", error);
    }
  }, [user?.id]);
  
  return { trackImpression, trackClick };
};

// Hook for exporting banner events to CSV
export const useExportBannerEvents = () => {
  return useMutation({
    mutationFn: async ({ bannerId, days }: { bannerId?: string; days: number }) => {
      let query = supabase
        .from("vm_dashboard_banner_events")
        .select(`
          id,
          banner_id,
          merchant_id,
          event_type,
          created_at,
          meta
        `)
        .gte("created_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false });
      
      if (bannerId) {
        query = query.eq("banner_id", bannerId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Convert to CSV
      const headers = ["ID", "Banner ID", "Merchant ID", "Event Type", "Created At", "Device Type"];
      const rows = data.map(event => [
        event.id,
        event.banner_id,
        event.merchant_id,
        event.event_type,
        new Date(event.created_at).toLocaleString("pt-BR"),
        (event.meta as any)?.device_type || "unknown",
      ]);
      
      const csv = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
      
      // Create and download file
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `banner-events-${days}days-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      return data;
    },
  });
};
