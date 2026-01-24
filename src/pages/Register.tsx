import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Store, Tag } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTemplateBySlug } from "@/hooks/useBrandTemplates";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { toast } from "sonner";

const registerSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  email: z.string().email("Email inválido").max(255),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(100),
  confirmPassword: z.string(),
  storeName: z.string().min(3, "Nome da loja deve ter no mínimo 3 caracteres").max(100),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const Register = () => {
  const [searchParams] = useSearchParams();
  const templateSlug = searchParams.get('template');
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    storeName: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, signUp } = useAuth();
  
  const { data: template } = useTemplateBySlug(templateSlug);

  useEffect(() => {
    if (user) {
      navigate('/lojista', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      registerSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return;
      }
    }

    setLoading(true);

    try {
      const { data, error } = await signUp(
        formData.email,
        formData.password,
        formData.name,
        formData.storeName
      );
      
      if (!error && data?.user) {
        // If registering via template, clone the complete template to the new store
        if (template && template.id) {
          try {
            // Use the new clone_template_to_store function that copies everything
            const { error: cloneError } = await supabase
              .rpc('clone_template_to_store', { 
                p_template_id: template.id,
                p_user_id: data.user.id 
              });

            if (cloneError) {
              console.error('Error cloning template:', cloneError);
              toast.warning('Loja criada, mas houve um erro ao copiar a configuração do template.');
            } else {
              toast.success(`Sua loja foi criada com toda a configuração da marca ${template.name}!`);
            }
          } catch (copyError) {
            console.error('Error copying template:', copyError);
            toast.warning('Loja criada, mas houve um erro ao copiar os produtos do template.');
          }
        }
        
        navigate("/lojista");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.id]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <Store className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary">VirtualMercado</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Crie sua conta</h1>
          <p className="text-muted-foreground">Comece a vender online hoje mesmo</p>
        </div>

        {/* Template Banner */}
        {template && template.is_link_active && (
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <Tag className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              Você está criando sua loja da marca: <strong>{template.name}</strong>
              <br />
              <span className="text-xs text-muted-foreground">
                Sua loja será criada com produtos, layout e configurações da marca.
              </span>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              type="text"
              placeholder="João Silva"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="storeName">Nome da loja</Label>
            <Input
              id="storeName"
              type="text"
              placeholder="Minha Loja Virtual"
              value={formData.storeName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-secondary hover:bg-secondary/90"
            disabled={loading}
          >
            {loading ? "Criando conta..." : "Criar Conta Grátis"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Já tem uma conta? </span>
          <Link to="/login" className="text-primary hover:underline font-medium">
            Fazer login
          </Link>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Ao criar uma conta, você concorda com nossos Termos de Uso e Política de Privacidade
        </p>
      </Card>
    </div>
  );
};

export default Register;