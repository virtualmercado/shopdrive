import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useIntegrations = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching integrations:', error);
      }
      toast({
        title: 'Erro ao carregar integrações',
        description: 'Não foi possível carregar as integrações.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateIntegration = async (id: string, config: any) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('integrations')
        .update({
          config,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Integração atualizada',
        description: 'Configuração salva com sucesso.',
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating integration:', error);
      }
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível salvar a configuração.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const testIntegration = async (id: string) => {
    try {
      setLoading(true);
      // This would typically make a test API call to the integration
      // For now, we'll simulate a test
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { error } = await supabase
        .from('integrations')
        .update({
          status: 'connected',
          last_sync: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Teste bem-sucedido',
        description: 'Conexão com a integração está funcionando.',
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error testing integration:', error);
      }
      toast({
        title: 'Teste falhou',
        description: 'Não foi possível conectar à integração.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const toggleIntegration = async (id: string, isActive: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('integrations')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: isActive ? 'Integração ativada' : 'Integração desativada',
        description: `Integração ${isActive ? 'ativada' : 'desativada'} com sucesso.`,
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error toggling integration:', error);
      }
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status da integração.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchIntegrations,
    updateIntegration,
    testIntegration,
    toggleIntegration,
  };
};
