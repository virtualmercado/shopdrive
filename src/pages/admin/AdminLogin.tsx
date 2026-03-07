import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import iconShopDrive from "@/assets/icon-shopdrive.png";
import { useAuth } from "@/hooks/useAuth";
import { useRoleCheck } from "@/hooks/useRoleCheck";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const adminAuthSchema = z.object({
  email: z
    .string()
    .email("E-mail inválido")
    .max(255, "E-mail muito longo")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres.")
    .max(100, "Senha muito longa"),
});

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const navigate = useNavigate();
  const { signIn, user, loading: authLoading, resetPassword } = useAuth();
  const { hasAnyRole, loading: roleLoading } = useRoleCheck();

  // Redirect if already logged in as admin
  useEffect(() => {
    if (!authLoading && !roleLoading && user) {
      if (hasAnyRole(["admin", "financeiro", "suporte", "tecnico"])) {
        navigate("/gestor", { replace: true });
      }
    }
  }, [user, authLoading, roleLoading, hasAnyRole, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const parsed = adminAuthSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Dados inválidos.");
      setIsLoading(false);
      return;
    }

    try {
      const { error: signInError } = await signIn(parsed.data.email, parsed.data.password);

      if (signInError) {
        const msg = (signInError.message || "").toLowerCase();
        if (msg.includes("confirm") || msg.includes("not confirmed")) {
          setError(
            "Conta criada, mas o e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou recupere a senha."
          );
        } else {
          setError("Credenciais inválidas. Verifique seu e-mail e senha.");
        }
        return;
      }

      // Verifica se o usuário tem role de admin após login
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUser.id);
        
        const adminRoles = ['admin', 'financeiro', 'suporte', 'tecnico'];
        const hasAdminRole = userRoles?.some(r => adminRoles.includes(r.role)) || false;
        
        if (hasAdminRole) {
          toast.success("Login realizado com sucesso!");
          navigate("/gestor", { replace: true });
          return;
        } else {
          setError("Você não tem permissão de administrador. Entre em contato com um administrador existente para solicitar acesso.");
          await supabase.auth.signOut();
          return;
        }
      }
    } catch (err) {
      setError("Erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#6a1b9a] to-[#4a148c]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setError("");

    const emailParsed = adminAuthSchema.shape.email.safeParse(email);
    if (!emailParsed.success) {
      setError("E-mail inválido.");
      setRecoveryLoading(false);
      return;
    }

    const { error: resetError } = await resetPassword(emailParsed.data);
    if (!resetError) {
      setRecoverySent(true);
    }
    setRecoveryLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#6a1b9a] to-[#4a148c] p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex items-center justify-center mb-4">
            <img src={iconShopDrive} alt="ShopDrive" className="h-16 w-auto object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isRecoveryMode ? "Recuperar senha" : "Painel Master"}
          </CardTitle>
          <CardDescription>
            {isRecoveryMode
              ? "Digite o e-mail cadastrado para receber o link de redefinição."
              : "Acesso exclusivo para administradores da ShopDrive"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRecoveryMode ? (
            recoverySent ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-[#6a1b9a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold">E-mail enviado!</h2>
                <p className="text-muted-foreground text-sm">
                  Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                </p>
                <Button
                  variant="outline"
                  onClick={() => { setIsRecoveryMode(false); setRecoverySent(false); setEmail(""); setError(""); }}
                  className="mt-4"
                >
                  Voltar ao login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRecoverPassword} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="recovery-email">E-mail</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    placeholder="admin@shopdrive.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={recoveryLoading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#6a1b9a] hover:bg-[#5a1580]"
                  disabled={recoveryLoading}
                >
                  {recoveryLoading ? "Enviando..." : "Enviar link de recuperação"}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setIsRecoveryMode(false); setError(""); }}
                    className="text-sm text-[#6a1b9a] hover:underline"
                  >
                    Voltar ao login
                  </button>
                </div>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="admin@shopdrive.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setIsRecoveryMode(true); setError(""); }}
                    className="text-sm text-[#6a1b9a] hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-[#6a1b9a] hover:bg-[#5a1580]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Entrando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Acessar Painel Master
                    </div>
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground">
                  Área restrita. Todas as atividades são registradas.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Para solicitar acesso de administrador, entre em contato com um administrador existente.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;