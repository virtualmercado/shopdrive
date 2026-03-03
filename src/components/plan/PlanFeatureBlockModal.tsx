import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PlanFeatureBlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  buttonLabel?: string;
}

export const PlanFeatureBlockModal = ({
  open,
  onOpenChange,
  message,
  buttonLabel = "Upgrade para PREMIUM",
}: PlanFeatureBlockModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Recurso bloqueado</DialogTitle>
          <DialogDescription className="text-center whitespace-pre-line">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              onOpenChange(false);
              navigate('/#planos');
            }}
          >
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
