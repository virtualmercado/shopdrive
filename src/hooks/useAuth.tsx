import { useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logAuditEvent } from '@/lib/auditLog';

export const useAuth = () => {
  const { user, session, loading } = useAuthContext();
  const { toast } = useToast();

  const signUp = useCallback(async (email: string, password: string, fullName: string, storeName: string) => {
    const redirectUrl = `${window.location.origin}/lojista`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          store_name: storeName,
        }
      }
    });

    if (error) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Conta criada com sucesso!",
      description: "Você já pode acessar seu painel.",
    });

    return { data, error: null };
  }, [toast]);

  const signIn = useCallback(async (email: string, password: string) => {
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

    logAuditEvent({
      action: "login",
      entityType: "auth",
      description: "Usuário realizou login no sistema",
    });

    toast({
      title: "Login realizado!",
      description: "Redirecionando para o painel...",
    });

    return { data, error: null };
  }, [toast]);

  const signOut = useCallback(async () => {
    await logAuditEvent({
      action: "logout",
      entityType: "auth",
      description: "Usuário saiu do sistema",
    });

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
  }, [toast]);

  const resetPassword = useCallback(async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      toast({
        title: "Erro ao enviar e-mail",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "E-mail enviado!",
      description: "Verifique sua caixa de entrada para redefinir sua senha.",
    });

    return { error: null };
  }, [toast]);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Senha atualizada!",
      description: "Sua nova senha foi salva com sucesso.",
    });

    return { error: null };
  }, [toast]);

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  };
};
