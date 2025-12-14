import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Key, CheckCircle } from "lucide-react";
import { z } from "zod";

const passwordSchema = z.object({
  newPassword: z.string().min(6, "A senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa"),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

interface CustomerPasswordSectionProps {
  storeProfile: any;
}

const CustomerPasswordSection = ({ storeProfile }: CustomerPasswordSectionProps) => {
  const { updatePassword } = useCustomerAuth();
  const { toast } = useToast();
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = passwordSchema.parse({ newPassword, confirmPassword });
      
      const { error } = await updatePassword(validated.newPassword);
      
      if (!error) {
        setSuccess(true);
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alterar Senha</h1>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-medium mb-2">Senha alterada com sucesso!</h3>
            <p className="text-muted-foreground">
              Sua nova senha já está ativa.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div 
                className="p-3 rounded-full"
                style={{ backgroundColor: `${buttonBgColor}15` }}
              >
                <Key className="h-6 w-6" style={{ color: buttonBgColor }} />
              </div>
              <div>
                <h2 className="font-semibold">Defina uma nova senha</h2>
                <p className="text-sm text-muted-foreground">
                  A senha deve ter pelo menos 6 caracteres
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="h-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12"
              disabled={loading || !newPassword || !confirmPassword}
              style={{ 
                backgroundColor: buttonBgColor, 
                color: buttonTextColor, 
                borderRadius: buttonBorderStyle 
              }}
            >
              {loading ? "Alterando..." : "Alterar senha"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default CustomerPasswordSection;
