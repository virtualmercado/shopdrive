import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import iconShopDrive from "@/assets/icon-shopdrive.png";

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres")
      .max(100, "Senha muito longa")
      .regex(/[0-9]/, "A senha deve conter pelo menos 1 número")
      .regex(/[a-zA-Z]/, "A senha deve conter pelo menos 1 letra"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const navigate = useNavigate();
  const { user, updatePassword } = useAuth();
  const { toast } = useToast();

  // Handle PKCE code exchange and recovery event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get("code");
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = hashParams.get("type") || queryParams.get("type");

    if (type === "recovery") {
      setSessionReady(true);
    }

    if (code) {
      setValidating(true);
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            toast({
              title: "Link inválido ou expirado",
              description: "Solicite um novo link de recuperação.",
              variant: "destructive",
            });
          } else {
            setSessionReady(true);
          }
        })
        .finally(() => {
          setValidating(false);
          window.history.replaceState({}, document.title, "/reset-password");
        });
    }

    return () => subscription.unsubscribe();
  }, [toast]);

  useEffect(() => {
    if (user && !sessionReady && !validating) {
      // User is logged in but not in recovery mode — they likely navigated here directly
      setSessionReady(true);
    }
  }, [user, sessionReady, validating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = passwordSchema.parse({ newPassword, confirmPassword });
      const { error } = await updatePassword(validated.newPassword);

      if (!error) {
        setSuccess(true);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Dados inválidos",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <div className="mx-auto flex items-center justify-center mb-2">
            <img src={iconShopDrive} alt="ShopDrive" className="h-12 w-auto object-contain" />
          </div>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Senha atualizada com sucesso!</h1>
          <p className="text-muted-foreground">Faça login novamente com sua nova senha.</p>
          <Button asChild className="w-full">
            <Link to="/login">Ir para o login</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center mb-4">
            <img src={iconShopDrive} alt="ShopDrive" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Redefinir senha</h1>
          <p className="text-muted-foreground">Defina uma nova senha para acessar sua conta</p>
        </div>

        {!sessionReady && !validating ? (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Nenhuma sessão de recuperação ativa. Solicite um novo link de recuperação.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </div>
        ) : validating ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Validando link...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                <li className={newPassword.length >= 8 ? "text-green-600" : ""}>• Mínimo 8 caracteres</li>
                <li className={/[0-9]/.test(newPassword) ? "text-green-600" : ""}>• Pelo menos 1 número</li>
                <li className={/[a-zA-Z]/.test(newPassword) ? "text-green-600" : ""}>• Pelo menos 1 letra</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Atualizar senha"}
            </Button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-primary hover:underline">
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;
