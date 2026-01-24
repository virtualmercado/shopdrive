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
  exitTemplateMode: () => void;
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
      
      toast.success('Template salvo com sucesso!');
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(`Erro ao salvar template: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const exitTemplateMode = () => {
    // Clear sessionStorage
    sessionStorage.removeItem('templateEditorContext');
    
    // Close this tab or redirect
    if (window.opener) {
      window.close();
    } else {
      window.location.href = '/gestor/templates-marca';
    }
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
