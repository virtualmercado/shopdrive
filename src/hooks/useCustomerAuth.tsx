import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTemplatePreviewSandbox } from '@/contexts/TemplatePreviewContext';
import { useStorePath } from '@/contexts/PublicStoreRuntime';
import { classifyPublicPersona } from '@/lib/publicPersona';

async function resolveIsConsumer(u: User): Promise<boolean> {
  try {
    const [roles, prof, cust] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', u.id),
      supabase.from('profiles').select('store_slug, is_template_profile').eq('id', u.id).maybeSingle(),
      supabase.from('customer_profiles').select('id').eq('id', u.id).maybeSingle(),
    ]);
    const failed = !!(roles.error || prof.error || cust.error);
    return classifyPublicPersona({
      roles: (roles.data ?? []).map((r: any) => String(r.role)),
      isMerchant: !!prof.data?.store_slug || prof.data?.is_template_profile === true,
      hasCustomerProfile: !!cust.data,
      customerMetadata: u.user_metadata?.is_customer === true,
      lookupFailed: failed,
    }) === 'consumer';
  } catch {
    return false;
  }
}

const PREVIEW_AUTH_ERROR = 'Autenticação desabilitada no preview do template.';

export const useCustomerAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isTemplatePreview } = useTemplatePreviewSandbox();
  const storePath = useStorePath();

  useEffect(() => {
    if (isTemplatePreview) {
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }

    let gen = 0;
    const apply = (nextSession: Session | null) => {
      const my = ++gen;
      const u = nextSession?.user ?? null;
      if (!u) {
        setSession(null); setUser(null); setLoading(false);
        return;
      }
      setLoading(true);
      // Defer DB calls outside the auth callback.
      setTimeout(() => {
        void resolveIsConsumer(u).then((ok) => {
          if (my !== gen) return;
          setSession(ok ? nextSession : null);
          setUser(ok ? u : null);
          setLoading(false);
        });
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => apply(nextSession)
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => apply(currentSession));

    return () => subscription.unsubscribe();
  }, [isTemplatePreview]);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    storeSlug: string,
    additionalData?: {
      phone?: string;
      birth_date?: string;
      person_type?: string;
      gender?: string;
      cpf?: string;
      cep?: string;
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
    },
    storeOwnerId?: string
  ) => {
    if (isTemplatePreview) {
      return { data: null, error: new Error(PREVIEW_AUTH_ERROR) };
    }

    const accountPath = storePath('/conta');
    const redirectUrl = `${window.location.origin}${accountPath === '#' ? `/${storeSlug}/conta` : accountPath}`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          is_customer: true,
        }
      }
    });

    if (error) {
      let errorMessage = error.message;
      if (error.message.includes('already registered')) {
        errorMessage = 'Este e-mail já está cadastrado. Tente fazer login.';
      }
      toast({
        title: "Erro ao criar conta",
        description: errorMessage,
        variant: "destructive",
      });
      return { data: null, error };
    }

    if (data?.user) {
      const profileData = {
        id: data.user.id,
        full_name: fullName,
        email: email,
        phone: additionalData?.phone || null,
        birth_date: additionalData?.birth_date || null,
        person_type: additionalData?.person_type || null,
        gender: additionalData?.gender || null,
        cpf: additionalData?.cpf ? additionalData.cpf.replace(/\D/g, '') : null,
      };

      const { error: profileError } = await supabase.from('customer_profiles').upsert(
        profileData,
        { onConflict: 'id' }
      );

      if (profileError) {
        console.error('Error creating customer profile:', profileError);
      }

      if (additionalData?.cep && additionalData?.street && additionalData?.number) {
        const addressData = {
          customer_id: data.user.id,
          recipient_name: fullName,
          cep: additionalData.cep.replace(/\D/g, ''),
          street: additionalData.street,
          number: additionalData.number,
          complement: additionalData.complement || null,
          neighborhood: additionalData.neighborhood || '',
          city: additionalData.city || '',
          state: additionalData.state || '',
          is_default: true,
          store_owner_id: storeOwnerId || null,
        };

        const { error: addressError } = await supabase.from('customer_addresses').insert(addressData);

        if (addressError) {
          console.error('Error creating customer address:', addressError);
        }
      }
    }

    toast({
      title: "Conta criada com sucesso!",
      description: "Você já pode acessar sua conta.",
    });

    return { data, error: null };
  };

  const signIn = async (email: string, password: string) => {
    if (isTemplatePreview) {
      return { error: new Error(PREVIEW_AUTH_ERROR) };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Login realizado!",
      description: "Bem-vindo de volta!",
    });

    return { data, error: null };
  };

  const signOut = async () => {
    if (isTemplatePreview) {
      return { error: new Error(PREVIEW_AUTH_ERROR) };
    }

    // Only a classified consumer session may be ended from the storefront.
    if (!user) return { error: null };
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
    }

    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    if (isTemplatePreview) {
      return { error: new Error(PREVIEW_AUTH_ERROR) };
    }
    if (!user) {
      return { error: new Error('Sessão de cliente não encontrada.') };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Senha alterada!",
      description: "Sua senha foi atualizada com sucesso.",
    });

    return { error: null };
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updatePassword,
  };
};
