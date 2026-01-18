import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Ban, AlertTriangle } from "lucide-react";

interface Subscriber {
  id: string;
  store_name: string | null;
  email: string | null;
  account_status: string;
}

interface BlockAccountModalProps {
  subscriber: Subscriber | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BlockAccountModal = ({
  subscriber,
  open,
  onOpenChange,
}: BlockAccountModalProps) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const isBlocked = subscriber?.account_status === 'bloqueado';

  const handleConfirm = async () => {
    if (!subscriber) return;
    
    if (!isBlocked && !reason.trim()) {
      toast.error("Motivo do bloqueio é obrigatório");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newStatus = isBlocked ? 'active' : 'bloqueado';

      // Update account status
      const { error } = await supabase
        .from('profiles')
        .update({
          account_status: newStatus,
          account_status_updated_at: new Date().toISOString(),
        })
        .eq('id', subscriber.id);

      if (error) throw error;

      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: isBlocked ? 'account_unblocked' : 'account_blocked',
        entity_type: 'profile',
        entity_id: subscriber.id,
        metadata: {
          subscriber_email: subscriber.email,
          subscriber_store: subscriber.store_name,
          previous_status: subscriber.account_status,
          new_status: newStatus,
          reason: reason || 'Desbloqueio administrativo',
        },
      });

      toast.success(
        isBlocked
          ? `Bloqueio de ${subscriber.store_name || subscriber.email} removido com sucesso`
          : `Conta de ${subscriber.store_name || subscriber.email} bloqueada com sucesso`
      );

      queryClient.invalidateQueries({ queryKey: ['admin-subscribers'] });
      onOpenChange(false);
      setReason("");
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error(`Erro ao processar ação. Tente novamente.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!subscriber) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            {isBlocked ? 'Desbloquear Conta' : 'Bloquear Acesso'}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              {isBlocked ? (
                <>
                  Você está prestes a <strong>desbloquear</strong> a conta de{' '}
                  <strong>{subscriber.store_name || subscriber.email}</strong>.
                </>
              ) : (
                <>
                  Você está prestes a <strong>bloquear</strong> a conta de{' '}
                  <strong>{subscriber.store_name || subscriber.email}</strong>.
                </>
              )}
            </p>
            
            {!isBlocked && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Atenção! Esta é uma ação severa:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>O lojista será impedido de fazer login</li>
                      <li>A loja ficará indisponível publicamente</li>
                      <li>Os dados continuam armazenados</li>
                      <li>Usado para violação de termos ou fraude</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {isBlocked && (
              <div className="bg-green-50 text-green-800 p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Ao desbloquear:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>O lojista poderá fazer login novamente</li>
                  <li>A loja voltará a ficar disponível</li>
                  <li>Todos os dados serão restaurados</li>
                </ul>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isBlocked && (
          <div className="space-y-2 py-2">
            <Label htmlFor="block-reason">
              Motivo do bloqueio <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Violação dos termos de uso, fraude detectada, uso indevido da plataforma..."
              rows={3}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isSubmitting || (!isBlocked && !reason.trim())}
            className={isBlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-destructive hover:bg-destructive/90'}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isBlocked ? 'Desbloquear Conta' : 'Bloquear Acesso'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
