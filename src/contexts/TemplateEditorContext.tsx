import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TemplateEditorContextType {
  isTemplateMode: boolean;
  templateId: string | null;
  templateName: string | null;
  isSaving: boolean;
  saveAndSyncTemplate: () => Promise<void>;
  exitTemplateMode: () => Promise<void>;
}

const TemplateEditorContext = createContext<TemplateEditorContextType | undefined>(undefined);

interface TemplateEditorProviderProps {
  children: ReactNode;
}

export const TemplateEditorProvider = ({ children }: TemplateEditorProviderProps) => {
  const [searchParams] = useSearchParams();
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const mode = searchParams.get('mode');
    const tId = searchParams.get('templateId');
    
    if (mode === 'template-editor' && tId) {
      setIsTemplateMode(true);
      setTemplateId(tId);
      
      // Fetch template name
      const fetchTemplateName = async () => {
        const { data } = await supabase
          .from('brand_templates')
          .select('name')
          .eq('id', tId)
          .single();
        
        if (data) {
          setTemplateName(data.name);
        }
      };
      
      fetchTemplateName();
    } else {
      setIsTemplateMode(false);
      setTemplateId(null);
      setTemplateName(null);
    }
  }, [searchParams]);

  const saveAndSyncTemplate = async () => {
    if (!templateId) return;
    
    setIsSaving(true);
    
    try {
      // Call RPC to sync the profile data to the template snapshot
      const { error } = await supabase
        .rpc('sync_template_from_profile', { p_template_id: templateId });

      if (error) throw error;

      // Force updated_at to propagate so preview reads fresh data
      await supabase
        .from('brand_templates')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', templateId);
      
      toast.success('Template salvo com sucesso! Preview atualizado.');
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(`Erro ao salvar template: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const exitTemplateMode = async () => {
    localStorage.removeItem('templateEditorContext');

    const savedAdminSessionRaw = localStorage.getItem('adminSessionToRestore');
    const legacyRefreshToken = localStorage.getItem('adminSessionRefreshToken');
    localStorage.removeItem('adminSessionToRestore');
    localStorage.removeItem('adminSessionRefreshToken');

    // Extract refresh_token from saved session
    let refreshToken: string | null = null;
    if (savedAdminSessionRaw) {
      try {
        const parsed = JSON.parse(savedAdminSessionRaw) as { access_token?: string; refresh_token?: string };
        refreshToken = parsed?.refresh_token || null;
      } catch (err) {
        console.error('Error parsing saved admin session:', err);
      }
    }
    if (!refreshToken && legacyRefreshToken) {
      refreshToken = legacyRefreshToken;
    }

    if (refreshToken) {
      try {
        const { error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        if (!error) {
          window.location.href = '/gestor/templates-marca';
          return;
        }
        console.error('Failed to restore admin session:', error);
      } catch (err) {
        console.error('Error restoring admin session:', err);
      }
    }

    // Fallback
    window.location.href = '/gestor/login';
  };

  return (
    <TemplateEditorContext.Provider
      value={{
        isTemplateMode,
        templateId,
        templateName,
        isSaving,
        saveAndSyncTemplate,
        exitTemplateMode,
      }}
    >
      {children}
    </TemplateEditorContext.Provider>
  );
};

export const useTemplateEditor = () => {
  const context = useContext(TemplateEditorContext);
  if (context === undefined) {
    throw new Error('useTemplateEditor must be used within a TemplateEditorProvider');
  }
  return context;
};
