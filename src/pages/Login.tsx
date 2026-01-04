import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import logoVirtualMercado from "@/assets/logo-virtual-mercado.png";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .email("Email inválido")
    .max(255, "Email muito longo")
    .toLowerCase()
    .trim(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa"),
});

const passwordResetSchema = z
  .object({
    newPassword: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa"),
    confirmNewPassword: z.string().min(6, "Confirme sua senha").max(100, "Senha muito longa"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "As senhas não coincidem",
    path: ["confirmNewPassword"],
  });

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  const [isSetNewPasswordMode, setIsSetNewPasswordMode] = useState(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);

    const type = hashParams.get("type") || queryParams.get("type");
    const mode = queryParams.get("mode");
    const hasCode = queryParams.has("code");

    return type === "recovery" || mode === "recovery" || hasCode;
  });
  const [isValidatingRecoveryLink, setIsValidatingRecoveryLink] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const navigate = useNavigate();
  const { user, signIn, resetPassword, updatePassword } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // When the user comes from the recovery email, Supabase will emit PASSWORD_RECOVERY.
      // We must NOT auto-redirect them to /lojista before they can set a new password.
      if (event === "PASSWORD_RECOVERY") {
        setIsSetNewPasswordMode(true);
        setIsRecoveryMode(false);
        setRecoverySent(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);

    const type = hashParams.get("type") || queryParams.get("type");
    const mode = queryParams.get("mode");
    const code = queryParams.get("code");

    if (type === "recovery" || mode === "recovery" || code) {
      setIsSetNewPasswordMode(true);
      setIsRecoveryMode(false);
      setRecoverySent(false);
    }

    // PKCE-style recovery links include ?code=...
    if (!code) return;

    setIsValidatingRecoveryLink(true);
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          toast({
            title: "Link inválido ou expirado",
            description: "Solicite um novo link de recuperação e tente novamente.",
            variant: "destructive",
          });
          setIsSetNewPasswordMode(false);
        }
      })
      .finally(() => {
        setIsValidatingRecoveryLink(false);
        // Remove code param from URL to avoid re-exchange on refresh.
        window.history.replaceState({}, document.title, "/login?mode=recovery");
      });
  }, [toast]);

  useEffect(() => {
    if (user && !isSetNewPasswordMode) {
      navigate("/lojista", { replace: true });
    }
  }, [user, isSetNewPasswordMode, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = loginSchema.parse({ email, password });

      const { error } = await signIn(validatedData.email, validatedData.password);

      if (!error) {
        navigate("/lojista");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast({
          title: "Dados inválidos",
          description: firstError.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const emailValidation = z.string().email("Email inválido").parse(email);
      const { error } = await resetPassword(emailValidation);

      if (!error) {
        setRecoverySent(true);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Email inválido",
          description: "Por favor, insira um email válido.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) {
        toast({
          title: "Sessão de recuperação não encontrada",
          description: "Seu link pode ter expirado. Solicite um novo link de recuperação.",
          variant: "destructive",
        });
        return;
      }

      const validated = passwordResetSchema.parse({
        newPassword,
        confirmNewPassword,
      });

      const { error } = await updatePassword(validated.newPassword);
      if (!error) {
        window.history.replaceState({}, document.title, "/login");
        navigate("/lojista", { replace: true });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast({
          title: "Dados inválidos",
          description: firstError.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Link to="/" className="flex justify-center mb-6">
            <img src={logoVirtualMercado} alt="VirtualMercado" className="h-12 w-auto" />
          </Link>
          <h1 className="text-3xl font-bold mb-2">
            {isSetNewPasswordMode ? "Redefinir senha" : "Bem-vindo de volta"}
          </h1>
          <p className="text-muted-foreground">
            {isSetNewPasswordMode
              ? "Defina uma nova senha para acessar seu painel"
              : "Entre na sua conta para continuar"}
          </p>
        </div>

        {isSetNewPasswordMode ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirm-new-password"
                  type={showConfirmNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={loading || isValidatingRecoveryLink}
            >
              {isValidatingRecoveryLink
                ? "Validando link..."
                : loading
                  ? "Salvando..."
                  : "Salvar nova senha"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  window.history.replaceState({}, document.title, "/login");
                  setIsSetNewPasswordMode(false);
                }}
                className="text-sm text-primary hover:underline"
              >
                Voltar ao login
              </button>
            </div>
          </form>
        ) : !isRecoveryMode ? (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-input" />
                  <span>Lembrar-me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsRecoveryMode(true)}
                  className="text-primary hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Não tem uma conta? </span>
              <Link to="/register" className="text-primary hover:underline font-medium">
                Cadastre-se grátis
              </Link>
            </div>
          </>
        ) : recoverySent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">E-mail enviado!</h2>
            <p className="text-muted-foreground">
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setIsRecoveryMode(false);
                setRecoverySent(false);
                setEmail("");
              }}
              className="mt-4"
            >
              Voltar ao login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleRecoverPassword} className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold">Recuperar senha</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Digite seu e-mail para receber um link de recuperação
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <Input
                id="recovery-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRecoveryMode(false);
                  setEmail("");
                }}
                className="text-sm text-primary hover:underline"
              >
                Voltar ao login
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};

export default Login;
