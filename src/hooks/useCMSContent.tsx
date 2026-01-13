import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CMSContent {
  id: string;
  section_key: string;
  content: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useCMSContent = () => {
  return useQuery({
    queryKey: ["cms-landing-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cms_landing_content")
        .select("*")
        .eq("is_active", true);
      
      if (error) {
        console.error("Error fetching CMS content:", error);
        throw error;
      }
      
      // Convert to a map for easy access
      const contentMap: Record<string, Record<string, any>> = {};
      (data as CMSContent[])?.forEach((item) => {
        contentMap[item.section_key] = item.content;
      });
      
      return contentMap;
    },
  });
};

export const useCMSContentAdmin = () => {
  return useQuery({
    queryKey: ["cms-landing-content-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cms_landing_content")
        .select("*")
        .order("section_key", { ascending: true });
      
      if (error) {
        console.error("Error fetching CMS content:", error);
        throw error;
      }
      
      return data as CMSContent[];
    },
  });
};

export const useUpdateCMSContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sectionKey, content }: { sectionKey: string; content: Record<string, any> }) => {
      // Use upsert to create if not exists, or update if exists
      const { error } = await supabase
        .from("cms_landing_content")
        .upsert({ 
          section_key: sectionKey,
          content,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'section_key'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-landing-content"] });
      queryClient.invalidateQueries({ queryKey: ["cms-landing-content-admin"] });
    },
  });
};

// Helper function to get content with fallback
export const getContent = (
  contentMap: Record<string, Record<string, any>> | undefined,
  sectionKey: string,
  field: string,
  fallback: string
): string => {
  if (!contentMap || !contentMap[sectionKey]) return fallback;
  return contentMap[sectionKey][field] || fallback;
};

export const getContentArray = (
  contentMap: Record<string, Record<string, any>> | undefined,
  sectionKey: string,
  field: string,
  fallback: any[]
): any[] => {
  if (!contentMap || !contentMap[sectionKey]) return fallback;
  return contentMap[sectionKey][field] || fallback;
};
