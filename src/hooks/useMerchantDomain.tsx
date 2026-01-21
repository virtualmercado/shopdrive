import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MerchantDomain {
  id: string;
  merchant_id: string;
  domain: string;
  domain_type: 'subdomain' | 'root';
  status: 'pending' | 'verifying' | 'dns_error' | 'ssl_provisioning' | 'ssl_error' | 'active' | 'inactive';
  is_active: boolean;
  redirect_old_link: boolean;
  dns_cname_verified: boolean;
  dns_a_verified: boolean;
  ssl_status: 'pending' | 'provisioning' | 'active' | 'error';
  last_dns_check: string | null;
  last_ssl_check: string | null;
  dns_error_message: string | null;
  ssl_error_message: string | null;
  expected_cname: string;
  expected_ip: string;
  created_at: string;
  updated_at: string;
}

export interface DomainProviderTutorial {
  id: string;
  provider_name: string;
  provider_slug: string;
  display_order: number;
  is_active: boolean;
  tutorial_content: {
    steps: Array<{
      title: string;
      content: string;
    }>;
  };
}

export const useMerchantDomain = () => {
  const queryClient = useQueryClient();

  const { data: domain, isLoading, refetch } = useQuery({
    queryKey: ['merchant-domain'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('merchant_domains')
        .select('*')
        .eq('merchant_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as MerchantDomain | null;
    },
  });

  const { data: tutorials } = useQuery({
    queryKey: ['domain-tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('domain_provider_tutorials')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        tutorial_content: item.tutorial_content as unknown as DomainProviderTutorial['tutorial_content'],
      })) as DomainProviderTutorial[];
    },
  });

  const addDomain = useMutation({
    mutationFn: async ({ domain, domainType }: { domain: string; domainType: 'subdomain' | 'root' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Check if domain already exists for this merchant
      const { data: existing } = await supabase
        .from('merchant_domains')
        .select('id')
        .eq('merchant_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing domain
        const { data, error } = await supabase
          .from('merchant_domains')
          .update({
            domain,
            domain_type: domainType,
            status: 'pending',
            is_active: false,
            dns_cname_verified: false,
            dns_a_verified: false,
            ssl_status: 'pending',
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new domain
        const { data, error } = await supabase
          .from('merchant_domains')
          .insert({
            merchant_id: user.id,
            domain,
            domain_type: domainType,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-domain'] });
      toast.success('Domínio salvo com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar domínio');
    },
  });

  const verifyDns = useMutation({
    mutationFn: async () => {
      if (!domain) throw new Error('Nenhum domínio configurado');

      // Simulate DNS verification (in production, this would call an edge function)
      const { error } = await supabase
        .from('merchant_domains')
        .update({
          status: 'verifying',
          last_dns_check: new Date().toISOString(),
        })
        .eq('id', domain.id);

      if (error) throw error;

      // Simulate verification result (in production, this would be async)
      setTimeout(async () => {
        const isSuccess = Math.random() > 0.3; // 70% success rate for demo
        
        await supabase
          .from('merchant_domains')
          .update({
            status: isSuccess ? 'ssl_provisioning' : 'dns_error',
            dns_cname_verified: isSuccess,
            dns_a_verified: isSuccess,
            dns_error_message: isSuccess ? null : 'Registros DNS não encontrados. Verifique as configurações.',
          })
          .eq('id', domain.id);

        queryClient.invalidateQueries({ queryKey: ['merchant-domain'] });
      }, 3000);
    },
    onSuccess: () => {
      toast.info('Verificando DNS... Isso pode levar alguns segundos.');
      queryClient.invalidateQueries({ queryKey: ['merchant-domain'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao verificar DNS');
    },
  });

  const activateDomain = useMutation({
    mutationFn: async (redirectOldLink: boolean) => {
      if (!domain) throw new Error('Nenhum domínio configurado');

      const { error } = await supabase
        .from('merchant_domains')
        .update({
          is_active: true,
          status: 'active',
          ssl_status: 'active',
          redirect_old_link: redirectOldLink,
        })
        .eq('id', domain.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-domain'] });
      toast.success('Domínio ativado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao ativar domínio');
    },
  });

  const deactivateDomain = useMutation({
    mutationFn: async () => {
      if (!domain) throw new Error('Nenhum domínio configurado');

      const { error } = await supabase
        .from('merchant_domains')
        .update({
          is_active: false,
          status: 'inactive',
        })
        .eq('id', domain.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-domain'] });
      toast.success('Domínio desativado');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao desativar domínio');
    },
  });

  const removeDomain = useMutation({
    mutationFn: async () => {
      if (!domain) throw new Error('Nenhum domínio configurado');

      const { error } = await supabase
        .from('merchant_domains')
        .delete()
        .eq('id', domain.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-domain'] });
      toast.success('Domínio removido');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao remover domínio');
    },
  });

  return {
    domain,
    tutorials,
    isLoading,
    refetch,
    addDomain,
    verifyDns,
    activateDomain,
    deactivateDomain,
    removeDomain,
  };
};

// Hook for admin panel
export const useAdminDomains = (storeId?: string) => {
  const queryClient = useQueryClient();

  const { data: domain, isLoading, refetch } = useQuery({
    queryKey: ['admin-store-domain', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .from('merchant_domains')
        .select('*')
        .eq('merchant_id', storeId)
        .maybeSingle();

      if (error) throw error;
      return data as MerchantDomain | null;
    },
    enabled: !!storeId,
  });

  const { data: logs } = useQuery({
    queryKey: ['admin-domain-logs', domain?.id],
    queryFn: async () => {
      if (!domain?.id) return [];

      const { data, error } = await supabase
        .from('domain_verification_logs')
        .select('*')
        .eq('domain_id', domain.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!domain?.id,
  });

  const forceVerifyDns = useMutation({
    mutationFn: async () => {
      if (!domain) throw new Error('Nenhum domínio configurado');

      // Log the verification attempt
      await supabase.from('domain_verification_logs').insert({
        domain_id: domain.id,
        verification_type: 'dns',
        status: 'checking',
        expected_value: `CNAME: ${domain.expected_cname}, A: ${domain.expected_ip}`,
      });

      const { error } = await supabase
        .from('merchant_domains')
        .update({
          status: 'verifying',
          last_dns_check: new Date().toISOString(),
        })
        .eq('id', domain.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-domain'] });
      queryClient.invalidateQueries({ queryKey: ['admin-domain-logs'] });
      toast.success('Verificação DNS iniciada');
    },
  });

  const reprocessSsl = useMutation({
    mutationFn: async () => {
      if (!domain) throw new Error('Nenhum domínio configurado');

      await supabase.from('domain_verification_logs').insert({
        domain_id: domain.id,
        verification_type: 'ssl',
        status: 'provisioning',
      });

      const { error } = await supabase
        .from('merchant_domains')
        .update({
          ssl_status: 'provisioning',
          last_ssl_check: new Date().toISOString(),
        })
        .eq('id', domain.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-domain'] });
      queryClient.invalidateQueries({ queryKey: ['admin-domain-logs'] });
      toast.success('Reprocessamento SSL iniciado');
    },
  });

  const adminDeactivateDomain = useMutation({
    mutationFn: async () => {
      if (!domain) throw new Error('Nenhum domínio configurado');

      const { error } = await supabase
        .from('merchant_domains')
        .update({
          is_active: false,
          status: 'inactive',
        })
        .eq('id', domain.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-domain'] });
      toast.success('Domínio desativado');
    },
  });

  const adminRemoveDomain = useMutation({
    mutationFn: async () => {
      if (!domain) throw new Error('Nenhum domínio configurado');

      const { error } = await supabase
        .from('merchant_domains')
        .delete()
        .eq('id', domain.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-domain'] });
      toast.success('Domínio removido');
    },
  });

  const toggleRedirect = useMutation({
    mutationFn: async () => {
      if (!domain) throw new Error('Nenhum domínio configurado');

      const { error } = await supabase
        .from('merchant_domains')
        .update({
          redirect_old_link: !domain.redirect_old_link,
        })
        .eq('id', domain.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-store-domain'] });
      toast.success('Redirecionamento atualizado');
    },
  });

  return {
    domain,
    logs,
    isLoading,
    refetch,
    forceVerifyDns,
    reprocessSsl,
    adminDeactivateDomain,
    adminRemoveDomain,
    toggleRedirect,
  };
};
