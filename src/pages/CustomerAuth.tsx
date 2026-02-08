import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email muito longo").toLowerCase().trim(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa")
});

const registerSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo").trim(),
  email: z.string().email("Email inválido").max(255, "Email muito longo").toLowerCase().trim(),
  cpf: z.string().min(11, "CPF inválido").max(14, "CPF inválido"),
  phone: z.string().min(10, "Telefone inválido").max(15, "Telefone inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa"),
  receivePromotions: z.boolean().optional()
});

type AuthMode = 'login' | 'register' | 'recover';

const CustomerAuth = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [receivePromotions, setReceivePromotions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [recoverySent, setRecoverySent] = useState(false);
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
        .select('*')
        .eq('store_slug', storeSlug)
        .single();
      if (data) setStoreProfile(data);
    };
    fetchStoreProfile();
  }, [storeSlug]);

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = loginSchema.parse({ email, password });
      const { error } = await signIn(validatedData.email, validatedData.password);
      if (!error) {
        navigate(`/loja/${storeSlug}/conta`);
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = registerSchema.parse({ 
        fullName, 
        email, 
        cpf: cpf.replace(/\D/g, ''), 
        phone: phone.replace(/\D/g, ''), 
        password,
        receivePromotions 
      });
      
      const { data, error } = await signUp(validatedData.email, validatedData.password, validatedData.fullName, storeSlug || '');
      
      if (!error && data?.user) {
        // Update customer_profiles with additional data
        await supabase.from('customer_profiles').update({
          phone: validatedData.phone,
          cpf: validatedData.cpf,
          receive_promotions: validatedData.receivePromotions
        }).eq('id', data.user.id);
        
        navigate(`/loja/${storeSlug}/conta`);
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

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/loja/${storeSlug}/conta`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) {
        toast({
          title: "Erro ao enviar e-mail",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setRecoverySent(true);
        toast({
          title: "E-mail enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const buttonBgColor = storeProfile?.button_bg_color || storeProfile?.primary_color || '#6a1b9a';
  const buttonTextColor = storeProfile?.button_text_color || '#FFFFFF';
  const buttonBorderStyle = storeProfile?.button_border_style === 'straight' ? '0' : '0.5rem';

  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-12"
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
            className="h-12 pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="text-right">
        <button
          type="button"
          onClick={() => setMode('recover')}
          className="text-sm hover:underline"
          style={{ color: buttonBgColor }}
        >
          Esqueci a senha
        </button>
      </div>

      <Button 
        type="submit" 
        className="w-full h-12 text-base font-medium"
        disabled={loading}
        style={{
          backgroundColor: buttonBgColor,
          color: buttonTextColor,
          borderRadius: buttonBorderStyle,
        }}
      >
        {loading ? "Entrando..." : "Entrar"}
      </Button>

      <div className="text-center text-sm pt-4">
        <span className="text-muted-foreground">Não tem uma conta? </span>
        <button
          type="button"
          onClick={() => setMode('register')}
          className="font-medium hover:underline"
          style={{ color: buttonBgColor }}
        >
          Criar conta
        </button>
      </div>
    </form>
  );

  const renderRegisterForm = () => (
    <form onSubmit={handleRegister} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input
          id="fullName"
          type="text"
          placeholder="Seu nome completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="h-12"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-12"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cpf">CPF</Label>
        <Input
          id="cpf"
          type="text"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(formatCpf(e.target.value))}
          required
          className="h-12"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="(00) 00000-0000"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          required
          className="h-12"
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
            className="h-12 pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Checkbox 
          id="promotions" 
          checked={receivePromotions}
          onCheckedChange={(checked) => setReceivePromotions(checked as boolean)}
        />
        <label
          htmlFor="promotions"
          className="text-sm text-muted-foreground cursor-pointer"
        >
          Desejo receber promoções por e-mail
        </label>
      </div>

      <Button 
        type="submit" 
        className="w-full h-12 text-base font-medium mt-4"
        disabled={loading}
        style={{
          backgroundColor: buttonBgColor,
          color: buttonTextColor,
          borderRadius: buttonBorderStyle,
        }}
      >
        {loading ? "Cadastrando..." : "Cadastrar"}
      </Button>

      <div className="text-center text-sm pt-4">
        <span className="text-muted-foreground">Já tem uma conta? </span>
        <button
          type="button"
          onClick={() => setMode('login')}
          className="font-medium hover:underline"
          style={{ color: buttonBgColor }}
        >
          Entrar
        </button>
      </div>
    </form>
  );

  const renderRecoverForm = () => (
    <form onSubmit={handleRecoverPassword} className="space-y-5">
      {!recoverySent ? (
        <>
          <p className="text-muted-foreground text-center mb-6">
            Enviaremos para você um e-mail com um link para criar uma nova senha
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium"
            disabled={loading}
            style={{
              backgroundColor: buttonBgColor,
              color: buttonTextColor,
              borderRadius: buttonBorderStyle,
            }}
          >
            {loading ? "Enviando..." : "Enviar e-mail"}
          </Button>
        </>
      ) : (
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">E-mail enviado!</h3>
          <p className="text-muted-foreground mb-4">
            Verifique sua caixa de entrada e clique no link para redefinir sua senha.
          </p>
        </div>
      )}

      <div className="text-center text-sm pt-4">
        <button
          type="button"
          onClick={() => { setMode('login'); setRecoverySent(false); }}
          className="font-medium hover:underline flex items-center justify-center gap-2 mx-auto"
          style={{ color: buttonBgColor }}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o login
        </button>
      </div>
    </form>
  );

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Entrar na sua conta';
      case 'register': return 'Criar conta';
      case 'recover': return 'Recuperar senha';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: storeProfile?.font_family || 'Inter' }}>
      {/* Simple Header */}
      <header 
        className="border-b py-4 px-4"
        style={{ 
          backgroundColor: storeProfile?.secondary_color || '#FFFFFF',
          color: storeProfile?.footer_text_color || '#000000'
        }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <Link to={`/loja/${storeSlug}`}>
            {storeProfile?.store_logo_url ? (
              <img 
                src={storeProfile.store_logo_url} 
                alt={storeProfile.store_name || 'Logo da loja'} 
                className="h-10 object-contain"
              />
            ) : (
              <span className="font-semibold text-lg">{storeProfile?.store_name || 'Loja'}</span>
            )}
          </Link>
          <Link 
            to={`/loja/${storeSlug}`} 
            className="text-sm flex items-center gap-1 hover:underline"
            style={{ color: storeProfile?.footer_text_color || '#000000' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a loja
          </Link>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-md">
          {/* Logo clickable */}
          <Link to={`/loja/${storeSlug}`} className="block text-center mb-8">
            {storeProfile?.store_logo_url ? (
              <img 
                src={storeProfile.store_logo_url} 
                alt={storeProfile.store_name || 'Logo da loja'} 
                className="h-16 mx-auto object-contain"
              />
            ) : (
              <h2 className="text-2xl font-semibold">{storeProfile?.store_name || 'Loja'}</h2>
            )}
          </Link>

          <div className="bg-white rounded-lg shadow-sm border p-6 md:p-8">
            <h1 className="text-xl font-bold text-center mb-6">{getTitle()}</h1>
            
            {mode === 'login' && renderLoginForm()}
            {mode === 'register' && renderRegisterForm()}
            {mode === 'recover' && renderRecoverForm()}
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      {storeProfile && (
        <footer 
          className="py-6 px-4 text-center text-sm"
          style={{ 
            backgroundColor: storeProfile.footer_bg_color || '#1a1a1a',
            color: storeProfile.footer_text_color || '#ffffff'
          }}
        >
          <p>© {new Date().getFullYear()} {storeProfile.store_name}. Todos os direitos reservados.</p>
          <p className="text-xs mt-2 opacity-70">Desenvolvido com ShopDrive</p>
        </footer>
      )}
    </div>
  );
};

export default CustomerAuth;
