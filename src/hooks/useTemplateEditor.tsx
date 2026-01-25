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

      // Use secure RPC function to link template to profile and store password (bypasses RLS issues)
      const { error: linkError } = await supabase
        .rpc('link_template_to_profile', {
          p_template_id: template.id,
          p_profile_id: authData.user.id,
          p_template_password: templatePassword,
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
 * Hook to open template editor - switches the current session to the template profile
 * This replaces the current session instead of opening a new tab
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
      let loginCredentials = credentials;
      
      // If no credentials provided, get them from the edge function
      if (!loginCredentials) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        
        const response = await fetch(`${supabaseUrl}/functions/v1/reset-template-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ templateId }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get credentials');
        }
        
        const data = await response.json();
        loginCredentials = {
          email: data.email,
          password: data.password,
        };
      }
      
      if (!loginCredentials) {
        toast.error('Não foi possível obter credenciais do template. Recrie o template.');
        setIsOpening(false);
        return;
      }
      
      // Store template context in localStorage
      const editorContext = {
        templateId,
        sourceProfileId,
        mode: 'template-editor',
        timestamp: Date.now(),
        credentials: loginCredentials,
      };
      
      localStorage.setItem('templateEditorContext', JSON.stringify(editorContext));
      
      // Navigate to the dashboard (same tab) - session switch happens in DashboardLayout
      const editorUrl = `/lojista?templateId=${templateId}&mode=template-editor`;
      window.location.href = editorUrl;
      
      toast.info('Abrindo painel de edição do template...');
    } catch (error) {
      console.error('Error opening editor:', error);
      toast.error('Erro ao abrir editor');
      setIsOpening(false);
    }
    // Note: We don't set isOpening to false here because we're navigating away
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
