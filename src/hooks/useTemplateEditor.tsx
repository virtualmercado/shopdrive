import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TemplateEditorProfile {
  id: string;
  store_name: string;
  store_slug: string;
  is_template_profile: boolean;
  source_template_id: string | null;
}

/**
 * Hook to create a temporary profile for template editing
 */
export const useCreateTemplateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateData: { 
      name: string; 
      logo_url?: string; 
      description?: string;
    }) => {
      // First, create the brand template record
      const { data: template, error: templateError } = await supabase
        .from('brand_templates')
        .insert({
          name: templateData.name,
          logo_url: templateData.logo_url || null,
          description: templateData.description || null,
          status: 'draft',
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Generate a unique email for the template profile (not a real user)
      const templateEmail = `template-${template.id}@virtualmercado.internal`;
      const templatePassword = `Template${Date.now()}!${Math.random().toString(36).substring(2, 15)}`;

      // Create a temporary auth user for this template
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: templateEmail,
        password: templatePassword,
        options: {
          data: {
            full_name: `Template: ${templateData.name}`,
            store_name: templateData.name,
            is_template_profile: true,
          }
        }
      });

      if (authError) {
        // Rollback template creation
        await supabase.from('brand_templates').delete().eq('id', template.id);
        throw authError;
      }

      if (!authData.user) {
        await supabase.from('brand_templates').delete().eq('id', template.id);
        throw new Error('Falha ao criar perfil temporário');
      }

      // Mark the profile as template and link to brand_template
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_template_profile: true,
          store_logo_url: templateData.logo_url || null,
        })
        .eq('id', authData.user.id);

      if (updateError) {
        console.error('Error marking profile as template:', updateError);
      }

      // Link template to source profile
      const { error: linkError } = await supabase
        .from('brand_templates')
        .update({
          source_profile_id: authData.user.id,
        })
        .eq('id', template.id);

      if (linkError) {
        console.error('Error linking template to profile:', linkError);
      }

      return {
        template,
        profile: {
          id: authData.user.id,
          email: templateEmail,
          password: templatePassword,
        }
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      toast.success('Template criado! Abrindo painel de edição...');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar template: ${error.message}`);
    },
  });
};

/**
 * Hook to sync template snapshot from its source profile
 */
export const useSyncTemplateSnapshot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase
        .rpc('sync_template_from_profile', { p_template_id: templateId });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-templates'] });
      toast.success('Snapshot do template atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao sincronizar template: ${error.message}`);
    },
  });
};

/**
 * Hook to get template with its source profile
 */
export const useTemplateWithProfile = (templateId: string | undefined) => {
  return useQuery({
    queryKey: ['template-with-profile', templateId],
    queryFn: async () => {
      if (!templateId) return null;

      const { data: template, error } = await supabase
        .from('brand_templates')
        .select('*, source_profile_id')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      return template;
    },
    enabled: !!templateId,
  });
};

/**
 * Hook to open template editor in a new tab
 */
export const useOpenTemplateEditor = () => {
  const [isOpening, setIsOpening] = useState(false);

  const openEditor = async (templateId: string, sourceProfileId: string) => {
    setIsOpening(true);
    
    try {
      // Store template context in sessionStorage for the new tab
      const editorContext = {
        templateId,
        sourceProfileId,
        mode: 'template-editor',
        timestamp: Date.now(),
      };
      
      sessionStorage.setItem('templateEditorContext', JSON.stringify(editorContext));
      
      // Open the dashboard in a new tab with template mode
      const editorUrl = `/lojista?templateId=${templateId}&mode=template-editor`;
      window.open(editorUrl, '_blank');
      
      toast.success('Painel de edição aberto em nova aba!');
    } catch (error) {
      console.error('Error opening editor:', error);
      toast.error('Erro ao abrir editor');
    } finally {
      setIsOpening(false);
    }
  };

  return { openEditor, isOpening };
};

/**
 * Hook to detect if we're in template editor mode
 */
export const useTemplateEditorMode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const templateId = urlParams.get('templateId');
  const mode = urlParams.get('mode');
  
  const isTemplateEditorMode = mode === 'template-editor' && !!templateId;
  
  // Also check sessionStorage for additional context
  let editorContext: {
    templateId: string;
    sourceProfileId: string;
    mode: string;
  } | null = null;
  
  try {
    const stored = sessionStorage.getItem('templateEditorContext');
    if (stored) {
      editorContext = JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }

  return {
    isTemplateEditorMode,
    templateId,
    editorContext,
  };
};
