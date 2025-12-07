import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email muito longo").toLowerCase().trim(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa")
});

const registerSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo").trim(),
  email: z.string().email("Email inválido").max(255, "Email muito longo").toLowerCase().trim(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"]
});

const CustomerAuth = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const navigate = useNavigate();
  const { user, signIn, signUp } = useCustomerAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate(`/loja/${storeSlug}/conta`, { replace: true });
    }
  }, [user, navigate, storeSlug]);

  useEffect(() => {
    const fetchStoreProfile = async () => {
      if (!storeSlug) return;
      const { data } = await supabase
        .from('profiles')
        .select('store_name, store_logo_url, primary_color, button_bg_color, button_text_color, button_border_style')
        .eq('store_slug', storeSlug)
        .single();
      if (data) setStoreProfile(data);
    };
    fetchStoreProfile();
  }, [storeSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const validatedData = loginSchema.parse({ email, password });
        const { error } = await signIn(validatedData.email, validatedData.password);
        if (!error) {
          navigate(`/loja/${storeSlug}/conta`);
        }
      } else {
        const validatedData = registerSchema.parse({ fullName, email, password, confirmPassword });
        const { error } = await signUp(validatedData.email, validatedData.password, validatedData.fullName, storeSlug || '');
        if (!error) {
          navigate(`/loja/${storeSlug}/conta`);
        }
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

  const buttonBgColor = storeProfile?.button_bg_color || storeProfile?.primary_color || '#6a1b9a';
  const buttonTextColor = storeProfile?.button_text_color || '#FFFFFF';
  const buttonBorderStyle = storeProfile?.button_border_style === 'straight' ? '0' : '0.5rem';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6">
          <Link 
            to={`/loja/${storeSlug}`} 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a loja
          </Link>
        </div>

        <div className="text-center mb-8">
          {storeProfile?.store_logo_url ? (
            <img 
              src={storeProfile.store_logo_url} 
              alt={storeProfile.store_name || 'Logo da loja'} 
              className="h-16 mx-auto mb-4 object-contain"
            />
          ) : (
            <h2 className="text-xl font-semibold mb-2">{storeProfile?.store_name || 'Loja'}</h2>
          )}
          <h1 className="text-2xl font-bold mb-2">
            {isLogin ? 'Entrar na sua conta' : 'Criar sua conta'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isLogin ? 'Acesse sua conta para ver seus pedidos' : 'Crie sua conta para acompanhar seus pedidos'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
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
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full"
            disabled={loading}
            style={{
              backgroundColor: buttonBgColor,
              color: buttonTextColor,
              borderRadius: buttonBorderStyle,
            }}
          >
            {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">
            {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
          </span>
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="font-medium hover:underline"
            style={{ color: buttonBgColor }}
          >
            {isLogin ? "Criar conta" : "Entrar"}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default CustomerAuth;
