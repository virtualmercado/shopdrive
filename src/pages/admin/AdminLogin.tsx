import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, AlertCircle, Eye, EyeOff, Lock, UserPlus } from "lucide-react";
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
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("login");

  const navigate = useNavigate();
  const { signIn, user, loading: authLoading } = useAuth();
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

      toast.success("Login realizado com sucesso!");
    } catch (err) {
      setError("Erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const parsed = adminAuthSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Dados inválidos.");
      setIsLoading(false);
      return;
    }

    const normalizedEmail = parsed.data.email;
    const normalizedPassword = parsed.data.password;

    try {
      // 1) Tenta entrar: se a conta já existir e a senha estiver correta, promove a admin.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });

      if (signInData?.user) {
        // Usa função RPC segura para auto-promoção
        const { data: promoted, error: roleError } = await supabase.rpc('promote_to_admin');

        if (roleError) {
          setError("Erro ao definir permissões de administrador.");
          return;
        }

        toast.success("Você foi promovido a administrador! Redirecionando...");
        navigate("/gestor", { replace: true });
        return;
      }

      // 2) Se não conseguiu entrar, tenta criar conta.
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: normalizedPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/gestor/login`,
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        const msg = (signUpError.message || "").toLowerCase();
        if (msg.includes("already registered")) {
          setError(
            "Este e-mail já está cadastrado. Use a senha correta da conta existente (ou recupere a senha) para se tornar administrador."
          );
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (!signUpData.user) {
        setError(signInError?.message || "Não foi possível criar a conta. Tente novamente.");
        return;
      }

      // Usa função RPC segura para auto-promoção
      const { error: roleError } = await supabase.rpc('promote_to_admin');

      if (roleError) {
        setError("Conta criada, mas houve um erro ao definir permissões. Entre em contato com o suporte.");
        return;
      }

      // Se por algum motivo não vier sessão (ex: confirmação de e-mail ligada), orienta o próximo passo.
      if (!signUpData.session) {
        toast.success("Conta criada! Se necessário, confirme o e-mail e depois faça login.");
        setActiveTab("login");
        return;
      }

      toast.success("Conta de administrador criada com sucesso!");
      navigate("/gestor", { replace: true });
    } catch (err) {
      setError("Erro ao processar. Tente novamente.");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#6a1b9a] to-[#4a148c] p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-[#6a1b9a] rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Painel Master</CardTitle>
          <CardDescription>
            Acesso exclusivo para administradores da VirtualMercado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">
                Criar Conta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
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
                    placeholder="admin@virtualmercado.com"
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
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Se você já tem uma conta de lojista, use o mesmo e-mail e senha para se tornar administrador.
                    Caso contrário, crie uma nova conta.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome Completo (para nova conta)</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Opcional se você já tem uma conta
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Sua senha"
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
                  <p className="text-xs text-muted-foreground">
                    Use a senha da sua conta existente ou crie uma nova (mínimo 6 caracteres)
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-[#6a1b9a] hover:bg-[#5a1580]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Tornar-me Administrador
                    </div>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Área restrita. Todas as atividades são registradas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
