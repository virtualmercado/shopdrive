import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { OrderItemSortSelect } from "@/components/orders/OrderItemSortSelect";
import { DEFAULT_ORDER_ITEM_SORT_MODE, type OrderItemSortMode } from "@/lib/orderItemSort";

interface PrintFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The chosen item order is passed explicitly to the generator (orders with positions only). */
  onSelectA4: (sortMode: OrderItemSortMode) => void;
  onSelectThermal: (sortMode: OrderItemSortMode) => void;
  showSortOptions?: boolean;
}

const PrintFormatDialog = ({
  open,
  onOpenChange,
  onSelectA4,
  onSelectThermal,
  showSortOptions = false,
}: PrintFormatDialogProps) => {
  const [sortMode, setSortMode] = useState<OrderItemSortMode>(DEFAULT_ORDER_ITEM_SORT_MODE);
  useEffect(() => {
    if (open) setSortMode(DEFAULT_ORDER_ITEM_SORT_MODE);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Imprimir pedido</DialogTitle>
          <DialogDescription>Escolha o formato de impressão</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          {showSortOptions && <OrderItemSortSelect value={sortMode} onChange={setSortMode} id="print-order-item-sort" />}
          <Button
            className="w-full justify-start gap-3 h-12"
            onClick={() => {
              onSelectThermal(sortMode);
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
              onSelectA4(sortMode);
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
