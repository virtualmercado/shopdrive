import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tag } from "lucide-react";
import logoHeaderSD from "@/assets/logo-header-sd.png";
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
  const conviteStoreId = searchParams.get('convite');
  
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

  // Don't auto-redirect on mount — let the signup flow handle it

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
        const userId = data.user.id;

        // If registering via template, clone the complete template to the new store
        if (template && template.id) {
          // Wait for handle_new_user trigger to create the profile row
          await new Promise(resolve => setTimeout(resolve, 1500));

          let cloneSuccess = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const { error: cloneError } = await supabase
                .rpc('clone_template_to_store', { 
                  p_template_id: template.id,
                  p_user_id: userId 
                });

              if (cloneError) {
                console.error(`[Register] Clone attempt ${attempt + 1} failed:`, cloneError);
                if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
              } else {
                console.info('[Register] Template cloned successfully:', template.id);
                cloneSuccess = true;
                break;
              }
            } catch (copyError) {
              console.error(`[Register] Clone attempt ${attempt + 1} exception:`, copyError);
              if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
            }
          }

          if (cloneSuccess) {
            toast.success(`Sua loja foi criada com toda a configuração da marca ${template.name}!`);
          } else {
            toast.warning('Loja criada, mas houve um erro ao copiar a configuração do template.');
          }

          // Register referral if convite parameter is present
          if (conviteStoreId) {
            try {
              await supabase.rpc('create_store_referral', {
                p_inviter_store_id: conviteStoreId,
                p_new_store_id: userId,
                p_template_id: template.id,
              });
            } catch (refError) {
              console.error('Error creating referral:', refError);
            }
          }

          // Navigate to onboarding with template flag so it skips store creation steps
          navigate(`/onboarding?template=${templateSlug}&cloned=${cloneSuccess ? '1' : '0'}`, { replace: true });
        } else {
          // Non-template flow: register referral if applicable
          if (conviteStoreId && userId) {
            try {
              await supabase.rpc('create_store_referral', {
                p_inviter_store_id: conviteStoreId,
                p_new_store_id: userId,
                p_template_id: null,
              });
            } catch (refError) {
              console.error('Error creating referral:', refError);
            }
          }

          navigate("/onboarding", { replace: true });
        }
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <img src={logoHeaderSD} alt="ShopDrive" className="h-8 w-auto object-contain mx-auto" />
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

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="reg_name">Nome completo</Label>
            <Input
              id="reg_name"
              name="reg_name"
              type="text"
              placeholder="João Silva"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg_storeName">Nome da loja</Label>
            <Input
              id="reg_storeName"
              name="reg_storeName"
              type="text"
              placeholder="Minha Loja Virtual"
              value={formData.storeName}
              onChange={(e) => setFormData(prev => ({ ...prev, storeName: e.target.value }))}
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg_email">Email</Label>
            <Input
              id="reg_email"
              name="reg_email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              autoComplete="new-email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg_password">Senha</Label>
            <Input
              id="reg_password"
              name="reg_password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg_confirmPassword">Confirmar senha</Label>
            <Input
              id="reg_confirmPassword"
              name="reg_confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              autoComplete="new-password"
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