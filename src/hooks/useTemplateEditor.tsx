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

      // Use secure RPC function to link template to profile (bypasses RLS issues)
      const { error: linkError } = await supabase
        .rpc('link_template_to_profile', {
          p_template_id: template.id,
          p_profile_id: authData.user.id,
        });

      if (linkError) {
        console.error('Error linking template to profile:', linkError);
        // Still continue - the template was created
      }

      // Update logo separately if provided
      if (templateData.logo_url) {
        await supabase
          .from('profiles')
          .update({ store_logo_url: templateData.logo_url })
          .eq('id', authData.user.id);
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
 * This now stores context in localStorage and opens a dedicated template editor page
 */
export const useOpenTemplateEditor = () => {
  const [isOpening, setIsOpening] = useState(false);

  const openEditor = async (
    templateId: string, 
    sourceProfileId: string,
    credentials?: { email: string; password: string }
  ) => {
    setIsOpening(true);
    
    try {
      // Store template context in localStorage (persists across tabs)
      const editorContext = {
        templateId,
        sourceProfileId,
        mode: 'template-editor',
        timestamp: Date.now(),
        credentials, // Only for initial login
      };
      
      localStorage.setItem('templateEditorContext', JSON.stringify(editorContext));
      
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
 * Uses localStorage instead of sessionStorage for cross-tab persistence
 */
export const useTemplateEditorMode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const templateIdFromUrl = urlParams.get('templateId');
  const modeFromUrl = urlParams.get('mode');
  
  // Check localStorage for editor context
  let editorContext: {
    templateId: string;
    sourceProfileId: string;
    mode: string;
    credentials?: { email: string; password: string };
  } | null = null;
  
  try {
    const stored = localStorage.getItem('templateEditorContext');
    if (stored) {
      editorContext = JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }

  // Use URL params if present, otherwise fall back to localStorage context
  const templateId = templateIdFromUrl || editorContext?.templateId || null;
  const isTemplateEditorMode = (modeFromUrl === 'template-editor' && !!templateIdFromUrl) || 
                               (editorContext?.mode === 'template-editor' && !!editorContext?.templateId);

  return {
    isTemplateEditorMode,
    templateId,
    editorContext,
  };
};

/**
 * Hook to clear template editor context
 */
export const clearTemplateEditorContext = () => {
  localStorage.removeItem('templateEditorContext');
};
