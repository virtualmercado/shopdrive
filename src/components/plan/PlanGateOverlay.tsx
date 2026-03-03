import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PlanGateOverlayProps {
  /** Main message shown in the overlay */
  message: string;
  /** Button label */
  buttonLabel?: string;
  /** Navigation target on button click (defaults to plans section) */
  navigateTo?: string;
  /** Whether overlay is fixed (follows scroll) or absolute */
  fixed?: boolean;
  /** Additional class for the wrapper */
  className?: string;
}

export const PlanGateOverlay = ({
  message,
  buttonLabel = "Fazer Upgrade",
  navigateTo,
  fixed = false,
  className = "",
}: PlanGateOverlayProps) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    if (navigateTo) {
      if (navigateTo.startsWith('http')) {
        window.open(navigateTo, '_blank');
      } else {
        navigate(navigateTo);
      }
    } else {
      // Navigate to plans/pricing - scroll to plans section on home
      navigate('/#planos');
    }
  };

  return (
    <div
      className={`${fixed ? 'fixed' : 'absolute'} inset-0 z-40 flex items-center justify-center ${className}`}
      style={{ pointerEvents: 'auto' }}
    >
      {/* Translucent white overlay */}
      <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px]" />
      
      {/* Content */}
      <div className="relative z-10 max-w-md mx-auto text-center p-8 space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <p className="text-base font-medium text-foreground leading-relaxed whitespace-pre-line">
          {message}
        </p>
        <Button
          onClick={handleUpgrade}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-6"
          size="lg"
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
};
