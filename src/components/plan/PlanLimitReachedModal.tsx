import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PlanLimitReachedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "produtos" or "clientes" */
  resourceName: string;
  /** Current count */
  currentCount: number;
  /** Max allowed */
  maxAllowed: number;
  /** Current plan display name */
  planName: string;
}

export const PlanLimitReachedModal = ({
  open,
  onOpenChange,
  resourceName,
  currentCount,
  maxAllowed,
  planName,
}: PlanLimitReachedModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">Limite atingido</DialogTitle>
          <DialogDescription className="text-center">
            Você atingiu o limite de <strong>{maxAllowed} {resourceName}</strong> do plano <strong>{planName}</strong>.
            <br />
            Atualmente você possui <strong>{currentCount}</strong> {resourceName} cadastrados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              onOpenChange(false);
              navigate('/#planos');
            }}
          >
            Fazer Upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
