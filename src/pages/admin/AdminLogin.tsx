import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRoleCheck } from "@/hooks/useRoleCheck";
import { toast } from "sonner";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  const navigate = useNavigate();
  const { signIn, user, loading: authLoading } = useAuth();
  const { hasAnyRole, loading: roleLoading } = useRoleCheck();

  // Redirect if already logged in as admin
  useEffect(() => {
    if (!authLoading && !roleLoading && user) {
      if (hasAnyRole(['admin', 'financeiro', 'suporte', 'tecnico'])) {
        navigate('/gestor', { replace: true });
      }
    }
  }, [user, authLoading, roleLoading, hasAnyRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const { error: signInError } = await signIn(email, password);
      
      if (signInError) {
        setError("Credenciais inválidas. Verifique seu e-mail e senha.");
        return;
      }

      // The useEffect will handle the redirect after roles are loaded
      toast.success("Login realizado com sucesso!");
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@virtualmercado.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
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
