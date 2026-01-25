import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type BrandTemplateStatus = 'draft' | 'active' | 'inactive';
export type LinkStatusFilter = 'all' | 'active' | 'inactive';

export interface BrandTemplate {
  id: string;
  name: string;
  logo_url: string | null;
  status: BrandTemplateStatus;
  description: string | null;
  products_count: number;
  stores_created: number;
  max_products: number;
  created_at: string;
  updated_at: string;
  // New fields for dedicated links
  template_slug: string | null;
  is_link_active: boolean;
  link_created_at: string | null;
  link_clicks: number;
  signups_started: number;
  paid_conversions: number;
}

export interface BrandTemplateFormData {
  name: string;
  logo_url?: string;
  status: BrandTemplateStatus;
  description?: string;
}

// Fetch all brand templates with optional link status filter
export const useBrandTemplates = (
  statusFilter?: BrandTemplateStatus | 'all', 
  searchTerm?: string,
  linkStatusFilter?: LinkStatusFilter
) => {
  return useQuery({
    queryKey: ['brand-templates', statusFilter, searchTerm, linkStatusFilter],
    queryFn: async () => {
      let query = supabase
        .from('brand_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      if (linkStatusFilter && linkStatusFilter !== 'all') {
        query = query.eq('is_link_active', linkStatusFilter === 'active');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BrandTemplate[];
    },
  });
};

// Get single template by ID
export const useBrandTemplate = (id: string | undefined) => {
  return useQuery({
    queryKey: ['brand-template', id],
    queryFn: async () => {
      // Validate ID presence
      if (!id) return null;
      
      // Validate UUID format before making query
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        console.warn('[useBrandTemplate] Invalid UUID format:', id);
        return null;
      }

      // Use .maybeSingle() instead of .single() to avoid throwing exception
      const { data, error } = await supabase
        .from('brand_templates')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      // Log error only in development, return null instead of throwing
      if (error) {
        if (import.meta.env.DEV) {
          console.error('[useBrandTemplate] Error fetching template:', error);
        }
        return null;
      }
      
      return data as BrandTemplate | null;
    },
    enabled: !!id,
    retry: 2, // Retry on temporary session failures
    retryDelay: 1000, // Wait 1 second between retries
  });
};

// Get template stats/KPIs
export const useBrandTemplateStats = () => {
  return useQuery({
    queryKey: ['brand-template-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_templates')
        .select('status, stores_created, link_clicks');

      if (error) throw error;

      const templates = data || [];
      const totalTemplates = templates.length;
      const activeTemplates = templates.filter(t => t.status === 'active').length;
      const totalStoresCreated = templates.reduce((sum, t) => sum + (t.stores_created || 0), 0);
      const totalLinkClicks = templates.reduce((sum, t) => sum + (t.link_clicks || 0), 0);

      return {
        totalTemplates,
        activeTemplates,
        totalStoresCreated,
        totalLinkClicks,
        maxProducts: 20, // Fixed value for free plan
      };
    },
  });
};

// Create brand template
export const useCreateBrandTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: BrandTemplateFormData) => {
      const { data, error } = await supabase
        .from('brand_templates')
        .insert({
          name: formData.name,
          logo_url: formData.logo_url || null,
          status: formData.status,
          description: formData.description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      queryClient.invalidateQueries({ queryKey: ['brand-template-stats'] });
      toast.success('Template de marca criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar template: ${error.message}`);
    },
  });
};

// Update brand template
export const useUpdateBrandTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...formData }: BrandTemplateFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('brand_templates')
        .update({
          name: formData.name,
          logo_url: formData.logo_url || null,
          status: formData.status,
          description: formData.description || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      queryClient.invalidateQueries({ queryKey: ['brand-template-stats'] });
      toast.success('Template atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar template: ${error.message}`);
    },
  });
};

// Delete brand template
export const useDeleteBrandTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('brand_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      queryClient.invalidateQueries({ queryKey: ['brand-template-stats'] });
      toast.success('Template excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir template: ${error.message}`);
    },
  });
};

// Duplicate brand template
export const useDuplicateBrandTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First fetch the template to duplicate
      const { data: original, error: fetchError } = await supabase
        .from('brand_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Create a copy with modified name and draft status
      const { data, error } = await supabase
        .from('brand_templates')
        .insert({
          name: `${original.name} (Cópia)`,
          logo_url: original.logo_url,
          status: 'draft',
          description: original.description,
          max_products: original.max_products,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      queryClient.invalidateQueries({ queryKey: ['brand-template-stats'] });
      toast.success('Template duplicado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao duplicar template: ${error.message}`);
    },
  });
};

// Toggle template status (activate/deactivate)
export const useToggleBrandTemplateStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: BrandTemplateStatus }) => {
      const newStatus: BrandTemplateStatus = currentStatus === 'active' ? 'inactive' : 'active';
      
      const { data, error } = await supabase
        .from('brand_templates')
        .update({ status: newStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      queryClient.invalidateQueries({ queryKey: ['brand-template-stats'] });
      const statusLabel = data.status === 'active' ? 'ativado' : 'desativado';
      toast.success(`Template ${statusLabel} com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao alterar status: ${error.message}`);
    },
  });
};

// Toggle link active status
export const useToggleLinkStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, currentLinkStatus }: { id: string; currentLinkStatus: boolean }) => {
      const { data, error } = await supabase
        .from('brand_templates')
        .update({ is_link_active: !currentLinkStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      const statusLabel = data.is_link_active ? 'ativado' : 'desativado';
      toast.success(`Link de ativação ${statusLabel} com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao alterar status do link: ${error.message}`);
    },
  });
};

// Get template by slug (for public access)
export const useTemplateBySlug = (slug: string | null) => {
  return useQuery({
    queryKey: ['brand-template-slug', slug],
    queryFn: async () => {
      if (!slug) return null;
      
      const { data, error } = await supabase
        .rpc('get_template_by_slug', { p_slug: slug });

      if (error) throw error;
      
      // The RPC returns an array, get first item
      if (Array.isArray(data) && data.length > 0) {
        return data[0] as BrandTemplate;
      }
      return null;
    },
    enabled: !!slug,
  });
};

// Increment link clicks
export const useIncrementLinkClicks = () => {
  return useMutation({
    mutationFn: async (templateSlug: string) => {
      const { data, error } = await supabase
        .rpc('increment_template_link_clicks', { p_template_slug: templateSlug });

      if (error) throw error;
      return data;
    },
  });
};

// Copy template products to store
export const useCopyTemplateProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, userId }: { templateId: string; userId: string }) => {
      const { data, error } = await supabase
        .rpc('copy_template_products_to_store', { 
          p_template_id: templateId,
          p_user_id: userId 
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      queryClient.invalidateQueries({ queryKey: ['brand-template-stats'] });
    },
  });
};

// Generate activation link URL
export const getTemplateActivationLink = (templateSlug: string | null): string => {
  if (!templateSlug) return '';
  const baseUrl = window.location.origin;
  return `${baseUrl}/criar-conta?template=${templateSlug}`;
};

// Generate WhatsApp share message
export const getWhatsAppShareMessage = (brandName: string, templateSlug: string | null): string => {
  const link = getTemplateActivationLink(templateSlug);
  return encodeURIComponent(`Crie sua loja grátis já com os produtos da marca ${brandName}: ${link}`);
};
