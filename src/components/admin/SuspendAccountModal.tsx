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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, PlayCircle, PauseCircle } from "lucide-react";

interface Subscriber {
  id: string;
  store_name: string | null;
  email: string | null;
  account_status: string;
}

interface SuspendAccountModalProps {
  subscriber: Subscriber | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SuspendAccountModal = ({
  subscriber,
  open,
  onOpenChange,
}: SuspendAccountModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const isSuspended = subscriber?.account_status === 'suspenso';
  const action = isSuspended ? 'reativar' : 'suspender';

  const handleConfirm = async () => {
    if (!subscriber) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newStatus = isSuspended ? 'active' : 'suspenso';

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
        action: isSuspended ? 'account_reactivated' : 'account_suspended',
        entity_type: 'profile',
        entity_id: subscriber.id,
        metadata: {
          subscriber_email: subscriber.email,
          subscriber_store: subscriber.store_name,
          previous_status: subscriber.account_status,
          new_status: newStatus,
        },
      });

      toast.success(
        isSuspended
          ? `Conta de ${subscriber.store_name || subscriber.email} reativada com sucesso`
          : `Conta de ${subscriber.store_name || subscriber.email} suspensa com sucesso`
      );

      queryClient.invalidateQueries({ queryKey: ['admin-subscribers'] });
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error(`Erro ao ${action} conta. Tente novamente.`);
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
            {isSuspended ? (
              <PlayCircle className="h-5 w-5 text-green-600" />
            ) : (
              <PauseCircle className="h-5 w-5 text-amber-600" />
            )}
            {isSuspended ? 'Reativar Conta' : 'Suspender Conta'}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Você está prestes a <strong>{action}</strong> a conta de{' '}
              <strong>{subscriber.store_name || subscriber.email}</strong>.
            </p>
            
            {isSuspended ? (
              <div className="bg-green-50 text-green-800 p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Ao reativar:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>O lojista terá acesso ao painel restaurado</li>
                  <li>A loja voltará a ficar online</li>
                  <li>O plano vigente será mantido</li>
                </ul>
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Ao suspender:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>O lojista perderá acesso ao painel</li>
                  <li>A loja ficará offline para clientes</li>
                  <li>Os dados permanecerão intactos</li>
                  <li>A conta pode ser reativada a qualquer momento</li>
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm">Status atual:</span>
              <Badge variant={isSuspended ? 'secondary' : 'default'}>
                {isSuspended ? 'Suspenso' : 'Ativo'}
              </Badge>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={isSuspended ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSuspended ? 'Reativar Conta' : 'Suspender Conta'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
