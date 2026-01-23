import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type BrandTemplateStatus = 'draft' | 'active' | 'inactive';

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
}

export interface BrandTemplateFormData {
  name: string;
  logo_url?: string;
  status: BrandTemplateStatus;
  description?: string;
}

// Fetch all brand templates
export const useBrandTemplates = (statusFilter?: BrandTemplateStatus | 'all', searchTerm?: string) => {
  return useQuery({
    queryKey: ['brand-templates', statusFilter, searchTerm],
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

      const { data, error } = await query;
      if (error) throw error;
      return data as BrandTemplate[];
    },
  });
};

// Get template stats/KPIs
export const useBrandTemplateStats = () => {
  return useQuery({
    queryKey: ['brand-template-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_templates')
        .select('status, stores_created');

      if (error) throw error;

      const templates = data || [];
      const totalTemplates = templates.length;
      const activeTemplates = templates.filter(t => t.status === 'active').length;
      const totalStoresCreated = templates.reduce((sum, t) => sum + (t.stores_created || 0), 0);

      return {
        totalTemplates,
        activeTemplates,
        totalStoresCreated,
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
