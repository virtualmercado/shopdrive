import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Mail, 
  Store, 
  Check, 
  LogOut, 
  AlertCircle,
  Loader2,
  KeyRound,
  Lock,
  Send
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Cores da VirtualMercado
const VM_PRIMARY = "#6a1b9a";
const VM_ORANGE = "#f97316";

interface CheckoutIdentificationCardProps {
  user: any;
  session: any;
  userProfile: any;
  onProfileUpdate: (profile: any) => void;
  onValidationChange: (isValid: boolean) => void;
  onGuestDataChange: (data: GuestData | null) => void;
}

export interface GuestData {
  fullName: string;
  email: string;
  storeName: string;
}

type CardState = "logged_in" | "not_logged_in" | "email_exists";

const CheckoutIdentificationCard = ({
  user,
  session,
  userProfile,
  onProfileUpdate,
  onValidationChange,
  onGuestDataChange,
}: CheckoutIdentificationCardProps) => {
  // Estados do card
  const [cardState, setCardState] = useState<CardState>(
    user && session ? "logged_in" : "not_logged_in"
  );
  
  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [storeName, setStoreName] = useState("");
  
  // Validation errors
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    storeName?: string;
  }>({});
  
  // Email check state
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  
  // Login modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Sync state with auth
  useEffect(() => {
    if (user && session) {
      setCardState("logged_in");
      onValidationChange(true);
    } else {
      setCardState("not_logged_in");
    }
  }, [user, session]);

  // Auto-suggest store name from full name
  useEffect(() => {
    if (fullName && !storeName) {
      const firstName = fullName.split(" ")[0];
      if (firstName.length > 2) {
        setStoreName(`Loja ${firstName}`);
      }
    }
  }, [fullName]);

  // Validate form and notify parent
  const validateForm = useCallback(() => {
    const newErrors: typeof errors = {};
    let isValid = true;

    if (!fullName.trim()) {
      newErrors.fullName = "Informe seu nome";
      isValid = false;
    } else if (fullName.trim().length < 3) {
      newErrors.fullName = "Nome muito curto";
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = "Informe um e-mail válido";
      isValid = false;
    } else if (!emailRegex.test(email)) {
      newErrors.email = "E-mail inválido";
      isValid = false;
    }

    if (!storeName.trim()) {
      newErrors.storeName = "Informe o nome da loja";
      isValid = false;
    } else if (storeName.trim().length < 3) {
      newErrors.storeName = "Nome da loja muito curto";
      isValid = false;
    }

    setErrors(newErrors);

    // If email exists, form is not valid for proceeding without login
    if (emailExists) {
      isValid = false;
    }

    onValidationChange(isValid);
    
    if (isValid) {
      onGuestDataChange({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        storeName: storeName.trim(),
      });
    } else {
      onGuestDataChange(null);
    }

    return isValid;
  }, [fullName, email, storeName, emailExists, onValidationChange, onGuestDataChange]);

  // Run validation when form changes
  useEffect(() => {
    if (cardState === "not_logged_in") {
      validateForm();
    }
  }, [fullName, email, storeName, cardState, validateForm]);

  // Check if email exists
  const checkEmailExists = useCallback(async (emailToCheck: string) => {
    if (!emailToCheck || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToCheck)) {
      setEmailExists(false);
      setCardState("not_logged_in");
      return;
    }

    setIsCheckingEmail(true);
    try {
      // Check if email exists in profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", emailToCheck.toLowerCase())
        .maybeSingle();

      if (data) {
        setEmailExists(true);
        setCardState("email_exists");
        // Track analytics
        console.log("checkout_email_exists_detected", { email: emailToCheck });
      } else {
        setEmailExists(false);
        setCardState("not_logged_in");
      }
    } catch (error) {
      console.error("Error checking email:", error);
      setEmailExists(false);
    } finally {
      setIsCheckingEmail(false);
    }
  }, []);

  // Debounce email check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email && cardState !== "logged_in") {
        checkEmailExists(email);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email, checkEmailExists, cardState]);

  // Send magic link
  const handleSendMagicLink = async () => {
    if (!email) return;

    setIsSendingMagicLink(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          emailRedirectTo: window.location.href,
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
      toast.success("Código de acesso enviado! Verifique seu e-mail.");
      console.log("checkout_magic_link_requested", { email });
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar código de acesso");
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  // Login with password
  const handlePasswordLogin = async () => {
    if (!email || !password) return;

    setIsLoggingIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (error) throw error;

      setShowPasswordModal(false);
      setCardState("logged_in");
      toast.success("Login realizado com sucesso!");
      console.log("checkout_login_success", { email });

      // Fetch profile
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();
        if (profile) {
          onProfileUpdate(profile);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "E-mail ou senha incorretos");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCardState("not_logged_in");
    setFullName("");
    setEmail("");
    setStoreName("");
    setEmailExists(false);
    onProfileUpdate(null);
    onValidationChange(false);
    onGuestDataChange(null);
  };

  // Track view
  useEffect(() => {
    console.log("checkout_identification_viewed", { state: cardState });
  }, []);

  // Render logged in state (compact summary)
  if (cardState === "logged_in" && userProfile) {
    return (
      <Card className="mb-6 border-green-200 bg-green-50/30">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: VM_PRIMARY }}
              >
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">
                    {userProfile.full_name || "Usuário"}
                  </h3>
                  <Badge 
                    className="text-xs"
                    style={{ backgroundColor: "#22c55e" }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{userProfile.email}</p>
                {userProfile.store_name && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Store className="h-3 w-3" />
                    {userProfile.store_name}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Trocar conta
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render form state (not logged in or email exists)
  return (
    <>
      <Card className="mb-6">
        <CardContent className="p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: VM_PRIMARY }}
            >
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Identificação</h3>
              <p className="text-sm text-gray-600">
                Informe seus dados para concluir a assinatura
              </p>
            </div>
          </div>

          {/* Email Exists Alert */}
          {cardState === "email_exists" && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">
                    Encontramos uma conta com este e-mail.
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Faça login para continuar com sua assinatura.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <Button
                      onClick={handleSendMagicLink}
                      disabled={isSendingMagicLink || magicLinkSent}
                      className="text-white"
                      style={{ backgroundColor: VM_PRIMARY }}
                    >
                      {isSendingMagicLink ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : magicLinkSent ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {magicLinkSent ? "Código enviado!" : "Receber código de acesso"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      Entrar com senha
                    </Button>
                  </div>
                  {magicLinkSent && (
                    <p className="text-xs text-amber-600 mt-2">
                      Verifique sua caixa de entrada e spam. O código expira em 1 hora.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Nome Completo */}
            <div className="md:col-span-1">
              <Label htmlFor="checkout-name" className="text-sm font-medium">
                Nome completo <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="checkout-name"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={cn(
                    "pl-10",
                    errors.fullName && "border-red-500 focus-visible:ring-red-500"
                  )}
                  disabled={cardState === "email_exists"}
                />
              </div>
              {errors.fullName && (
                <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>
              )}
            </div>

            {/* E-mail */}
            <div className="md:col-span-1">
              <Label htmlFor="checkout-email" className="text-sm font-medium">
                E-mail <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="checkout-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "pl-10 pr-10",
                    errors.email && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {isCheckingEmail && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                )}
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email}</p>
              )}
              {cardState === "not_logged_in" && !errors.email && email && (
                <p className="text-xs text-gray-500 mt-1">
                  Se você ainda não tem conta, criaremos uma automaticamente após o pagamento.
                </p>
              )}
            </div>

            {/* Nome da Loja */}
            <div className="md:col-span-1">
              <Label htmlFor="checkout-store" className="text-sm font-medium">
                Nome da loja <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="checkout-store"
                  placeholder="Nome da sua loja"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className={cn(
                    "pl-10",
                    errors.storeName && "border-red-500 focus-visible:ring-red-500"
                  )}
                  disabled={cardState === "email_exists"}
                />
              </div>
              {errors.storeName && (
                <p className="text-xs text-red-500 mt-1">{errors.storeName}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Login Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Entrar com senha</DialogTitle>
            <DialogDescription>
              Digite sua senha para continuar com a assinatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="login-email">E-mail</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                disabled
                className="mt-1 bg-gray-50"
              />
            </div>
            <div>
              <Label htmlFor="login-password">Senha</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                />
              </div>
            </div>
            <Button
              onClick={handlePasswordLogin}
              disabled={isLoggingIn || !password}
              className="w-full text-white"
              style={{ backgroundColor: VM_PRIMARY }}
            >
              {isLoggingIn ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Entrar
            </Button>
            <Button
              variant="link"
              className="w-full text-sm"
              onClick={() => {
                setShowPasswordModal(false);
                handleSendMagicLink();
              }}
            >
              Esqueci minha senha
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CheckoutIdentificationCard;
