import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Subscriber {
  id: string;
  store_name: string | null;
  email: string | null;
  account_status?: string;
}

interface AccountDeletionModalProps {
  subscriber: Subscriber | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AccountDeletionModal = ({
  subscriber,
  open,
  onOpenChange,
}: AccountDeletionModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [adminConfirm, setAdminConfirm] = useState(false);

  const canProceed = confirmText === "EXCLUIR" && adminConfirm;

  const handleClose = () => {
    setStep(1);
    setConfirmText("");
    setAdminConfirm(false);
    onOpenChange(false);
  };

  const handleContinueToStep2 = () => {
    setStep(2);
  };

  const handlePermanentDeletion = async () => {
    if (!subscriber || !user) return;
    
    setIsDeleting(true);
    
    try {
      // 1. Fetch merchant data for legal archive
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", subscriber.id)
        .single();
      
      // 2. Fetch subscription/plan history
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans(name, price)")
        .eq("user_id", subscriber.id);
      
      // 3. Fetch billing history (invoices)
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*")
        .eq("subscriber_id", subscriber.id);
      
      // 4. Create legal archive snapshot
      const retentionYears = 5;
      const retentionUntil = new Date();
      retentionUntil.setFullYear(retentionUntil.getFullYear() + retentionYears);
      
      const { data: archiveData, error: archiveError } = await supabase
        .from("legal_archive_accounts")
        .insert({
          merchant_id: subscriber.id,
          store_name: profile?.store_name || null,
          primary_email: profile?.email || subscriber.email,
          cpf_cnpj_hash: profile?.cpf_cnpj ? btoa(profile.cpf_cnpj) : null,
          created_at: profile?.created_at || new Date().toISOString(),
          plan_history: subscriptions || [],
          billing_history: invoices || [],
          terms_acceptance_logs: [],
          privacy_acceptance_logs: [],
          deletion_audit: {
            admin_id: user.id,
            deleted_at: new Date().toISOString(),
            reason: "requested_by_merchant"
          },
          retention_until: retentionUntil.toISOString(),
        })
        .select("id")
        .single();
      
      if (archiveError) throw archiveError;
      
      // 5. Anonymize/delete operational data
      
      // 5a. Delete products
      await supabase
        .from("products")
        .delete()
        .eq("user_id", subscriber.id);
      
      // 5b. Anonymize orders (keep for reference but remove PII)
      await supabase
        .from("orders")
        .update({
          customer_name: "Cliente Removido",
          customer_email: `deleted_${subscriber.id}@vm.local`,
          customer_phone: null,
        })
        .eq("store_owner_id", subscriber.id);
      
      // 5c. Delete payment settings
      await supabase
        .from("payment_settings")
        .delete()
        .eq("user_id", subscriber.id);
      
      // 5d. Delete marketing settings
      await supabase
        .from("marketing_settings")
        .delete()
        .eq("user_id", subscriber.id);
      
      // 5e. Delete shipping settings
      await supabase
        .from("shipping_rules")
        .delete()
        .eq("user_id", subscriber.id);
      
      await supabase
        .from("correios_settings")
        .delete()
        .eq("user_id", subscriber.id);
      
      await supabase
        .from("melhor_envio_settings")
        .delete()
        .eq("user_id", subscriber.id);
      
      // 5f. Delete coupons
      await supabase
        .from("coupons")
        .delete()
        .eq("user_id", subscriber.id);
      
      // 5g. Delete store customers links
      await supabase
        .from("store_customers")
        .delete()
        .eq("store_owner_id", subscriber.id);
      
      // 5h. Delete whatsapp messages
      await supabase
        .from("whatsapp_messages")
        .delete()
        .eq("store_owner_id", subscriber.id);
      
      // 6. Update profile status
      await supabase
        .from("profiles")
        .update({
          account_status: "excluida",
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          store_slug: null,
          store_name: "Conta Excluída",
          email: `deleted_${subscriber.id}@vm.local`,
          phone: null,
          whatsapp_number: null,
          cpf_cnpj: null,
          address: null,
          store_logo_url: null,
        })
        .eq("id", subscriber.id);
      
      // 7. Update deletion request status
      await supabase
        .from("account_deletion_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user.id,
        })
        .eq("merchant_id", subscriber.id)
        .in("status", ["pending", "in_review", "approved"]);
      
      // 8. Close related tickets
      await supabase
        .from("merchant_support_tickets")
        .update({
          status: "read",
          response: `Concluído — Conta excluída. Arquivo legal ID: ${archiveData?.id}`,
        })
        .eq("merchant_id", subscriber.id)
        .eq("category", "account_deletion");
      
      // 9. Log audit event
      await supabase
        .from("audit_logs")
        .insert({
          user_id: user.id,
          action: "account_deleted",
          entity_type: "profile",
          entity_id: subscriber.id,
          metadata: {
            admin_id: user.id,
            merchant_id: subscriber.id,
            archive_id: archiveData?.id,
            reason: "requested_by_merchant"
          }
        });
      
      toast({
        title: "Conta excluída",
        description: "A conta foi excluída permanentemente. Dados de retenção legal foram arquivados.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
      handleClose();
      
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Erro ao excluir conta",
        description: "Não foi possível excluir a conta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!subscriber) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Excluir conta definitivamente
              </DialogTitle>
              <DialogDescription className="text-left pt-4 space-y-3">
                <p className="font-semibold text-foreground">
                  Esta ação é IRREVERSÍVEL.
                </p>
                <p>
                  A conta do lojista <strong>{subscriber.store_name || subscriber.email}</strong> será encerrada 
                  e os dados operacionais da loja serão removidos/anonimizados.
                </p>
                <p className="text-sm text-muted-foreground">
                  Alguns dados mínimos poderão ser mantidos em "Arquivo Legal" para cumprimento de obrigações 
                  legais (ex.: financeiro e consentimentos), conforme LGPD.
                </p>
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <p className="text-sm font-medium mb-3">O que será afetado:</p>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  Loja e painel do lojista serão desativados permanentemente.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  Produtos, clientes finais, pedidos e configurações da loja serão removidos/anonimizados.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  Integrações (pixels, tokens, chaves) serão removidas.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  Registros mínimos (financeiro/consentimento/auditoria) podem ser mantidos de forma restrita.
                </li>
              </ul>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleContinueToStep2}
              >
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Confirmar exclusão definitiva
              </DialogTitle>
              <DialogDescription className="text-left pt-2">
                Para confirmar, digite <strong>EXCLUIR</strong> e marque a confirmação.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="confirm-text">Digite EXCLUIR para confirmar</Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="EXCLUIR"
                  className={confirmText === "EXCLUIR" ? "border-green-500" : ""}
                />
              </div>
              
              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="admin-confirm"
                  checked={adminConfirm}
                  onCheckedChange={(checked) => setAdminConfirm(checked as boolean)}
                />
                <Label htmlFor="admin-confirm" className="text-sm leading-relaxed cursor-pointer">
                  Confirmo que esta exclusão foi solicitada pelo lojista e está aprovada após tentativa de retenção/atendimento.
                </Label>
              </div>
              
              <p className="text-xs text-muted-foreground border-t pt-3 mt-3">
                Retenção mínima: apenas o necessário para obrigações legais e segurança da operação.
              </p>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isDeleting}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handlePermanentDeletion}
                disabled={!canProceed || isDeleting}
              >
                {isDeleting ? "Excluindo..." : "Excluir definitivamente"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
