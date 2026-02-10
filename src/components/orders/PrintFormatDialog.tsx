import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Receipt } from "lucide-react";

interface PrintFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectA4: () => void;
  onSelectThermal: () => void;
}

const PrintFormatDialog = ({
  open,
  onOpenChange,
  onSelectA4,
  onSelectThermal,
}: PrintFormatDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Imprimir pedido</DialogTitle>
          <DialogDescription>Escolha o formato de impressão</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button
            className="w-full justify-start gap-3 h-12"
            onClick={() => {
              onSelectThermal();
              onOpenChange(false);
            }}
          >
            <Receipt className="h-5 w-5" />
            Cupom térmico 80mm (recomendado)
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12"
            onClick={() => {
              onSelectA4();
              onOpenChange(false);
            }}
          >
            <FileText className="h-5 w-5" />
            PDF A4
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintFormatDialog;
