import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BrandTemplateProduct {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  sku: string | null;
  images: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface BrandTemplateProductFormData {
  name: string;
  description?: string;
  category?: string;
  price: number;
  sku?: string;
  images?: string[];
  is_active?: boolean;
  display_order?: number;
}

// Fetch products for a specific template
export const useBrandTemplateProducts = (templateId: string) => {
  return useQuery({
    queryKey: ['brand-template-products', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_template_products')
        .select('*')
        .eq('template_id', templateId)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as BrandTemplateProduct[];
    },
    enabled: !!templateId,
  });
};

// Create a new template product
export const useCreateTemplateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, product }: { templateId: string; product: BrandTemplateProductFormData }) => {
      // Check product limit (max 20)
      const { count, error: countError } = await supabase
        .from('brand_template_products')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', templateId);

      if (countError) throw countError;
      if (count && count >= 20) {
        throw new Error('Limite máximo de 20 produtos por template atingido');
      }

      const { data, error } = await supabase
        .from('brand_template_products')
        .insert({
          template_id: templateId,
          ...product,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['brand-template-products', variables.templateId] });
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      toast.success('Produto adicionado ao template');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao adicionar produto');
    },
  });
};

// Update a template product
export const useUpdateTemplateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, templateId, product }: { id: string; templateId: string; product: Partial<BrandTemplateProductFormData> }) => {
      const { data, error } = await supabase
        .from('brand_template_products')
        .update(product)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['brand-template-products', variables.templateId] });
      toast.success('Produto atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar produto');
    },
  });
};

// Delete a template product
export const useDeleteTemplateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, templateId }: { id: string; templateId: string }) => {
      const { error } = await supabase
        .from('brand_template_products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['brand-template-products', variables.templateId] });
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      toast.success('Produto removido do template');
    },
    onError: () => {
      toast.error('Erro ao remover produto');
    },
  });
};

// Fetch single template by ID
export const useBrandTemplate = (templateId: string) => {
  return useQuery({
    queryKey: ['brand-template', templateId],
    queryFn: async () => {
      // Validate UUID format before querying
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(templateId)) {
        return null;
      }
      
      const { data, error } = await supabase
        .from('brand_templates')
        .select('*')
        .eq('id', templateId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });
};
